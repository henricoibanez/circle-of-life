import { SPRINT_DAYS } from '@circle/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma, Sprint } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

export const plannedEnd = (start: Date) => new Date(start.getTime() + (SPRINT_DAYS - 1) * 24 * 3600 * 1000);

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sprint em andamento da pessoa. Se ainda não existir nenhuma, cria a Sprint 1 começando agora. */
  async current(userId: string, tx: Tx = this.prisma): Promise<Sprint> {
    const open = await tx.sprint.findFirst({ where: { userId, closedAt: null }, orderBy: { number: 'desc' } });
    if (open) return open;
    const last = await tx.sprint.findFirst({ where: { userId }, orderBy: { number: 'desc' } });
    const startAt = new Date();
    return tx.sprint.create({ data: { userId, number: (last?.number ?? 0) + 1, startAt, plannedEnd: plannedEnd(startAt) } });
  }
}
