import { socialStatus, type AreaId, type MiniProfileDto } from '@circle/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService } from './people.service';

/**
 * Mini-perfil (modal ao tocar na foto) e bloqueio entre pessoas.
 * O bloqueio é completo e vale nos dois sentidos: ver PeopleService.blockedIds,
 * usado pelo feed, stories, busca e amizade.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
  ) {}

  async profile(me: User, targetId: string): Promise<MiniProfileDto> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Pessoa não encontrada.');
    const person = await this.people.one(target);
    const isMe = target.id === me.id;

    const [iBlocked, theyBlocked] = isMe
      ? [false, false]
      : await Promise.all([
          this.prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: targetId } } }).then(Boolean),
          this.prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: targetId, blockedId: me.id } } }).then(Boolean),
        ]);
    const hidden = iBlocked || theyBlocked;

    const base = {
      ...person,
      bio: target.bio,
      isMe,
      blocked: iBlocked,
      memberSince: target.createdAt.toISOString(),
      xpTotal: target.xpTotal,
    };
    // Bloqueado (em qualquer sentido): não mostra números nem botão de amizade.
    if (hidden) {
      return { ...base, canAddFriend: false, relation: null, requestId: null, achievements: 0, topAreas: [], mutualFriends: 0, sharedGroups: [] };
    }

    const [link, achievements, topAreas, mutualFriends, sharedGroups] = await Promise.all([
      isMe
        ? null
        : this.prisma.friendship.findFirst({
            where: { OR: [{ requesterId: me.id, addresseeId: targetId }, { requesterId: targetId, addresseeId: me.id }] },
          }),
      this.achievementCount(targetId),
      this.topAreas(targetId),
      isMe ? 0 : this.mutualFriends(me.id, targetId),
      isMe ? [] : this.sharedGroups(me.id, targetId),
    ]);

    const relation = !link ? null : link.status === 'accepted' ? 'amigo' : link.requesterId === me.id ? 'enviado' : 'recebido';
    return {
      ...base,
      relation,
      requestId: link && link.status === 'pending' ? link.id : null,
      canAddFriend: !isMe && relation === null,
      achievements,
      topAreas,
      mutualFriends,
      sharedGroups,
    };
  }

  private async achievementCount(userId: string) {
    const [epics, inits, u] = await Promise.all([
      this.prisma.epic.count({ where: { userId, closedAt: { not: null } } }),
      this.prisma.initiative.count({ where: { userId, completedAt: { not: null } } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { journey: true, journeyFinishedAt: true, socialUnlockedAt: true } }),
    ]);
    // A Jornada concluída também é uma conquista.
    return epics + inits + (socialStatus(u).journeyDoneAt ? 1 : 0);
  }

  /** As 3 áreas com mais conquistas (épicos encerrados e iniciativas concluídas). */
  private async topAreas(userId: string): Promise<AreaId[]> {
    const [epics, inits] = await Promise.all([
      this.prisma.epic.findMany({ where: { userId, closedAt: { not: null } }, select: { area: true, areas: true } }),
      this.prisma.initiative.findMany({ where: { userId, completedAt: { not: null } }, select: { areas: true } }),
    ]);
    const count = new Map<string, number>();
    // Épico encerrado conta em todas as suas áreas.
    for (const e of epics) for (const a of e.areas.length ? e.areas : [e.area]) count.set(a, (count.get(a) ?? 0) + 1);
    for (const i of inits) for (const a of i.areas) count.set(a, (count.get(a) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a as AreaId);
  }

  private async mutualFriends(meId: string, targetId: string) {
    const [mine, theirs] = await Promise.all([this.people.friendIds(meId), this.people.friendIds(targetId)]);
    const set = new Set(mine);
    return theirs.filter(id => set.has(id)).length;
  }

  private async sharedGroups(meId: string, targetId: string) {
    const rows = await this.prisma.group.findMany({
      where: { AND: [{ members: { some: { userId: meId } } }, { members: { some: { userId: targetId } } }] },
      select: { name: true },
      orderBy: { name: 'asc' },
      take: 5,
    });
    return rows.map(r => r.name);
  }

  async block(me: User, targetId: string) {
    if (targetId === me.id) throw new BadRequestException('Você não pode bloquear a si mesmo.');
    if (!(await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new NotFoundException('Pessoa não encontrada.');
    await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: me.id, blockedId: targetId } },
        create: { blockerId: me.id, blockedId: targetId },
        update: {},
      }),
      // Desfaz amizade e pedidos pendentes nos dois sentidos.
      this.prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: me.id, addresseeId: targetId }, { requesterId: targetId, addresseeId: me.id }] },
      }),
    ]);
    return this.profile(me, targetId);
  }

  async unblock(me: User, targetId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId: me.id, blockedId: targetId } });
    return this.profile(me, targetId);
  }
}
