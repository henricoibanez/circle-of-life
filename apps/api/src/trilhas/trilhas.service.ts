import type { AreaId, ArtVariant, TrilhaCategory, TrilhaDetailDto, TrilhaDto, TrilhaImportInput } from '@circle/shared';
import { AREA, SOCIAL_LOCKED_MESSAGE, socialStatus, STARTER_TRILHA_ID } from '@circle/shared';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createTasksInBulk } from '../backlog/bulk-tasks';
import type { Prisma, Trilha, User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';

type WithCounts = Trilha & {
  author: { name: string; handle: string } | null;
  _count: { tasks: number; acquisitions: number };
};

export type PublishInput = { title?: string; description: string; category: TrilhaCategory; priceGems: number; coverFileId?: string | null; groupId?: string | null };
export type TrilhaEditInput = { title?: string; description?: string; areas?: AreaId[]; tasks?: string[] };

/**
 * Trilhas: cada trilha é um épico pronto (com as tarefas) para importar no backlog.
 * - Loja (sem grupo): publicar deixa "pendente" e avisa os admins do app; só admin aprova ou recusa.
 *   Paga em círculos: os círculos do comprador são debitados (o preço NÃO vai para o autor); o autor
 *   ganha +10 XP uma vez por pessoa que baixou.
 * - Grupo: só os membros veem. O gestor publica direto (já aprovada) ou traz uma trilha da loja
 *   (vira uma cópia do grupo, que o gestor pode editar). Membro comum só sugere: fica "pendente"
 *   até um gestor aprovar ou recusar. Trilhas de grupo são grátis e não dão XP de download.
 * - Importar: a pessoa escolhe em qual iniciativa dela o épico entra (ou cria uma nova).
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
    _count: { select: { tasks: true, acquisitions: true } },
  } as const;

  private async toDto(t: WithCounts, user: User, favs: Set<string>, acquiredRoots: Set<string>, gestor = false): Promise<TrilhaDto> {
    const cover = t.coverFileId ? await this.prisma.file.findUnique({ where: { id: t.coverFileId } }) : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category as TrilhaCategory,
      area: t.area,
      areas: t.areas.length ? t.areas : [t.area],
      art: t.art as ArtVariant,
      color: t.color,
      coverText: t.coverText,
      coverUrl: cover ? await this.uploads.url(cover) : null,
      priceGems: t.priceGems,
      status: t.status,
      rejectionReason: t.authorId === user.id || (t.groupId ? gestor : user.role === 'admin') ? t.rejectionReason : null,
      author: t.author,
      tasksCount: t._count.tasks,
      downloads: t.baseDownloads + t._count.acquisitions,
      favorite: favs.has(t.id),
      acquired: acquiredRoots.has(t.rootId),
      mine: t.authorId === user.id,
      groupId: t.groupId,
      copiedFromId: t.copiedFromId,
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

  private async dtos(items: WithCounts[], user: User, gestor = false) {
    const ctx = await this.context(user);
    return Promise.all(items.map(t => this.toDto(t, user, ctx.favs, ctx.roots, gestor)));
  }

  /** Papel da pessoa no grupo: null = não é membro. */
  private async role(userId: string, groupId: string) {
    const m = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { role: true } });
    return m?.role ?? null;
  }

  /** Loja: aprovadas para todos; o autor vê as suas; o admin vê as pendentes também. */
  private storeWhere(user: User): Prisma.TrilhaWhereInput {
    const or: Prisma.TrilhaWhereInput[] = [{ status: 'aprovada' }, { authorId: user.id, status: { in: ['pendente', 'recusada'] } }];
    if (user.role === 'admin') or.push({ status: 'pendente' });
    return { groupId: null, OR: or };
  }

  async list(user: User, q?: string, category?: string) {
    const where: Prisma.TrilhaWhereInput = { AND: [this.storeWhere(user)] };
    if (category && category !== 'all') (where.AND as Prisma.TrilhaWhereInput[]).push({ category });
    if (q) (where.AND as Prisma.TrilhaWhereInput[]).push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] });
    const items = await this.prisma.trilha.findMany({ where, include: this.include, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });
    return this.dtos(items, user);
  }

  /** A trilha, se a pessoa pode vê-la. No grupo: membros veem as aprovadas; gestores e o autor, também as pendentes e recusadas. */
  private async visible(user: User, id: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id }, include: { ...this.include, group: { select: { id: true, name: true } } } });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    // Jornada (decisão do dono de 04/11/2026): até liberar tudo, só a trilha "Primeiros passos" abre.
    if (!socialStatus(user).open && t.rootId !== STARTER_TRILHA_ID) throw new ForbiddenException(SOCIAL_LOCKED_MESSAGE);
    if (!t.groupId) {
      const ok = t.status === 'aprovada' || (t.authorId === user.id && t.status !== 'despublicada') || (user.role === 'admin' && t.status === 'pendente');
      if (!ok) throw new NotFoundException('Trilha não encontrada.');
      return { t, gestor: false };
    }
    const role = await this.role(user.id, t.groupId);
    const gestor = role === 'admin';
    const ok = role && (t.status === 'aprovada' || (t.status !== 'despublicada' && (gestor || t.authorId === user.id)));
    if (!ok) throw new NotFoundException('Trilha não encontrada.');
    return { t, gestor };
  }

  async detail(user: User, id: string): Promise<TrilhaDetailDto> {
    const { t, gestor } = await this.visible(user, id);
    const tasks = await this.prisma.trilhaTask.findMany({ where: { trilhaId: id }, orderBy: { position: 'asc' }, select: { title: true } });
    const [dto] = await this.dtos([t], user, gestor);
    return {
      ...dto!,
      tasks: tasks.map(x => x.title),
      group: t.group,
      // Na loja, o admin do app revisa qualquer trilha (inclusive a própria: pode ser o único admin).
      canReview: t.status === 'pendente' && (t.groupId ? gestor && t.authorId !== user.id : user.role === 'admin'),
      canEdit: Boolean(t.groupId) && gestor && t.status === 'aprovada',
    };
  }

  /** Trilhas de um grupo (aprovadas) e as sugestões (gestor: todas as pendentes; membro: as suas). */
  async groupLists(user: User, groupId: string, gestor: boolean) {
    const [approved, suggestions] = await Promise.all([
      this.prisma.trilha.findMany({ where: { groupId, status: 'aprovada' }, include: this.include, orderBy: { title: 'asc' } }),
      this.prisma.trilha.findMany({
        where: gestor ? { groupId, status: 'pendente' } : { groupId, authorId: user.id, status: { in: ['pendente', 'recusada'] } },
        include: this.include,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { trilhaList: await this.dtos(approved, user, gestor), suggestions: await this.dtos(suggestions, user, gestor) };
  }

  async mine(user: User) {
    const [published, acquired] = await Promise.all([
      this.prisma.trilha.findMany({ where: { authorId: user.id, groupId: null, status: { not: 'despublicada' } }, include: this.include, orderBy: { createdAt: 'desc' } }),
      this.prisma.trilha.findMany({ where: { groupId: null, acquisitions: { some: { userId: user.id } } }, include: this.include, orderBy: { createdAt: 'desc' } }),
    ]);
    return { published: await this.dtos(published, user), acquired: await this.dtos(acquired, user) };
  }

  // ---------- Publicar e revisar ----------

  /** Publicar um épico como trilha: na loja (aprovação do admin do app) ou num grupo. */
  async publish(user: User, epicId: string, input: PublishInput) {
    const epic = await this.prisma.epic.findFirst({ where: { id: epicId, userId: user.id }, include: { tasks: { orderBy: { position: 'asc' }, select: { title: true, description: true, areas: true } } } });
    if (!epic) throw new NotFoundException('Épico não encontrado.');
    if (!epic.tasks.length) throw new BadRequestException('Para publicar, o épico precisa ter pelo menos uma tarefa.');
    if (input.priceGems < 0 || !Number.isInteger(input.priceGems)) throw new BadRequestException('O preço em círculos precisa ser um número inteiro (0 = grátis).');
    if (input.coverFileId) await this.uploads.readyFile(user.id, input.coverFileId, 'trilha');
    const areas = epic.areas.length ? epic.areas : [epic.area];
    const data = {
      authorId: user.id,
      sourceEpicId: epic.id,
      title: (input.title ?? epic.title).trim(),
      description: input.description.trim(),
      category: input.category,
      area: epic.area,
      areas,
      art: AREA[epic.area].art,
      color: AREA[epic.area].color,
      coverFileId: input.coverFileId ?? null,
      tasks: { create: epic.tasks.map((t, j) => ({ title: t.title, description: t.description, areas: t.areas, position: j })) },
    };

    if (input.groupId) return this.publishInGroup(user, input.groupId, data);

    // Já existe trilha deste épico na loja: a nova vira a próxima versão (a aprovada segue na loja até a nova ser aprovada).
    const previous = await this.prisma.trilha.findFirst({
      where: { authorId: user.id, groupId: null, sourceEpicId: epic.id, status: { in: ['aprovada', 'pendente', 'recusada'] } },
      orderBy: { createdAt: 'desc' },
    });
    const trilha = await this.prisma.$transaction(async tx => {
      if (previous && previous.status !== 'aprovada') await tx.trilha.update({ where: { id: previous.id }, data: { status: 'despublicada' } });
      const approved = previous?.status === 'aprovada' ? previous : await tx.trilha.findFirst({ where: { authorId: user.id, groupId: null, sourceEpicId: epic.id, status: 'aprovada' } });
      const created = await tx.trilha.create({ data: { ...data, rootId: 'tmp', replacesId: approved?.id ?? null, priceGems: input.priceGems } });
      return tx.trilha.update({ where: { id: created.id }, data: { rootId: previous?.rootId ?? approved?.rootId ?? created.id } });
    });

    const admins = await this.prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    for (const a of admins) {
      await this.notifications.notify({ userId: a.id, type: 'trilha_pendente', title: 'Trilha aguardando aprovação', body: `${user.name} publicou “${trilha.title}”.`, link: '/loja', actorId: user.id, refId: trilha.id });
    }
    return this.detail(user, trilha.id);
  }

  /** No grupo: gestor publica direto; membro sugere (fica pendente para os gestores). */
  private async publishInGroup(user: User, groupId: string, data: Omit<Prisma.TrilhaUncheckedCreateInput, 'rootId'>) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
    const role = group ? await this.role(user.id, groupId) : null;
    if (!group || !role) throw new ForbiddenException('Você não faz parte desse grupo.');
    const gestor = role === 'admin';
    const created = await this.prisma.trilha.create({
      data: { ...data, rootId: 'tmp', groupId, priceGems: 0, status: gestor ? 'aprovada' : 'pendente', ...(gestor ? { reviewedById: user.id, reviewedAt: new Date() } : {}) },
    });
    const trilha = await this.prisma.trilha.update({ where: { id: created.id }, data: { rootId: created.id } });
    if (gestor) await this.notifyNewInGroup(user, group, trilha);
    else {
      const gestores = await this.prisma.groupMember.findMany({ where: { groupId, role: 'admin' }, select: { userId: true } });
      for (const g of gestores) {
        await this.notifications.notify({
          userId: g.userId,
          type: 'grupo_trilha_sugerida',
          title: `Sugestão de trilha em ${group.name}`,
          body: `${user.name} sugeriu “${trilha.title}”.`,
          link: `/grupos/${groupId}`,
          actorId: user.id,
          refId: trilha.id,
        });
      }
    }
    return this.detail(user, trilha.id);
  }

  private async notifyNewInGroup(actor: User, group: { id: string; name: string }, t: Trilha) {
    const members = await this.prisma.groupMember.findMany({ where: { groupId: group.id, userId: { not: actor.id } }, select: { userId: true } });
    for (const m of members) {
      if (m.userId === t.authorId) continue;
      await this.notifications.notify({ userId: m.userId, type: 'grupo_trilha', title: `Nova trilha em ${group.name}`, body: `“${t.title}”`, link: `/grupos/${group.id}`, actorId: actor.id, refId: t.id });
    }
  }

  /** Quem revisa: admin do app (loja, inclusive a própria trilha) ou gestor do grupo (grupo). */
  private async forReview(user: User, id: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id }, include: { group: { select: { id: true, name: true } } } });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    const allowed = t.groupId ? (await this.role(user.id, t.groupId)) === 'admin' : user.role === 'admin';
    if (!allowed) throw new ForbiddenException(t.groupId ? 'Só os gestores do grupo aprovam as trilhas do grupo.' : 'Só administradores aprovam trilhas da loja.');
    if (t.status !== 'pendente') throw new ConflictException('Só trilhas aguardando aprovação podem ser revisadas.');
    return t;
  }

  async approve(user: User, id: string) {
    const t = await this.forReview(user, id);
    await this.prisma.$transaction(async tx => {
      await tx.trilha.update({ where: { id }, data: { status: 'aprovada', reviewedById: user.id, reviewedAt: new Date(), rejectionReason: null } });
      if (t.replacesId) await tx.trilha.update({ where: { id: t.replacesId }, data: { status: 'despublicada' } });
    });
    const where = t.group ? `já está no grupo ${t.group.name}` : 'já está na loja';
    const link = t.group ? `/grupos/${t.group.id}` : '/loja';
    if (t.authorId && t.authorId !== user.id) {
      await this.notifications.notify({ userId: t.authorId, type: 'trilha_aprovada', title: 'Sua trilha foi aprovada', body: `“${t.title}” ${where}.`, link, actorId: user.id, refId: id });
    }
    if (t.group) await this.notifyNewInGroup(user, t.group, t);
    return this.detail(user, id);
  }

  async reject(user: User, id: string, reason?: string) {
    const t = await this.forReview(user, id);
    await this.prisma.trilha.update({ where: { id }, data: { status: 'recusada', reviewedById: user.id, reviewedAt: new Date(), rejectionReason: reason?.trim() || null } });
    if (t.authorId) {
      await this.notifications.notify({
        userId: t.authorId,
        type: 'trilha_recusada',
        title: 'Sua trilha não foi aprovada',
        body: reason?.trim() ? `“${t.title}”: ${reason.trim()}` : `“${t.title}” precisa de ajustes. Ajuste o épico e publique de novo.`,
        link: t.group ? `/grupos/${t.group.id}` : '/loja',
        actorId: user.id,
        refId: id,
      });
    }
  }

  /**
   * Tirar do ar: o autor ou o admin do app (loja); o autor ou um gestor (grupo).
   * Quem já importou continua com a cópia no backlog.
   */
  async unpublish(user: User, id: string) {
    const t = await this.prisma.trilha.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Trilha não encontrada.');
    const allowed = t.authorId === user.id || (t.groupId ? (await this.role(user.id, t.groupId)) === 'admin' : user.role === 'admin');
    if (!allowed) throw new ForbiddenException(t.groupId ? 'Só quem criou ou um gestor do grupo pode tirar a trilha.' : 'Só quem publicou pode tirar a trilha da loja.');
    await this.prisma.trilha.update({ where: { id }, data: { status: 'despublicada' } });
  }

  // ---------- Grupo: trazer da loja e editar ----------

  /** Gestor traz uma trilha aprovada da loja: vira uma cópia do grupo (a da loja continua lá). */
  async copyToGroup(user: User, groupId: string, trilhaId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
    if (!group || (await this.role(user.id, groupId)) !== 'admin') throw new ForbiddenException('Só os gestores do grupo trazem trilhas da loja.');
    const src = await this.prisma.trilha.findUnique({ where: { id: trilhaId }, include: { tasks: { orderBy: { position: 'asc' } } } });
    if (!src || src.groupId || src.status !== 'aprovada') throw new BadRequestException('Só trilhas aprovadas da loja podem entrar no grupo.');
    if (src.priceGems > 0 && src.authorId !== user.id && !(await this.prisma.trilhaAcquisition.findFirst({ where: { userId: user.id, rootId: src.rootId } }))) {
      throw new BadRequestException('Essa trilha é paga: compre na loja antes de trazer para o grupo.');
    }
    if (await this.prisma.trilha.findFirst({ where: { groupId, copiedFromId: src.id, status: 'aprovada' } })) throw new ConflictException('Essa trilha já está no grupo.');
    const created = await this.prisma.trilha.create({
      data: {
        rootId: 'tmp',
        authorId: src.authorId,
        groupId,
        copiedFromId: src.id,
        title: src.title,
        description: src.description,
        category: src.category,
        area: src.area,
        areas: src.areas.length ? src.areas : [src.area],
        coverFileId: src.coverFileId,
        art: src.art,
        color: src.color,
        coverText: src.coverText,
        priceGems: 0,
        status: 'aprovada',
        reviewedById: user.id,
        reviewedAt: new Date(),
        tasks: { create: src.tasks.map(t => ({ title: t.title, description: t.description, areas: t.areas, position: t.position })) },
      },
    });
    const copy = await this.prisma.trilha.update({ where: { id: created.id }, data: { rootId: created.id } });
    await this.notifyNewInGroup(user, group, copy);
    return this.detail(user, copy.id);
  }

  /** Gestor edita uma trilha do grupo (nome, descrição, área e tarefas). Não mexe em quem já importou. */
  async edit(user: User, id: string, input: TrilhaEditInput) {
    const t = await this.prisma.trilha.findUnique({ where: { id } });
    if (!t || !t.groupId) throw new NotFoundException('Trilha não encontrada.');
    if ((await this.role(user.id, t.groupId)) !== 'admin') throw new ForbiddenException('Só os gestores do grupo editam as trilhas do grupo.');
    const tasks = input.tasks?.map(x => x.trim()).filter(Boolean);
    if (tasks && !tasks.length) throw new BadRequestException('A trilha precisa ter pelo menos uma tarefa.');
    await this.prisma.$transaction(async tx => {
      await tx.trilha.update({
        where: { id },
        data: {
          title: input.title?.trim() || undefined,
          description: input.description?.trim(),
          ...(input.areas?.length
            ? { area: input.areas[0]!, areas: [...new Set(input.areas)], ...(t.coverFileId ? {} : { art: AREA[input.areas[0]!].art, color: AREA[input.areas[0]!].color }) }
            : {}),
        },
      });
      if (tasks) {
        await tx.trilhaTask.deleteMany({ where: { trilhaId: id } });
        await tx.trilhaTask.createMany({ data: tasks.map((title, position) => ({ trilhaId: id, title: title.slice(0, 200), position })) });
      }
    });
    return this.detail(user, id);
  }

  // ---------- Favoritar e importar ----------

  async favorite(user: User, id: string, on: boolean) {
    await this.visible(user, id);
    if (on) await this.prisma.trilhaFavorite.upsert({ where: { userId_trilhaId: { userId: user.id, trilhaId: id } }, create: { userId: user.id, trilhaId: id }, update: {} });
    else await this.prisma.trilhaFavorite.deleteMany({ where: { userId: user.id, trilhaId: id } });
  }

  /** Importa o épico para o backlog, numa iniciativa da pessoa (ou numa nova, criada aqui). */
  async import(user: User, id: string, target: TrilhaImportInput) {
    const { t } = await this.visible(user, id);
    if (t.status !== 'aprovada' && t.authorId !== user.id) throw new NotFoundException('Trilha não encontrada.');
    const tasks = await this.prisma.trilhaTask.findMany({ where: { trilhaId: id }, orderBy: { position: 'asc' } });
    const isAuthor = t.authorId === user.id;
    let initiative: { id: string; areas: AreaId[] } | null = null;
    if ('initiativeId' in target) {
      initiative = await this.prisma.initiative.findFirst({ where: { id: target.initiativeId, userId: user.id }, select: { id: true, areas: true } });
      if (!initiative) throw new NotFoundException('Iniciativa não encontrada.');
    } else if (!target.newInitiative?.trim()) throw new BadRequestException('Escolha uma iniciativa ou dê nome a uma nova.');

    return this.prisma.$transaction(async tx => {
      const already = await tx.trilhaAcquisition.findFirst({ where: { userId: user.id, rootId: t.rootId } });
      let paid = 0;
      if (!already && !isAuthor) {
        if (t.priceGems > 0) {
          await this.xp.spendGems(tx, user.id, t.priceGems, t.id, 'trilha_compra');
          paid = t.priceGems;
        }
        await tx.trilhaAcquisition.create({ data: { userId: user.id, trilhaId: t.id, rootId: t.rootId, gemsPaid: paid } });
        // +10 XP ao autor, uma vez por pessoa que baixou (qualquer versão). Só na loja.
        if (t.authorId && !t.groupId) {
          const gained = await this.xp.grant(tx, t.authorId, 'trilha_download', `${t.rootId}:${user.id}`);
          // Só fala em XP quando o autor ganhou de verdade (na Jornada, por exemplo, não ganha).
          const bonus = gained > 0 ? ` +${gained} XP para você.` : '';
          await this.notifications.notify(
            { userId: t.authorId, type: 'trilha_baixada', title: 'Baixaram sua trilha', body: `${user.name} importou “${t.title}”.${bonus}`, link: '/loja', actorId: user.id, refId: t.id },
            tx,
          );
        }
      }

      const trilhaAreas = t.areas.length ? t.areas : [t.area];
      if (!initiative) {
        const position = await tx.initiative.count({ where: { userId: user.id } });
        initiative = await tx.initiative.create({
          data: { userId: user.id, title: ('newInitiative' in target ? target.newInitiative : t.title).trim().slice(0, 200), areas: trilhaAreas, source: 'trilha', trilhaId: t.id, position },
          select: { id: true, areas: true },
        });
      } else {
        // A iniciativa recebe as áreas da trilha que ainda não tiver.
        const merged = [...new Set([...initiative.areas, ...trilhaAreas])];
        if (merged.length !== initiative.areas.length) await tx.initiative.update({ where: { id: initiative.id }, data: { areas: merged } });
      }
      const position = await tx.epic.count({ where: { initiativeId: initiative.id } });
      const epic = await tx.epic.create({
        data: { userId: user.id, initiativeId: initiative.id, title: t.title, description: t.description, area: t.area, areas: trilhaAreas, position },
      });
      await createTasksInBulk(
        tx,
        epic.id,
        tasks.map(x => ({ userId: user.id, title: x.title, description: x.description, areas: x.areas, position: x.position })),
        `Importada da trilha ${t.title}`,
      );
      await this.activity.add(tx, user.id, 'bag', `Você importou a trilha “${t.title}”`, '/backlog');
      return { initiativeId: initiative.id, epicId: epic.id, paid, xp: await this.xp.change(tx, user.id, 0, -paid) };
    });
  }
}
