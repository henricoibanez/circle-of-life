import { XP, type XpChange } from '@circle/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, XpReason } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;
type EarnReason = Exclude<XpReason, 'trilha_compra'>;

/** "AAAA-MM-DD" no fuso da pessoa (para as regras "primeiro do dia"). */
export const dayKey = (timezone: string, date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);

/**
 * Único lugar com as regras de XP (provisórias; a tabela de valores está em
 * packages/shared/src/xp.ts). Todo ganho, estorno e gasto vira uma linha no
 * extrato (XpEvent) e atualiza os totais do usuário.
 *
 * - Cada coisa (uma tarefa, um épico…) só rende XP uma vez enquanto estiver valendo:
 *   concluir, reabrir e concluir de novo não acumula.
 * - Ganhar soma no XP total; estornar tira do total; gastar soma em "gasto".
 *   XP disponível = total − gasto, nunca negativo.
 */
@Injectable()
export class XpService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quanto essa coisa está rendendo agora (soma dos lançamentos dela). */
  private async net(tx: Tx, userId: string, reason: EarnReason, refId: string) {
    const r = await tx.xpEvent.aggregate({ where: { userId, reason, refId }, _sum: { amount: true } });
    return r._sum.amount ?? 0;
  }

  /** Dá o XP do motivo (valor da tabela, ou `amount`), se essa coisa ainda não estiver rendendo. Devolve quanto ganhou. */
  async grant(tx: Tx, userId: string, reason: EarnReason, refId: string, amount: number = XP[reason]) {
    if ((await this.net(tx, userId, reason, refId)) > 0 || amount <= 0) return 0;
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

  /** Gasta XP disponível (compra de trilha). Recusa se não houver saldo. */
  async spend(tx: Tx, userId: string, amount: number, refId: string) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xpTotal: true, xpSpent: true } });
    if (u.xpTotal - u.xpSpent < amount) throw new BadRequestException('XP disponível insuficiente para essa compra.');
    await tx.xpEvent.create({ data: { userId, reason: 'trilha_compra', refId, amount: -amount } });
    await tx.user.update({ where: { id: userId }, data: { xpSpent: { increment: amount } } });
  }

  /** Totais atuais, para a tela mostrar depois de uma ação. */
  async change(tx: Tx, userId: string, gained: number): Promise<XpChange> {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xpTotal: true, xpSpent: true } });
    return { gained, total: u.xpTotal, disponivel: Math.max(0, u.xpTotal - u.xpSpent) };
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
