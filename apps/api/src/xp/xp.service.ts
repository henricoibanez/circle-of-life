import { XP, type XpChange } from '@circle/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { GemReason, Prisma, XpReason } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;
// trilha_compra e rede_social ficaram no extrato só pelos gastos antigos de XP (antes das gemas).
type EarnReason = Exclude<XpReason, 'trilha_compra' | 'rede_social'>;
type GemSpendReason = 'trilha_compra' | 'rede_social';
type GemEarnReason = Exclude<GemReason, GemSpendReason>;

/** "AAAA-MM-DD" no fuso da pessoa (para as regras "primeiro do dia"). */
export const dayKey = (timezone: string, date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);

/**
 * Único lugar com as regras de XP (provisórias; a tabela de valores está em
 * packages/shared/src/xp.ts). Todo ganho, estorno e gasto vira uma linha no
 * extrato (XpEvent) e atualiza os totais do usuário.
 *
 * - Cada coisa (uma tarefa, um épico…) só rende XP uma vez enquanto estiver valendo:
 *   concluir, reabrir e concluir de novo não acumula.
 * - Ganhar soma no XP total; estornar tira do total. XP não se gasta.
 * - Gemas (a moeda, decisão do dono de 06/11/2026) têm extrato próprio (GemEvent) e saldo
 *   em User.gems: ganha na Jornada, na sprint 100% e na ofensiva; gasta na loja e para
 *   liberar a rede social. O saldo nunca fica negativo.
 */
@Injectable()
export class XpService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quanto essa coisa está rendendo agora (soma dos lançamentos dela). */
  private async net(tx: Tx, userId: string, reason: EarnReason, refId: string) {
    const r = await tx.xpEvent.aggregate({ where: { userId, reason, refId }, _sum: { amount: true } });
    return r._sum.amount ?? 0;
  }

  /**
   * Na Jornada de primeiro acesso, nada rende XP até a pessoa apertar "Concluir minha
   * jornada" (decisão do dono de 04/11/2026): o prêmio da Jornada é o primeiro XP dela.
   */
  private async onJourney(tx: Tx, userId: string) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { journey: true, journeyFinishedAt: true } });
    return u.journey && !u.journeyFinishedAt;
  }

  /** Dá o XP do motivo (valor da tabela, ou `amount`), se essa coisa ainda não estiver rendendo. Devolve quanto ganhou. */
  async grant(tx: Tx, userId: string, reason: EarnReason, refId: string, amount: number = XP[reason]) {
    if ((await this.net(tx, userId, reason, refId)) > 0 || amount <= 0) return 0;
    if (await this.onJourney(tx, userId)) return 0;
    await tx.xpEvent.create({ data: { userId, reason, refId, amount } });
    await tx.user.update({ where: { id: userId }, data: { xpTotal: { increment: amount } } });
    return amount;
  }

  /** Tira o XP que essa coisa rendeu (ex.: tarefa pronta reaberta). Devolve quanto tirou (negativo). */
  async revoke(tx: Tx, userId: string, reason: EarnReason, refId: string) {
    const net = await this.net(tx, userId, reason, refId);
    if (net <= 0) return 0;
    await tx.xpEvent.create({ data: { userId, reason, refId, amount: -net } });
    await tx.user.update({ where: { id: userId }, data: { xpTotal: { decrement: net } } });
    return -net;
  }

  /** XP do "primeiro do dia" (post, story, comentário). Apagar depois não devolve a chance no mesmo dia. */
  async grantDaily(tx: Tx, userId: string, reason: 'post' | 'story' | 'comentario') {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
    const key = dayKey(user.timezone);
    const already = await tx.xpEvent.count({ where: { userId, reason, refId: key } });
    if (already) return 0;
    return this.grant(tx, userId, reason, key);
  }

  /** Dá gemas por um motivo, uma vez só por `refId`. Devolve quanto ganhou. */
  async grantGems(tx: Tx, userId: string, reason: GemEarnReason, refId: string, amount: number) {
    if (amount <= 0 || (await tx.gemEvent.count({ where: { userId, reason, refId } }))) return 0;
    // Durante a Jornada, o único prêmio é o da própria Jornada (como no XP).
    if (reason !== 'jornada' && (await this.onJourney(tx, userId))) return 0;
    await tx.gemEvent.create({ data: { userId, reason, refId, amount } });
    await tx.user.update({ where: { id: userId }, data: { gems: { increment: amount } } });
    return amount;
  }

  /** Gasta gemas (compra de trilha, liberar a rede social). Recusa se não houver saldo. */
  async spendGems(tx: Tx, userId: string, amount: number, refId: string, reason: GemSpendReason) {
    if (amount <= 0) return;
    // Só desconta se ainda houver saldo (protege contra duas compras ao mesmo tempo).
    const { count } = await tx.user.updateMany({ where: { id: userId, gems: { gte: amount } }, data: { gems: { decrement: amount } } });
    if (!count) throw new BadRequestException('Círculos insuficientes para essa compra.');
    await tx.gemEvent.create({ data: { userId, reason, refId, amount: -amount } });
  }

  /** Totais atuais, para a tela mostrar depois de uma ação. */
  async change(tx: Tx, userId: string, gained: number, gemsGained = 0): Promise<XpChange> {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xpTotal: true, gems: true } });
    return { gained, total: u.xpTotal, gems: u.gems, gemsGained };
  }

  /** Extrato de gemas (mais recente primeiro). */
  gemHistory(userId: string, take = 100) {
    return this.prisma.gemEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take, select: { id: true, amount: true, reason: true, createdAt: true } });
  }

  /** Extrato (mais recente primeiro). */
  history(userId: string, take = 100) {
    return this.prisma.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, amount: true, reason: true, refId: true, createdAt: true },
    });
  }
}
