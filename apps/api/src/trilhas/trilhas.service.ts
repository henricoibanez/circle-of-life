import type { ArtVariant, TrilhaCategory, TrilhaDetailDto, TrilhaDto } from '@circle/shared';
import { AREA } from '@circle/shared';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Trilha, User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';

type WithCounts = Trilha & {
  author: { name: string; handle: string } | null;
  epics: { _count: { tasks: number } }[];
  _count: { acquisitions: number };
};

export type PublishInput = { title?: string; description: string; category: TrilhaCategory; priceXp: number; coverFileId?: string | null };

/**
 * Loja de trilhas.
 * - Publicar: copia a iniciativa (épicos e tarefas) como trilha "pendente" e avisa os admins.
 * - Só admin aprova ou recusa (com motivo opcional). Só trilhas aprovadas aparecem para todos.
 * - Importar: cria iniciativa, épicos e tarefas no backlog de quem importou. Se a trilha é
 *   paga, o XP disponível do comprador é debitado (o preço NÃO vai para o autor); o autor
 *   ganha +10 XP uma vez por pessoa que baixou.
 */
@Injectable()
export class TrilhasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  private include = {
    author: { select: { name: true, handle: true } },
    epics: { select: { _count: { select: { tasks: true } } } },
    _count: { select: { acquisitions: true } },
  } as const;

  private async toDto(t: WithCounts, user: User, favs: Set<string>, acquiredRoots: Set<string>): Promise<TrilhaDto> {
    const cover = t.coverFileId ? await this.prisma.file.findUnique({ where: { id: t.coverFileId } }) : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category as TrilhaCategory,
      areas: t.areas,
      art: t.art as ArtVariant,
      color: t.color,
      coverText: t.coverText,
      coverUrl: cover ? await this.uploads.url(cover) : null,
      priceXp: t.priceXp,
      status: t.status,
      rejectionReason: t.authorId === user.id || user.role === 'admin' ? t.rejectionReason : null,
      author: t.author,
      tasksCount: t.epics.reduce((s, e) => s + e._count.tasks, 0),
      downloads: t.baseDownloads + t._count.acquisitions,
      favorite: favs.has(t.id),
      acquired: acquiredRoots.has(t.rootId),
      mine: t.authorId === user.id,
      createdAt: t.createdAt.toISOString(),
    };
  }

  private async context(user: User) {
    const [favs, acq] = await Promise.all([
      this.prisma.trilhaFavorite.findMany({ where: { userId: user.id }, select: { trilhaId: true } }),
      this.prisma.trilhaAcquisition.findMany({ where: { userId: user.id }, select: { rootId: true } }),
    ]);
    return { favs: new Set(favs.map(f => f.trilhaId)), roots: new Set(acq.map(a => a.rootId)) };
  }

  /** Quem pode ver: aprovadas para todos; o autor vê as suas; o admin vê as pendentes também. */
  private visibleWhere(user: User): Prisma.TrilhaWhereInput {
    const or: Prisma.TrilhaWhereInput[] = [{ status: 'aprovada' }, { authorId: user.id, status: { in: ['pendente', 'recusada'] } }];
    if (user.role === 'admin') or.push({ status: 'pendente' });
    return { OR: or };
  }

  async list(user: User, q?: string, category?: string) {
    const where: Prisma.TrilhaWhereInput = { AND: [this.visibleWhere(user)] };
    if (category && category !== 'all') (where.AND as Prisma.TrilhaWhereInput[]).push({ category });
    if (q) (where.AND as Prisma.TrilhaWhereInput[]).push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] });
    const items = await this.prisma.trilha.findMany({ where, include: this.include, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });
    const ctx = await this.context(user);
    return Promise.all(items.map(t => this.toDto(t, user, ctx.favs, ctx.roots)));
  }

  private async visible(user: User, id: string) {
    const t = await this.prisma.trilha.findFirst({ where: { AND: [{ id }, this.visibleWhere(user)] }, include: this.include });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    return t;
  }

  async detail(user: User, id: string): Promise<TrilhaDetailDto> {
    const t = await this.visible(user, id);
    const epics = await this.prisma.trilhaEpic.findMany({ where: { trilhaId: id }, orderBy: { position: 'asc' }, include: { tasks: { orderBy: { position: 'asc' } } } });
    const ctx = await this.context(user);
    return { ...(await this.toDto(t, user, ctx.favs, ctx.roots)), epics: epics.map(e => ({ id: e.id, title: e.title, area: e.area, tasks: e.tasks.map(x => x.title) })) };
  }

  async mine(user: User) {
    const ctx = await this.context(user);
    const [published, acquired] = await Promise.all([
      this.prisma.trilha.findMany({ where: { authorId: user.id, status: { not: 'despublicada' } }, include: this.include, orderBy: { createdAt: 'desc' } }),
      this.prisma.trilha.findMany({ where: { acquisitions: { some: { userId: user.id } } }, include: this.include, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      published: await Promise.all(published.map(t => this.toDto(t, user, ctx.favs, ctx.roots))),
      acquired: await Promise.all(acquired.map(t => this.toDto(t, user, ctx.favs, ctx.roots))),
    };
  }

  // ---------- Publicar e revisar ----------

  async publish(user: User, initiativeId: string, input: PublishInput) {
    const ini = await this.prisma.initiative.findFirst({
      where: { id: initiativeId, userId: user.id },
      include: { epics: { orderBy: { position: 'asc' }, include: { tasks: { orderBy: { position: 'asc' }, select: { title: true } } } } },
    });
    if (!ini) throw new NotFoundException('Iniciativa não encontrada.');
    const tasks = ini.epics.reduce((s, e) => s + e.tasks.length, 0);
    if (!ini.epics.length || !tasks) throw new BadRequestException('Para publicar, a iniciativa precisa ter pelo menos um épico com tarefas.');
    if (input.priceXp < 0 || !Number.isInteger(input.priceXp)) throw new BadRequestException('O preço em XP precisa ser um número inteiro (0 = grátis).');
    if (input.coverFileId) await this.uploads.readyFile(user.id, input.coverFileId, 'trilha');

    // Já existe trilha desta iniciativa: a nova vira a próxima versão (a aprovada segue na loja até a nova ser aprovada).
    const previous = await this.prisma.trilha.findFirst({
      where: { authorId: user.id, sourceInitiativeId: ini.id, status: { in: ['aprovada', 'pendente', 'recusada'] } },
      orderBy: { createdAt: 'desc' },
    });
    const firstArea = ini.epics[0]!.area;
    const trilha = await this.prisma.$transaction(async tx => {
      if (previous && previous.status !== 'aprovada') await tx.trilha.update({ where: { id: previous.id }, data: { status: 'despublicada' } });
      const approved = previous?.status === 'aprovada' ? previous : await tx.trilha.findFirst({ where: { authorId: user.id, sourceInitiativeId: ini.id, status: 'aprovada' } });
      const created = await tx.trilha.create({
        data: {
          rootId: 'tmp',
          replacesId: approved?.id ?? null,
          authorId: user.id,
          sourceInitiativeId: ini.id,
          title: (input.title ?? ini.title).trim(),
          description: input.description.trim(),
          category: input.category,
          areas: ini.areas.length ? ini.areas : [...new Set(ini.epics.map(e => e.area))],
          art: AREA[firstArea].art,
          color: AREA[firstArea].color,
          coverFileId: input.coverFileId ?? null,
          priceXp: input.priceXp,
          epics: {
            create: ini.epics.map((e, i) => ({
              title: e.title,
              area: e.area,
              position: i,
              tasks: { create: e.tasks.map((t, j) => ({ title: t.title, position: j })) },
            })),
          },
        },
      });
      return tx.trilha.update({ where: { id: created.id }, data: { rootId: previous?.rootId ?? approved?.rootId ?? created.id } });
    });

    const admins = await this.prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    for (const a of admins) {
      await this.notifications.notify({
        userId: a.id,
        type: 'trilha_pendente',
        title: 'Trilha aguardando aprovação',
        body: `${user.name} publicou “${trilha.title}”.`,
        link: '/loja',
        actorId: user.id,
        refId: trilha.id,
      });
    }
    return this.detail(user, trilha.id);
  }

  async approve(admin: User, id: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    if (t.status !== 'pendente') throw new ConflictException('Só trilhas aguardando aprovação podem ser aprovadas.');
    await this.prisma.$transaction(async tx => {
      await tx.trilha.update({ where: { id }, data: { status: 'aprovada', reviewedById: admin.id, reviewedAt: new Date(), rejectionReason: null } });
      if (t.replacesId) await tx.trilha.update({ where: { id: t.replacesId }, data: { status: 'despublicada' } });
    });
    if (t.authorId) {
      await this.notifications.notify({ userId: t.authorId, type: 'trilha_aprovada', title: 'Sua trilha foi aprovada', body: `“${t.title}” já está na loja.`, link: '/loja', actorId: admin.id, refId: id });
    }
    return this.detail(admin, id);
  }

  async reject(admin: User, id: string, reason?: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    if (t.status !== 'pendente') throw new ConflictException('Só trilhas aguardando aprovação podem ser recusadas.');
    await this.prisma.trilha.update({ where: { id }, data: { status: 'recusada', reviewedById: admin.id, reviewedAt: new Date(), rejectionReason: reason?.trim() || null } });
    if (t.authorId) {
      await this.notifications.notify({
        userId: t.authorId,
        type: 'trilha_recusada',
        title: 'Sua trilha não foi aprovada',
        body: reason?.trim() ? `“${t.title}”: ${reason.trim()}` : `“${t.title}” precisa de ajustes. Ajuste a iniciativa e publique de novo.`,
        link: '/loja',
        actorId: admin.id,
        refId: id,
      });
    }
  }

  /** Tira da loja (autor ou admin). Quem já importou continua com a cópia no backlog. */
  async unpublish(user: User, id: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    if (t.authorId !== user.id && user.role !== 'admin') throw new ForbiddenException('Só quem publicou pode tirar a trilha da loja.');
    await this.prisma.trilha.update({ where: { id }, data: { status: 'despublicada' } });
  }

  // ---------- Favoritar e importar ----------

  async favorite(user: User, id: string, on: boolean) {
    await this.visible(user, id);
    if (on) await this.prisma.trilhaFavorite.upsert({ where: { userId_trilhaId: { userId: user.id, trilhaId: id } }, create: { userId: user.id, trilhaId: id }, update: {} });
    else await this.prisma.trilhaFavorite.deleteMany({ where: { userId: user.id, trilhaId: id } });
  }

  async import(user: User, id: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id }, include: { epics: { orderBy: { position: 'asc' }, include: { tasks: { orderBy: { position: 'asc' } } } } } });
    if (!t || (t.status !== 'aprovada' && t.authorId !== user.id)) throw new NotFoundException('Trilha não encontrada.');
    const isAuthor = t.authorId === user.id;

    return this.prisma.$transaction(async tx => {
      const already = await tx.trilhaAcquisition.findFirst({ where: { userId: user.id, rootId: t.rootId } });
      let paid = 0;
      if (!already && !isAuthor) {
        if (t.priceXp > 0) {
          await this.xp.spend(tx, user.id, t.priceXp, t.id);
          paid = t.priceXp;
        }
        await tx.trilhaAcquisition.create({ data: { userId: user.id, trilhaId: t.id, rootId: t.rootId, xpPaid: paid } });
        if (t.authorId) {
          // +10 XP ao autor, uma vez por pessoa que baixou (qualquer versão da trilha).
          await this.xp.grant(tx, t.authorId, 'trilha_download', `${t.rootId}:${user.id}`);
          await this.notifications.notify(
            { userId: t.authorId, type: 'trilha_baixada', title: 'Baixaram sua trilha', body: `${user.name} importou “${t.title}”. +10 XP para você.`, link: '/loja', actorId: user.id, refId: t.id },
            tx,
          );
        }
      }

      const ini = await tx.initiative.create({
        data: { userId: user.id, title: t.title, description: t.description, areas: t.areas, source: 'trilha', trilhaId: t.id },
      });
      for (const e of t.epics) {
        await tx.epic.create({
          data: {
            userId: user.id,
            initiativeId: ini.id,
            title: e.title,
            area: e.area,
            position: e.position,
            tasks: {
              create: e.tasks.map(x => ({ userId: user.id, title: x.title, position: x.position, logs: { create: { text: `Importada da trilha ${t.title}` } } })),
            },
          },
        });
      }
      await this.activity.add(tx, user.id, 'bag', `Você importou a trilha “${t.title}”`, '/backlog');
      return { initiativeId: ini.id, paid, xp: await this.xp.change(tx, user.id, -paid) };
    });
  }
}
