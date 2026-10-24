import { AREA, type AreaId, type ArtVariant, type GroupDetailDto, type GroupDto } from '@circle/shared';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Group, User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrilhasService } from '../trilhas/trilhas.service';
import { UploadsService } from '../uploads/uploads.service';
import { PeopleService, PERSON_SELECT } from './people.service';

export type GroupInput = { name: string; description: string; area: AreaId; coverFileId?: string | null };

type GroupWithCounts = Group & { _count: { members: number; trilhas: number }; members: { userId: string; role: 'admin' | 'member' }[] };

/** Grupos: quem cria vira administrador; o administrador escolhe as trilhas (aprovadas) do grupo. */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly uploads: UploadsService,
    private readonly trilhas: TrilhasService,
    private readonly notifications: NotificationsService,
  ) {}

  private include(userId: string) {
    return { _count: { select: { members: true, trilhas: true } }, members: { where: { userId }, select: { userId: true, role: true } } } as const;
  }

  private async toDto(g: GroupWithCounts): Promise<GroupDto> {
    const cover = g.coverFileId ? await this.prisma.file.findUnique({ where: { id: g.coverFileId } }) : null;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      area: g.area,
      icon: g.icon,
      art: g.art as ArtVariant,
      coverUrl: cover ? await this.uploads.url(cover) : null,
      members: g._count.members,
      trilhas: g._count.trilhas,
      member: g.members.length > 0,
      admin: g.members[0]?.role === 'admin',
    };
  }

  async list(userId: string) {
    const groups = await this.prisma.group.findMany({ include: this.include(userId), orderBy: { name: 'asc' } });
    const dtos = await Promise.all(groups.map(g => this.toDto(g)));
    return { mine: dtos.filter(g => g.member), suggested: dtos.filter(g => !g.member) };
  }

  private async get(userId: string, id: string) {
    const g = await this.prisma.group.findUnique({ where: { id }, include: this.include(userId) });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    return g;
  }

  private async requireAdmin(userId: string, id: string) {
    const g = await this.get(userId, id);
    if (g.members[0]?.role !== 'admin') throw new ForbiddenException('Só o administrador do grupo pode fazer isso.');
    return g;
  }

  async detail(user: User, id: string): Promise<GroupDetailDto> {
    const g = await this.get(user.id, id);
    const [members, links] = await Promise.all([
      this.prisma.groupMember.findMany({ where: { groupId: id }, include: { user: { select: PERSON_SELECT } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] }),
      this.prisma.groupTrilha.findMany({ where: { groupId: id }, select: { trilhaId: true } }),
    ]);
    const people = await this.people.many(members.map(m => m.user));
    return {
      ...(await this.toDto(g)),
      memberList: people.map((p, i) => ({ ...p, role: members[i]!.role })),
      trilhaList: await this.trilhas.approvedByIds(user, links.map(l => l.trilhaId)),
    };
  }

  async create(user: User, input: GroupInput) {
    if (input.coverFileId) await this.uploads.readyFile(user.id, input.coverFileId, 'group');
    const area = AREA[input.area];
    const g = await this.prisma.group.create({
      data: {
        name: input.name.trim(),
        description: input.description.trim(),
        area: input.area,
        icon: area.icon,
        art: area.art,
        coverFileId: input.coverFileId ?? null,
        createdById: user.id,
        members: { create: { userId: user.id, role: 'admin' } },
      },
    });
    return this.detail(user, g.id);
  }

  async update(user: User, id: string, input: Partial<GroupInput>) {
    const g = await this.requireAdmin(user.id, id);
    if (input.coverFileId) await this.uploads.readyFile(user.id, input.coverFileId, 'group');
    await this.prisma.group.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description?.trim(),
        area: input.area,
        icon: input.area ? AREA[input.area].icon : undefined,
        art: input.area ? AREA[input.area].art : undefined,
        coverFileId: input.coverFileId,
      },
    });
    if (input.coverFileId !== undefined && g.coverFileId && input.coverFileId !== g.coverFileId) await this.uploads.remove(user.id, g.coverFileId).catch(() => undefined);
    return this.detail(user, id);
  }

  async remove(user: User, id: string) {
    const g = await this.requireAdmin(user.id, id);
    await this.prisma.group.delete({ where: { id } });
    if (g.coverFileId && g.createdById) await this.uploads.remove(g.createdById, g.coverFileId).catch(() => undefined);
  }

  async join(user: User, id: string) {
    const g = await this.get(user.id, id);
    if (g.members.length) return this.detail(user, id);
    await this.prisma.groupMember.create({ data: { groupId: id, userId: user.id } });
    const admins = await this.prisma.groupMember.findMany({ where: { groupId: id, role: 'admin' }, select: { userId: true } });
    for (const a of admins) {
      await this.notifications.notify({ userId: a.userId, type: 'grupo_entrada', title: `${user.name} entrou em ${g.name}`, link: `/grupos/${id}`, actorId: user.id, refId: id });
    }
    return this.detail(user, id);
  }

  /** Sair. Se era o único administrador e ainda há membros, o membro mais antigo vira administrador. */
  async leave(user: User, id: string) {
    const g = await this.get(user.id, id);
    if (!g.members.length) return;
    await this.prisma.$transaction(async tx => {
      await tx.groupMember.delete({ where: { groupId_userId: { groupId: id, userId: user.id } } });
      if (g.members[0]!.role === 'admin' && !(await tx.groupMember.count({ where: { groupId: id, role: 'admin' } }))) {
        const next = await tx.groupMember.findFirst({ where: { groupId: id }, orderBy: { joinedAt: 'asc' } });
        if (next) await tx.groupMember.update({ where: { groupId_userId: { groupId: id, userId: next.userId } }, data: { role: 'admin' } });
      }
    });
  }

  async addTrilha(user: User, id: string, trilhaId: string) {
    const g = await this.requireAdmin(user.id, id);
    const t = await this.prisma.trilha.findUnique({ where: { id: trilhaId } });
    if (!t || t.status !== 'aprovada') throw new BadRequestException('Só trilhas aprovadas da loja podem entrar no grupo.');
    await this.prisma.groupTrilha.upsert({
      where: { groupId_trilhaId: { groupId: id, trilhaId } },
      create: { groupId: id, trilhaId, addedById: user.id },
      update: {},
    });
    const members = await this.prisma.groupMember.findMany({ where: { groupId: id, userId: { not: user.id } }, select: { userId: true } });
    for (const m of members) {
      await this.notifications.notify({ userId: m.userId, type: 'grupo_trilha', title: `Nova trilha em ${g.name}`, body: `“${t.title}”`, link: `/grupos/${id}`, actorId: user.id, refId: trilhaId });
    }
    return this.detail(user, id);
  }

  async removeTrilha(user: User, id: string, trilhaId: string) {
    await this.requireAdmin(user.id, id);
    await this.prisma.groupTrilha.deleteMany({ where: { groupId: id, trilhaId } });
    return this.detail(user, id);
  }

  /** Ids dos grupos de que a pessoa faz parte (usado no feed). */
  async myGroupIds(userId: string) {
    return (await this.prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } })).map(m => m.groupId);
  }
}
