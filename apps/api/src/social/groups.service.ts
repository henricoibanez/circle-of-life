import { AREA, type AreaId, type ArtVariant, type GroupDetailDto, type GroupDto, type GroupInviteSearchDto, type GroupListDto } from '@circle/shared';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Group, User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrilhasService } from '../trilhas/trilhas.service';
import { UploadsService } from '../uploads/uploads.service';
import { PeopleService, PERSON_SELECT } from './people.service';

export type GroupInput = { name: string; description: string; area: AreaId; coverFileId?: string | null; private?: boolean };

type GroupWithCounts = Group & {
  _count: { members: number; trilhas: number };
  members: { userId: string; role: 'admin' | 'member' }[];
  requests: { kind: 'pedido' | 'convite' }[];
};

/**
 * Grupos: quem cria vira gestor (no banco, role "admin") e escolhe quem mais é gestor.
 * Os gestores cuidam das trilhas do grupo (ver TrilhasService) e moderam o fórum.
 * Grupo privado (decisão do dono de 05/11/2026): a pessoa pede para entrar e um gestor
 * aprova ou recusa (com motivo opcional), ou um gestor convida e a pessoa aceita.
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
    return {
      _count: { select: { members: true, trilhas: { where: { status: 'aprovada' as const } } } },
      members: { where: { userId }, select: { userId: true, role: true } },
      requests: { where: { userId }, select: { kind: true } },
    } as const;
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
      private: g.private,
      pending: g.members.length ? null : (g.requests[0]?.kind ?? null),
    };
  }

  async list(userId: string): Promise<GroupListDto> {
    const groups = await this.prisma.group.findMany({ include: this.include(userId), orderBy: { name: 'asc' } });
    const dtos = await Promise.all(groups.map(g => this.toDto(g)));
    return {
      mine: dtos.filter(g => g.member),
      suggested: dtos.filter(g => !g.member && g.pending !== 'convite'),
      invites: dtos.filter(g => !g.member && g.pending === 'convite'),
    };
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
    // Num grupo privado, quem está de fora vê só nome, descrição e capa.
    const hidden = g.private && !g.members.length;
    const members = hidden
      ? []
      : await this.prisma.groupMember.findMany({ where: { groupId: id }, include: { user: { select: PERSON_SELECT } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] });
    const people = await this.people.many(members.map(m => m.user));
    const gestor = g.members[0]?.role === 'admin';
    const pending = gestor
      ? await this.prisma.groupRequest.findMany({ where: { groupId: id }, include: { user: { select: PERSON_SELECT } }, orderBy: { createdAt: 'asc' } })
      : [];
    const asPeople = async (kind: 'pedido' | 'convite') => {
      const rows = pending.filter(r => r.kind === kind);
      const ps = await this.people.many(rows.map(r => r.user));
      return ps.map((p, i) => ({ ...p, createdAt: rows[i]!.createdAt.toISOString() }));
    };
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
      requests: await asPeople('pedido'),
      invites: await asPeople('convite'),
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
      await tx.groupRequest.deleteMany({ where: { groupId: id, userId: memberId } });
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
        private: input.private ?? false,
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
        private: input.private,
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

  private isBanned(groupId: string, userId: string) {
    return this.prisma.groupBan.findUnique({ where: { groupId_userId: { groupId, userId } } }).then(Boolean);
  }

  private async gestorIds(groupId: string) {
    return (await this.prisma.groupMember.findMany({ where: { groupId, role: 'admin' }, select: { userId: true } })).map(a => a.userId);
  }

  /** Coloca a pessoa no grupo (apagando pedido ou convite) e avisa os gestores (menos quem aprovou). */
  private async addMember(g: Group, person: Pick<User, 'id' | 'name'>, except?: string) {
    await this.prisma.$transaction([
      this.prisma.groupMember.upsert({ where: { groupId_userId: { groupId: g.id, userId: person.id } }, create: { groupId: g.id, userId: person.id }, update: {} }),
      this.prisma.groupRequest.deleteMany({ where: { groupId: g.id, userId: person.id } }),
    ]);
    for (const a of await this.gestorIds(g.id)) {
      if (a === except || a === person.id) continue;
      await this.notifications.notify({ userId: a, type: 'grupo_entrada', title: `${person.name} entrou em ${g.name}`, link: `/grupos/${g.id}`, actorId: person.id, refId: g.id });
    }
  }

  /**
   * Entrar. Grupo público: entra na hora. Grupo privado: se tem convite, aceita;
   * senão, vira um pedido que os gestores aprovam ou recusam.
   */
  async join(user: User, id: string) {
    const g = await this.get(user.id, id);
    if (g.members.length) return this.detail(user, id);
    if (await this.isBanned(id, user.id)) throw new ForbiddenException('Você foi banido deste grupo e não pode entrar.');
    if (!g.private || g.requests[0]?.kind === 'convite') {
      await this.addMember(g, user);
      return this.detail(user, id);
    }
    if (g.requests[0]?.kind === 'pedido') return this.detail(user, id);
    await this.prisma.groupRequest.create({ data: { groupId: id, userId: user.id, kind: 'pedido' } });
    for (const a of await this.gestorIds(id)) {
      await this.notifications.notify({
        userId: a,
        type: 'grupo_pedido',
        title: `${user.name} pediu para entrar em ${g.name}`,
        body: 'Aprove ou recuse na aba Membros do grupo.',
        link: `/grupos/${id}?aba=membros`,
        actorId: user.id,
        refId: id,
      });
    }
    return this.detail(user, id);
  }

  /** A pessoa cancela o próprio pedido ou recusa o convite que recebeu. */
  async cancelRequest(user: User, id: string) {
    await this.get(user.id, id);
    await this.prisma.groupRequest.deleteMany({ where: { groupId: id, userId: user.id } });
    return this.detail(user, id);
  }

  /** Gestor aprova um pedido para entrar. */
  async approve(user: User, id: string, personId: string) {
    const g = await this.requireAdmin(user.id, id);
    const r = await this.prisma.groupRequest.findUnique({ where: { groupId_userId: { groupId: id, userId: personId } }, include: { user: true } });
    if (!r || r.kind !== 'pedido') throw new NotFoundException('Esse pedido não existe mais.');
    await this.addMember(g, r.user, user.id);
    await this.notifications.notify({
      userId: personId,
      type: 'grupo_aprovado',
      title: `Você entrou em ${g.name}`,
      body: 'Seu pedido foi aprovado.',
      link: `/grupos/${id}`,
      actorId: user.id,
      refId: id,
    });
    return this.detail(user, id);
  }

  /** Gestor recusa um pedido, com motivo opcional. A pessoa pode pedir de novo depois. */
  async reject(user: User, id: string, personId: string, reason?: string) {
    const g = await this.requireAdmin(user.id, id);
    const { count } = await this.prisma.groupRequest.deleteMany({ where: { groupId: id, userId: personId, kind: 'pedido' } });
    if (!count) throw new NotFoundException('Esse pedido não existe mais.');
    const why = reason?.trim();
    await this.notifications.notify({
      userId: personId,
      type: 'grupo_recusado',
      title: `Seu pedido para entrar em ${g.name} foi recusado`,
      body: why ? `Motivo: ${why}` : '',
      link: `/grupos/${id}`,
      actorId: user.id,
      refId: id,
    });
    return this.detail(user, id);
  }

  /** Gestor convida alguém. Se a pessoa já tinha pedido para entrar, entra na hora. */
  async invite(user: User, id: string, personId: string) {
    const g = await this.requireAdmin(user.id, id);
    if (personId === user.id) throw new BadRequestException('Você já está no grupo.');
    const person = await this.prisma.user.findUnique({ where: { id: personId } });
    if (!person || (await this.people.blockedIds(user.id)).includes(personId)) throw new NotFoundException('Pessoa não encontrada.');
    if (await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: personId } } })) throw new BadRequestException('Essa pessoa já está no grupo.');
    if (await this.isBanned(id, personId)) throw new BadRequestException('Essa pessoa está banida. Desbana antes de convidar.');
    const r = await this.prisma.groupRequest.findUnique({ where: { groupId_userId: { groupId: id, userId: personId } } });
    if (r?.kind === 'pedido') return this.approve(user, id, personId);
    if (r) return this.detail(user, id);
    await this.prisma.groupRequest.create({ data: { groupId: id, userId: personId, kind: 'convite', invitedById: user.id } });
    await this.notifications.notify({
      userId: personId,
      type: 'grupo_convite',
      title: `${user.name} convidou você para o grupo ${g.name}`,
      body: 'Abra o grupo para aceitar ou recusar.',
      link: `/grupos/${id}`,
      actorId: user.id,
      refId: id,
    });
    return this.detail(user, id);
  }

  /** Gestor cancela um convite que ainda não foi respondido. */
  async cancelInvite(user: User, id: string, personId: string) {
    await this.requireAdmin(user.id, id);
    await this.prisma.groupRequest.deleteMany({ where: { groupId: id, userId: personId, kind: 'convite' } });
    return this.detail(user, id);
  }

  /** Busca pessoas do app para convidar, dizendo quem já está, foi convidado, pediu ou está banido. */
  async inviteSearch(user: User, id: string, q: string): Promise<GroupInviteSearchDto[]> {
    await this.requireAdmin(user.id, id);
    const term = q.trim().replace(/^@/, '');
    if (term.length < 2) return [];
    const blocked = await this.people.blockedIds(user.id);
    const rows = await this.prisma.user.findMany({
      where: { id: { not: user.id, notIn: blocked }, OR: [{ name: { contains: term, mode: 'insensitive' } }, { handle: { contains: term.toLowerCase() } }] },
      select: PERSON_SELECT,
      orderBy: { name: 'asc' },
      take: 8,
    });
    const ids = rows.map(r => r.id);
    const [members, requests, bans] = await Promise.all([
      this.prisma.groupMember.findMany({ where: { groupId: id, userId: { in: ids } }, select: { userId: true } }),
      this.prisma.groupRequest.findMany({ where: { groupId: id, userId: { in: ids } }, select: { userId: true, kind: true } }),
      this.prisma.groupBan.findMany({ where: { groupId: id, userId: { in: ids } }, select: { userId: true } }),
    ]);
    const status = (pid: string): GroupInviteSearchDto['status'] => {
      if (members.some(m => m.userId === pid)) return 'membro';
      if (bans.some(b => b.userId === pid)) return 'banido';
      const r = requests.find(x => x.userId === pid);
      return r ? (r.kind === 'convite' ? 'convidado' : 'pediu') : null;
    };
    return (await this.people.many(rows)).map(p => ({ ...p, status: status(p.id) }));
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
