import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** Quantos itens de atividade recente guardamos por pessoa. */
const KEEP = 50;

/** "Atividade recente" do perfil: o que a pessoa fez, com atalho para a tela certa. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async add(tx: Tx, userId: string, icon: string, text: string, link: string) {
    await tx.activityEvent.create({ data: { userId, icon, text, link } });
    const old = await tx.activityEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: KEEP, select: { id: true } });
    if (old.length) await tx.activityEvent.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
  }

  list(userId: string, take = 20) {
    return this.prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, icon: true, text: true, link: true, createdAt: true },
    });
  }
}
