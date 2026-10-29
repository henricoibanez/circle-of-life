import { type AreaId, STORY_HOURS, type StoryDto, type StoryGroupDto, type StoryViewerDto, type Visibility } from '@circle/shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma, User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService, PERSON_SELECT } from '../social/people.service';
import { UploadsService } from '../uploads/uploads.service';
import { XpService } from '../xp/xp.service';

export type StoryInput = { fileId: string; areas: AreaId[]; caption?: string; visibility?: Visibility };

/**
 * Stories: foto que some em 24 horas. Só curtidas (sem comentários) e "Visto por" para o autor.
 * Quem vê: o autor; "publico" = todos; "amigos" = amigos do autor; "privado" = só o autor.
 * Os filtros do feed não se aplicam aqui.
 */
@Injectable()
export class StoriesService {
  private readonly log = new Logger(StoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly uploads: UploadsService,
    private readonly xp: XpService,
    private readonly notifications: NotificationsService,
  ) {}

  private async visibleWhere(userId: string): Promise<Prisma.StoryWhereInput> {
    const [friends, blocked] = await Promise.all([this.people.friendIds(userId), this.people.blockedIds(userId)]);
    return {
      expiresAt: { gt: new Date() },
      // Quem bloqueou (ou foi bloqueado) não aparece, nos dois sentidos.
      authorId: { notIn: blocked },
      OR: [{ authorId: userId }, { visibility: 'publico' }, { visibility: 'amigos', authorId: { in: friends } }],
    };
  }

  private async visibleStory(userId: string, id: string) {
    const s = await this.prisma.story.findFirst({ where: { id, ...(await this.visibleWhere(userId)) } });
    if (!s) throw new NotFoundException('Esse story não está mais disponível.');
    return s;
  }

  async list(user: User): Promise<StoryGroupDto[]> {
    const rows = await this.prisma.story.findMany({
      where: await this.visibleWhere(user.id),
      include: {
        author: { select: PERSON_SELECT },
        file: true,
        likes: { where: { userId: user.id }, select: { userId: true } },
        views: { where: { userId: user.id }, select: { userId: true } },
        _count: { select: { likes: true, views: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const people = new Map((await this.people.many(rows.map(r => r.author))).map(p => [p.id, p]));
    const groups = new Map<string, StoryGroupDto & { last: number }>();
    for (const r of rows) {
      const mine = r.authorId === user.id;
      const dto: StoryDto = {
        id: r.id,
        url: await this.uploads.url(r.file),
        areas: r.areas,
        caption: r.caption,
        visibility: r.visibility,
        liked: r.likes.length > 0,
        seen: mine || r.views.length > 0,
        likes: mine ? r._count.likes : null,
        views: mine ? r._count.views : null,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      };
      const g = groups.get(r.authorId) ?? { author: people.get(r.authorId)!, mine, allSeen: true, stories: [], last: 0 };
      g.stories.push(dto);
      g.allSeen &&= dto.seen;
      g.last = r.createdAt.getTime();
      groups.set(r.authorId, g);
    }
    return [...groups.values()]
      .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(a.allSeen) - Number(b.allSeen) || b.last - a.last)
      .map(({ last: _last, ...g }) => g);
  }

  async create(user: User, input: StoryInput) {
    await this.uploads.readyFile(user.id, input.fileId, 'story');
    const areas = [...new Set(input.areas)];
    return this.prisma.$transaction(async tx => {
      const story = await tx.story.create({
        data: {
          authorId: user.id,
          fileId: input.fileId,
          areas,
          caption: input.caption?.trim() ?? '',
          visibility: input.visibility ?? user.defaultPostVisibility,
          expiresAt: new Date(Date.now() + STORY_HOURS * 3_600_000),
        },
      });
      const gained = await this.xp.grantDaily(tx, user.id, 'story');
      return { id: story.id, xp: await this.xp.change(tx, user.id, gained) };
    });
  }

  /** Apaga o story e a foto. O XP do primeiro story do dia fica. */
  async remove(user: User, id: string) {
    const s = await this.prisma.story.findFirst({ where: { id, authorId: user.id } });
    if (!s) throw new NotFoundException('Story não encontrado.');
    await this.prisma.story.delete({ where: { id } });
    await this.uploads.remove(user.id, s.fileId).catch(() => undefined);
  }

  async view(user: User, id: string) {
    const s = await this.visibleStory(user.id, id);
    if (s.authorId === user.id) return;
    await this.prisma.storyView.upsert({ where: { storyId_userId: { storyId: id, userId: user.id } }, create: { storyId: id, userId: user.id }, update: {} });
  }

  async like(user: User, id: string, on: boolean) {
    const s = await this.visibleStory(user.id, id);
    if (!on) {
      await this.prisma.storyLike.deleteMany({ where: { storyId: id, userId: user.id } });
      return;
    }
    if (await this.prisma.storyLike.findUnique({ where: { storyId_userId: { storyId: id, userId: user.id } } })) return;
    await this.prisma.storyLike.create({ data: { storyId: id, userId: user.id } });
    if (s.authorId === user.id) return;
    // Mesma regra dos posts: curtidas no mesmo story viram um aviso só enquanto ele não for lido.
    const n = await this.prisma.storyLike.count({ where: { storyId: id, userId: { not: s.authorId } } });
    const first = user.name.split(' ')[0];
    const title = n > 1 ? `${first} e mais ${n - 1} ${n - 1 === 1 ? 'pessoa curtiram' : 'pessoas curtiram'} seu story` : `${first} curtiu seu story`;
    const unread = await this.prisma.notification.findFirst({ where: { userId: s.authorId, type: 'curtida_story', refId: id, readAt: null } });
    if (unread) await this.prisma.notification.update({ where: { id: unread.id }, data: { title, actorId: user.id, createdAt: new Date() } });
    else await this.notifications.notify({ userId: s.authorId, type: 'curtida_story', title, body: s.caption, link: '/feed', actorId: user.id, refId: id });
  }

  /** "Visto por": só o autor. Quem também curtiu aparece marcado. */
  async viewers(user: User, id: string): Promise<StoryViewerDto[]> {
    const s = await this.prisma.story.findFirst({ where: { id, authorId: user.id } });
    if (!s) throw new NotFoundException('Story não encontrado.');
    const [views, likes] = await Promise.all([
      this.prisma.storyView.findMany({ where: { storyId: id }, include: { user: { select: PERSON_SELECT } }, orderBy: { viewedAt: 'desc' } }),
      this.prisma.storyLike.findMany({ where: { storyId: id }, select: { userId: true } }),
    ]);
    const liked = new Set(likes.map(l => l.userId));
    const people = await this.people.many(views.map(v => v.user));
    return views.map((v, i) => ({ person: people[i]!, viewedAt: v.viewedAt.toISOString(), liked: liked.has(v.userId) }));
  }

  /** Limpeza: stories vencidos somem e a foto é apagada do storage. */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanup() {
    const expired = await this.prisma.story.findMany({ where: { expiresAt: { lte: new Date() } }, select: { id: true, authorId: true, fileId: true } });
    for (const s of expired) {
      await this.prisma.story.delete({ where: { id: s.id } }).catch(() => undefined);
      await this.uploads.remove(s.authorId, s.fileId).catch(() => undefined);
    }
    if (expired.length) this.log.log(`${expired.length} stories vencidos apagados`);
    return expired.length;
  }
}
