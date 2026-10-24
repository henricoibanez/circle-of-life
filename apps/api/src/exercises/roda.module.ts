import { AREA_IDS, emptyScores, type AreaId, type RodaDto, type RodaScores } from '@circle/shared';
import { BadRequestException, Body, Controller, Get, Injectable, Module, Post, Put } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../xp/activity.service';
import { dayKey, XpService } from '../xp/xp.service';

class ScoresDto {
  /** { "lazer": 6, "amor": 7, … } — pode mandar só as áreas que mudaram. */
  @IsObject({ message: 'envie as notas por área' }) scores!: Partial<Record<AreaId, number>>;
}

@Injectable()
export class RodaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
  ) {}

  private async current(userId: string) {
    const rows = await this.prisma.rodaScore.findMany({ where: { userId } });
    const scores = emptyScores();
    for (const r of rows) scores[r.area] = r.score;
    return { scores, rated: rows.length > 0 };
  }

  async get(userId: string): Promise<RodaDto> {
    const { scores, rated } = await this.current(userId);
    const history = await this.prisma.rodaSnapshot.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 60 });
    return {
      scores,
      rated,
      history: history.map(h => ({ id: h.id, scores: h.scores as RodaScores, createdAt: h.createdAt.toISOString() })),
    };
  }

  /** Atualiza as notas (cada uma de 0 a 10, número inteiro). */
  async setScores(userId: string, scores: Partial<Record<AreaId, number>>) {
    for (const [area, score] of Object.entries(scores)) {
      if (!(AREA_IDS as readonly string[]).includes(area)) throw new BadRequestException('área da vida inválida');
      if (!Number.isInteger(score) || score! < 0 || score! > 10) throw new BadRequestException('a nota vai de 0 a 10');
    }
    await this.prisma.$transaction(
      Object.entries(scores).map(([area, score]) =>
        this.prisma.rodaScore.upsert({
          where: { userId_area: { userId, area: area as AreaId } },
          create: { userId, area: area as AreaId, score: score! },
          update: { score: score! },
        }),
      ),
    );
    return this.get(userId);
  }

  /**
   * "Registrar avaliação de hoje": guarda a foto das notas para a evolução.
   * Rende XP uma vez por dia (registrar várias vezes no mesmo dia não acumula).
   */
  async snapshot(userId: string) {
    const { scores, rated } = await this.current(userId);
    if (!rated) throw new BadRequestException('Dê as notas da roda antes de registrar a avaliação.');
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
      await tx.rodaSnapshot.create({ data: { userId, scores } });
      const gained = await this.xp.grant(tx, userId, 'roda', dayKey(user.timezone));
      await this.activity.add(tx, userId, 'wheel', 'Você registrou uma avaliação da Roda da Vida', '/roda');
      return { xp: await this.xp.change(tx, userId, gained) };
    });
  }
}

@Controller('roda')
class RodaController {
  constructor(private readonly roda: RodaService) {}

  @Get()
  get(@CurrentUser() u: User) {
    return this.roda.get(u.id);
  }

  @Put('scores')
  set(@CurrentUser() u: User, @Body() dto: ScoresDto) {
    return this.roda.setScores(u.id, dto.scores);
  }

  @Post('snapshots')
  snapshot(@CurrentUser() u: User) {
    return this.roda.snapshot(u.id);
  }
}

@Module({ controllers: [RodaController], providers: [RodaService], exports: [RodaService] })
export class RodaModule {}
