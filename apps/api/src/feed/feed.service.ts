import type { AreaId, CommentDto, FeedFilter, FeedPageDto, PostDto, PostRefType, Visibility } from '@circle/shared';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService, PERSON_SELECT } from '../social/people.service';
import { UploadsService } from '../uploads/uploads.service';
import { XpService } from '../xp/xp.service';

export type PostInput = {
  title?: string;
  text?: string;
  areas?: AreaId[];
  groupIds?: string[];
  visibility?: Visibility;
  tags?: string[];
  mediaIds?: string[];
  refType?: PostRefType;
  refId?: string;
};

export type FeedQuery = { filter?: FeedFilter; area?: AreaId; author?: string; group?: string; cursor?: string };

const PAGE = 20;

const postInclude = (userId: string) =>
  ({
    author: { select: PERSON_SELECT },
    groups: { include: { group: { select: { id: true, name: true, icon: true } } } },
    media: { include: { file: true }, orderBy: { position: 'asc' } },
    likes: { where: { userId: { not: userId } }, include: { user: { select: PERSON_SELECT } }, orderBy: { createdAt: 'desc' }, take: 3 },
    saves: { where: { userId }, select: { userId: true } },
    _count: { select: { likes: true, comments: true } },
  }) satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

/** Hashtags: sem "#", sem repetição, até 10. */
const cleanTags = (tags: string[] = []) => [...new Set(tags.map(t => t.trim().replace(/^#+/, '')).filter(Boolean))].slice(0, 10);

/**
 * Feed: posts, curtidas, salvos e comentários.
 * Quem vê um post: o autor sempre; os membros dos grupos em que ele foi publicado;
 * e mais "publico" = todos, "amigos" = amigos do autor, "privado" = ninguém além desses.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly uploads: UploadsService,
    private readonly xp: XpService,
    private readonly notifications: NotificationsService,
  ) {}

  private async circle(userId: string) {
    const [friends, groups, blocked] = await Promise.all([
      this.people.friendIds(userId),
      this.prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } }).then(r => r.map(m => m.groupId)),
      this.people.blockedIds(userId),
    ]);
    return { friends, groups, blocked };
  }

  private visibleWhere(userId: string, c: { friends: string[]; groups: string[]; blocked: string[] }): Prisma.PostWhereInput {
    return {
      // Quem você bloqueou (ou te bloqueou) some do feed, nos dois sentidos.
      authorId: { notIn: c.blocked },
      OR: [
        { authorId: userId },
        { groups: { some: { groupId: { in: c.groups } } } },
        { visibility: 'publico' },
        { visibility: 'amigos', authorId: { in: c.friends } },
      ],
    };
  }

  /** Post que a pessoa pode ver (ou 404, sem revelar que existe). */
  private async visiblePost(userId: string, id: string) {
    const c = await this.circle(userId);
    const p = await this.prisma.post.findFirst({ where: { id, ...this.visibleWhere(userId, c) } });
    if (!p) throw new NotFoundException('Post não encontrado.');
    return p;
  }

  private async toDtos(userId: string, rows: PostRow[]): Promise<PostDto[]> {
    const people = await this.people.many(rows.flatMap(r => [r.author, ...r.likes.map(l => l.user)]));
    const byId = new Map(people.map(p => [p.id, p]));
    const liked = new Set(
      (await this.prisma.postLike.findMany({ where: { userId, postId: { in: rows.map(r => r.id) } }, select: { postId: true } })).map(l => l.postId),
    );
    return Promise.all(
      rows.map(async r => ({
        id: r.id,
        author: byId.get(r.authorId)!,
        mine: r.authorId === userId,
        title: r.title,
        text: r.text,
        areas: r.areas,
        groups: r.groups.map(g => g.group).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        visibility: r.visibility,
        tags: r.tags,
        media: await Promise.all(r.media.map(async m => ({ id: m.fileId, url: await this.uploads.url(m.file) }))),
        xpShown: r.xpShown,
        likes: r._count.likes,
        liked: liked.has(r.id),
        likers: r.likes.map(l => byId.get(l.userId)!),
        comments: r._count.comments,
        saved: r.saves.length > 0,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }

  async feed(user: User, q: FeedQuery): Promise<FeedPageDto> {
    const c = await this.circle(user.id);
    const and: Prisma.PostWhereInput[] = [this.visibleWhere(user.id, c)];
    switch (q.filter) {
      case 'amigos':
        and.push({ authorId: { in: c.friends } });
        break;
      case 'grupos':
        and.push({ groups: { some: { groupId: { in: c.groups } } } });
        break;
      case 'seguindo':
        and.push({ OR: [{ authorId: { in: c.friends } }, { groups: { some: { groupId: { in: c.groups } } } }] });
        break;
      case 'salvos':
        and.push({ saves: { some: { userId: user.id } } });
        break;
    }
    if (q.area) and.push({ areas: { has: q.area } });
    if (q.author) and.push({ authorId: q.author });
    if (q.group) and.push({ groups: { some: { groupId: q.group } } });

    const rows = await this.prisma.post.findMany({
      where: { AND: and },
      include: postInclude(user.id),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, PAGE);
    return { posts: await this.toDtos(user.id, page), nextCursor: rows.length > PAGE ? page[page.length - 1]!.id : null };
  }

  async one(user: User, id: string) {
    await this.visiblePost(user.id, id);
    const row = await this.prisma.post.findUniqueOrThrow({ where: { id }, include: postInclude(user.id) });
    return (await this.toDtos(user.id, [row]))[0]!;
  }

  /** XP mostrado no post de uma conclusão: o que a pessoa ganhou (e ainda vale) com aquilo. */
  private async xpOf(userId: string, refId: string) {
    const r = await this.prisma.xpEvent.aggregate({ where: { userId, refId, reason: { notIn: ['trilha_compra', 'trilha_download'] } }, _sum: { amount: true } });
    const n = r._sum.amount ?? 0;
    return n > 0 ? n : null;
  }

  async create(user: User, input: PostInput) {
    if (!input.text?.trim() && !input.title?.trim()) throw new BadRequestException('Escreva alguma coisa ou dê um título à conquista.');
    const groupIds = await this.checkGroups(user.id, input.groupIds);
    const mediaIds = [...new Set(input.mediaIds ?? [])];
    for (const id of mediaIds) {
      await this.uploads.readyFile(user.id, id, 'post');
      if (await this.prisma.postMedia.findUnique({ where: { fileId: id } })) throw new BadRequestException('Essa imagem já está em outro post.');
    }
    const xpShown = input.refId ? await this.xpOf(user.id, input.refId) : null;

    const { post, xp } = await this.prisma.$transaction(async tx => {
      const post = await tx.post.create({
        data: {
          authorId: user.id,
          title: input.title?.trim() ?? '',
          text: input.text?.trim() ?? '',
          areas: [...new Set(input.areas ?? [])],
          groups: { create: groupIds.map(groupId => ({ groupId })) },
          visibility: input.visibility ?? user.defaultPostVisibility,
          tags: cleanTags(input.tags),
          refType: input.refId ? (input.refType ?? null) : null,
          refId: input.refId ?? null,
          xpShown,
          media: { create: mediaIds.map((fileId, position) => ({ fileId, position })) },
        },
      });
      const gained = await this.xp.grantDaily(tx, user.id, 'post');
      return { post, xp: await this.xp.change(tx, user.id, gained) };
    });
    return { post: await this.one(user, post.id), xp };
  }

  /** Só dá para postar nos grupos de que a pessoa participa. */
  private async checkGroups(userId: string, ids: string[] = []) {
    const groupIds = [...new Set(ids)];
    const member = await this.prisma.groupMember.count({ where: { userId, groupId: { in: groupIds } } });
    if (member < groupIds.length) throw new ForbiddenException('Você precisa participar do grupo para postar nele.');
    return groupIds;
  }

  private async ownPost(userId: string, id: string) {
    const p = await this.prisma.post.findUnique({ where: { id } });
    if (!p || p.authorId !== userId) throw new NotFoundException('Post não encontrado.');
    return p;
  }

  /** Editar o próprio post. Com mediaIds, a lista de imagens é trocada (as que saírem são apagadas do storage). */
  async update(user: User, id: string, input: Partial<Pick<PostInput, 'title' | 'text' | 'areas' | 'groupIds' | 'visibility' | 'tags' | 'mediaIds'>>) {
    const p = await this.ownPost(user.id, id);
    if (!(input.text ?? p.text).trim() && !(input.title ?? p.title).trim()) throw new BadRequestException('Escreva alguma coisa ou dê um título à conquista.');
    const groupIds = input.groupIds && (await this.checkGroups(user.id, input.groupIds));
    let removed: string[] = [];
    if (input.mediaIds) {
      const ids = [...new Set(input.mediaIds)];
      const current = (await this.prisma.postMedia.findMany({ where: { postId: id }, select: { fileId: true } })).map(m => m.fileId);
      for (const fileId of ids.filter(x => !current.includes(x))) {
        await this.uploads.readyFile(user.id, fileId, 'post');
        if (await this.prisma.postMedia.findUnique({ where: { fileId } })) throw new BadRequestException('Essa imagem já está em outro post.');
      }
      removed = current.filter(x => !ids.includes(x));
      await this.prisma.$transaction([
        this.prisma.postMedia.deleteMany({ where: { postId: id } }),
        this.prisma.postMedia.createMany({ data: ids.map((fileId, position) => ({ postId: id, fileId, position })) }),
      ]);
    }
    await this.prisma.post.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        text: input.text?.trim(),
        areas: input.areas && [...new Set(input.areas)],
        groups: groupIds && { deleteMany: {}, create: groupIds.map(groupId => ({ groupId })) },
        visibility: input.visibility,
        tags: input.tags ? cleanTags(input.tags) : undefined,
      },
    });
    for (const fileId of removed) await this.uploads.remove(user.id, fileId).catch(() => undefined);
    return this.one(user, id);
  }

  /** Excluir o post apaga as imagens. O XP do primeiro post do dia não é devolvido nem retirado. */
  async remove(user: User, id: string) {
    await this.ownPost(user.id, id);
    const media = await this.prisma.postMedia.findMany({ where: { postId: id }, select: { fileId: true } });
    await this.prisma.post.delete({ where: { id } });
    for (const m of media) await this.uploads.remove(user.id, m.fileId).catch(() => undefined);
  }

  async like(user: User, id: string, on: boolean) {
    const p = await this.visiblePost(user.id, id);
    if (!on) {
      await this.prisma.postLike.deleteMany({ where: { postId: id, userId: user.id } });
      return;
    }
    const existing = await this.prisma.postLike.findUnique({ where: { postId_userId: { postId: id, userId: user.id } } });
    if (existing) return;
    await this.prisma.postLike.create({ data: { postId: id, userId: user.id } });
    if (p.authorId === user.id) return;

    // Curtidas no mesmo post viram um aviso só enquanto ele não for lido.
    const others = await this.prisma.postLike.count({ where: { postId: id, userId: { not: p.authorId } } });
    const first = user.name.split(' ')[0];
    const title = others > 1 ? `${first} e mais ${others - 1} ${others - 1 === 1 ? 'pessoa curtiram' : 'pessoas curtiram'} seu post` : `${first} curtiu seu post`;
    const body = p.title || p.text.slice(0, 80);
    const unread = await this.prisma.notification.findFirst({ where: { userId: p.authorId, type: 'curtida', refId: id, readAt: null } });
    if (unread) {
      await this.prisma.notification.update({ where: { id: unread.id }, data: { title, body, actorId: user.id, createdAt: new Date() } });
    } else {
      await this.notifications.notify({ userId: p.authorId, type: 'curtida', title, body, link: `/feed?post=${id}`, actorId: user.id, refId: id });
    }
  }

  async save(user: User, id: string, on: boolean) {
    await this.visiblePost(user.id, id);
    if (on) await this.prisma.postSave.upsert({ where: { postId_userId: { postId: id, userId: user.id } }, create: { postId: id, userId: user.id }, update: {} });
    else await this.prisma.postSave.deleteMany({ where: { postId: id, userId: user.id } });
  }

  async comments(user: User, id: string): Promise<CommentDto[]> {
    await this.visiblePost(user.id, id);
    const rows = await this.prisma.comment.findMany({ where: { postId: id }, include: { author: { select: PERSON_SELECT } }, orderBy: { createdAt: 'asc' } });
    const people = await this.people.many(rows.map(r => r.author));
    return rows.map((r, i) => ({ id: r.id, author: people[i]!, mine: r.authorId === user.id, text: r.text, createdAt: r.createdAt.toISOString() }));
  }

  async comment(user: User, id: string, text: string) {
    const p = await this.visiblePost(user.id, id);
    const xp = await this.prisma.$transaction(async tx => {
      await tx.comment.create({ data: { postId: id, authorId: user.id, text: text.trim() } });
      const gained = await this.xp.grantDaily(tx, user.id, 'comentario');
      return this.xp.change(tx, user.id, gained);
    });
    await this.notifications.notify({
      userId: p.authorId,
      type: 'comentario',
      title: `${user.name.split(' ')[0]} comentou seu post`,
      body: `“${text.trim().slice(0, 100)}”`,
      link: `/feed?post=${id}`,
      actorId: user.id,
      refId: id,
    });
    return { comments: await this.comments(user, id), xp };
  }

  /** Apaga um comentário: quem escreveu ou o autor do post. */
  async removeComment(user: User, postId: string, commentId: string) {
    const c = await this.prisma.comment.findFirst({ where: { id: commentId, postId }, include: { post: { select: { authorId: true } } } });
    if (!c || (c.authorId !== user.id && c.post.authorId !== user.id)) throw new NotFoundException('Comentário não encontrado.');
    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
