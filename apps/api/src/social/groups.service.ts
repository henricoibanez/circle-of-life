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

/**
 * Grupos: quem cria vira gestor (no banco, role "admin") e escolhe quem mais é gestor.
 * Os gestores cuidam das trilhas do grupo (ver TrilhasService) e moderam o fórum.
 */
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
    return { _count: { select: { members: true, trilhas: { where: { status: 'aprovada' as const } } } }, members: { where: { userId }, select: { userId: true, role: true } } } as const;
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
    if (g.members[0]?.role !== 'admin') throw new ForbiddenException('Só os gestores do grupo podem fazer isso.');
    return g;
  }

  async detail(user: User, id: string): Promise<GroupDetailDto> {
    const g = await this.get(user.id, id);
    const members = await this.prisma.groupMember.findMany({ where: { groupId: id }, include: { user: { select: PERSON_SELECT } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] });
    const people = await this.people.many(members.map(m => m.user));
    const gestor = g.members[0]?.role === 'admin';
    const lists = g.members.length ? await this.trilhas.groupLists(user, id, gestor) : { trilhaList: [], suggestions: [] };
    // A lista de banidos (para desbanir) só aparece para os gestores.
    const bans = gestor
      ? await this.prisma.groupBan.findMany({ where: { groupId: id }, include: { user: { select: PERSON_SELECT } }, orderBy: { createdAt: 'desc' } })
      : [];
    return {
      ...(await this.toDto(g)),
      memberList: people.map((p, i) => ({ ...p, role: members[i]!.role, creator: p.id === g.createdById })),
      canManageGestores: this.canManage(g, user.id, members.map(m => m.userId)),
      bans: await this.people.many(bans.map(b => b.user)),
      ...lists,
    };
  }

  /** Remover (sai, mas pode voltar) ou banir (não volta até desbanir). Só gestores; não atinge o criador nem outro gestor. */
  private async kick(user: User, id: string, memberId: string, ban: boolean) {
    const g = await this.requireAdmin(user.id, id);
    if (memberId === user.id) throw new BadRequestException('Para sair do grupo, use "Sair".');
    if (memberId === g.createdById) throw new BadRequestException('Quem criou o grupo não pode ser removido.');
    const target = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: memberId } } });
    if (!target) throw new NotFoundException('Essa pessoa não está no grupo.');
    if (target.role === 'admin') throw new BadRequestException('Tire a pessoa de gestor antes de remover ou banir.');
    await this.prisma.$transaction(async tx => {
      await tx.groupMember.delete({ where: { groupId_userId: { groupId: id, userId: memberId } } });
      if (ban) await tx.groupBan.upsert({ where: { groupId_userId: { groupId: id, userId: memberId } }, create: { groupId: id, userId: memberId }, update: {} });
    });
    return this.detail(user, id);
  }

  async removeMember(user: User, id: string, memberId: string) {
    return this.kick(user, id, memberId, false);
  }

  async banMember(user: User, id: string, memberId: string) {
    return this.kick(user, id, memberId, true);
  }

  async unban(user: User, id: string, memberId: string) {
    await this.requireAdmin(user.id, id);
    await this.prisma.groupBan.deleteMany({ where: { groupId: id, userId: memberId } });
    return this.detail(user, id);
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
    if (await this.prisma.groupBan.findUnique({ where: { groupId_userId: { groupId: id, userId: user.id } } })) {
      throw new ForbiddenException('Você foi banido deste grupo e não pode entrar.');
    }
    await this.prisma.groupMember.create({ data: { groupId: id, userId: user.id } });
    const admins = await this.prisma.groupMember.findMany({ where: { groupId: id, role: 'admin' }, select: { userId: true } });
    for (const a of admins) {
      await this.notifications.notify({ userId: a.userId, type: 'grupo_entrada', title: `${user.name} entrou em ${g.name}`, link: `/grupos/${id}`, actorId: user.id, refId: id });
    }
    return this.detail(user, id);
  }

  /** Sair. Se era o único gestor e ainda há membros, o membro mais antigo vira gestor. */
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

  /** Gestor traz uma trilha da loja: vira uma cópia do grupo. */
  async addTrilha(user: User, id: string, trilhaId: string) {
    await this.trilhas.copyToGroup(user, id, trilhaId);
    return this.detail(user, id);
  }

  /** Gestor tira uma trilha do grupo. Quem já importou continua com o épico no backlog. */
  async removeTrilha(user: User, id: string, trilhaId: string) {
    await this.requireAdmin(user.id, id);
    await this.prisma.trilha.deleteMany({ where: { id: trilhaId, groupId: id } });
    return this.detail(user, id);
  }

  /** Quem escolhe os gestores: o criador; se ele não está mais no grupo, qualquer gestor. */
  private canManage(g: GroupWithCounts, userId: string, memberIds: string[]) {
    if (g.members[0]?.role !== 'admin') return false;
    return g.createdById === userId || !g.createdById || !memberIds.includes(g.createdById);
  }

  /** Tornar gestor ou tirar de gestor. O criador continua sempre gestor. */
  async setRole(user: User, id: string, memberId: string, role: 'admin' | 'member') {
    const g = await this.get(user.id, id);
    const members = await this.prisma.groupMember.findMany({ where: { groupId: id }, select: { userId: true, role: true } });
    if (!this.canManage(g, user.id, members.map(m => m.userId))) throw new ForbiddenException('Só quem criou o grupo escolhe os gestores.');
    const target = members.find(m => m.userId === memberId);
    if (!target) throw new NotFoundException('Essa pessoa não faz parte do grupo.');
    if (memberId === g.createdById && role === 'member') throw new BadRequestException('Quem criou o grupo continua sempre como gestor.');
    if (role === 'member' && members.filter(m => m.role === 'admin').length === 1 && target.role === 'admin') throw new BadRequestException('O grupo precisa ter pelo menos um gestor.');
    if (target.role === role) return this.detail(user, id);
    await this.prisma.groupMember.update({ where: { groupId_userId: { groupId: id, userId: memberId } }, data: { role } });
    if (role === 'admin' && memberId !== user.id) {
      await this.notifications.notify({
        userId: memberId,
        type: 'grupo_gestor',
        title: `Você agora é gestor de ${g.name}`,
        body: 'Você aprova as trilhas sugeridas pelos membros e cuida das trilhas do grupo.',
        link: `/grupos/${id}`,
        actorId: user.id,
        refId: id,
      });
    }
    return this.detail(user, id);
  }

  /** Ids dos grupos de que a pessoa faz parte (usado no feed). */
  async myGroupIds(userId: string) {
    return (await this.prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } })).map(m => m.groupId);
  }
}
