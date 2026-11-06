import { type CheckinDto, type StreakDto, streakReward } from '@circle/shared';
import { Injectable } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dayKey, XpService } from './xp.service';

/** Soma dias a um "AAAA-MM-DD" (sem fuso: o dia já está no fuso da pessoa). */
export const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Segunda-feira da semana do dia (a semana vai de segunda a domingo). */
export const mondayOf = (key: string) => addDays(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));

/** Dias seguidos terminando em `end`, sem passar de `floor` (se dado). */
function run(days: Set<string>, end: string, floor?: string) {
  let n = 0;
  for (let k = end; days.has(k) && (!floor || k >= floor); k = addDays(k, -1)) n++;
  return n;
}

/**
 * Acessos e ofensiva (decisão do dono de 06/11/2026). Cada dia em que a pessoa abre o app
 * conta uma vez (no fuso dela). O prêmio em gemas segue os dias seguidos DENTRO da semana
 * (segunda a domingo): 10, 15, 20… até 40; pulou um dia ou virou a semana, volta para 10.
 * A ofensiva mostrada no perfil é a sequência total de dias seguidos, sem zerar na semana.
 */
@Injectable()
export class StreakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
  ) {}

  private async days(userId: string) {
    const rows = await this.prisma.userLoginDay.findMany({ where: { userId }, select: { day: true }, orderBy: { day: 'desc' }, take: 400 });
    return new Set(rows.map(r => r.day));
  }

  /** Registra o acesso de hoje e dá as gemas do dia (uma vez por dia). */
  async checkin(user: User, now = new Date()): Promise<CheckinDto> {
    const today = dayKey(user.timezone, now);
    const { count } = await this.prisma.userLoginDay.createMany({ data: [{ userId: user.id, day: today }], skipDuplicates: true });
    const days = await this.days(user.id);
    const semana = run(days, today, mondayOf(today));
    let gemsGained = 0;
    if (count) {
      gemsGained = await this.prisma.$transaction(tx => this.xp.grantGems(tx, user.id, 'ofensiva', today, streakReward(semana)));
    }
    return { gemsGained, semana, ofensiva: run(days, today) };
  }

  /** Números do perfil: ofensiva, dias seguidos na semana, acessos no mês e a semana atual. */
  async status(user: User, now = new Date()): Promise<StreakDto> {
    const today = dayKey(user.timezone, now);
    const days = await this.days(user.id);
    // Se ainda não abriu hoje, a sequência que vale é a que terminou ontem.
    const end = days.has(today) ? today : addDays(today, -1);
    const monday = mondayOf(today);
    const semana = run(days, end, monday);
    const month = today.slice(0, 7);
    return {
      ofensiva: run(days, end),
      semana,
      acessosMes: [...days].filter(d => d.startsWith(month)).length,
      // Amanhã: continua a sequência, a menos que amanhã seja segunda (recomeça).
      proximoPremio: streakReward(mondayOf(addDays(today, 1)) === addDays(today, 1) ? 1 : (days.has(today) ? semana : 0) + 1),
      diasSemana: Array.from({ length: 7 }, (_, i) => days.has(addDays(monday, i))),
    };
  }
}
