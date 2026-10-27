import type { ReplyDto, TopicDetailDto, TopicDto } from '@circle/shared';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService, PERSON_SELECT } from './people.service';

/**
 * Fórum dos grupos: tópicos com respostas. Só os membros leem e escrevem.
 * Quem escreveu apaga o que escreveu; o administrador do grupo apaga qualquer coisa.
 */
@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Confere se a pessoa é membro do grupo e devolve o papel dela. */
  private async membership(userId: string, groupId: string) {
    const m = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, include: { group: { select: { name: true } } } });
    if (!m) throw new ForbiddenException('Entre no grupo para ver e participar do fórum.');
    return m;
  }

  private async topicOf(groupId: string, topicId: string) {
    const t = await this.prisma.groupTopic.findFirst({ where: { id: topicId, groupId } });
    if (!t) throw new NotFoundException('Tópico não encontrado.');
    return t;
  }

  async list(user: User, groupId: string): Promise<TopicDto[]> {
    await this.membership(user.id, groupId);
    const rows = await this.prisma.groupTopic.findMany({
      where: { groupId },
      include: { author: { select: PERSON_SELECT }, _count: { select: { replies: true } } },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
    });
    const people = await this.people.many(rows.map(r => r.author));
    return rows.map((r, i) => ({
      id: r.id,
      title: r.title,
      text: r.text,
      author: people[i]!,
      mine: r.authorId === user.id,
      replies: r._count.replies,
      lastActivityAt: r.lastActivityAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async detail(user: User, groupId: string, topicId: string): Promise<TopicDetailDto> {
    const m = await this.membership(user.id, groupId);
    const t = await this.prisma.groupTopic.findFirst({
      where: { id: topicId, groupId },
      include: { author: { select: PERSON_SELECT }, replies: { include: { author: { select: PERSON_SELECT } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!t) throw new NotFoundException('Tópico não encontrado.');
    const people = await this.people.many([t.author, ...t.replies.map(r => r.author)]);
    const replyList: ReplyDto[] = t.replies.map((r, i) => ({
      id: r.id,
      author: people[i + 1]!,
      mine: r.authorId === user.id,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    }));
    return {
      id: t.id,
      title: t.title,
      text: t.text,
      author: people[0]!,
      mine: t.authorId === user.id,
      replies: replyList.length,
      lastActivityAt: t.lastActivityAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      replyList,
      canModerate: m.role === 'admin',
    };
  }

  /** Abre um tópico e avisa os outros membros do grupo. */
  async create(user: User, groupId: string, input: { title: string; text?: string }) {
    const m = await this.membership(user.id, groupId);
    const t = await this.prisma.groupTopic.create({ data: { groupId, authorId: user.id, title: input.title.trim(), text: input.text?.trim() ?? '' } });
    const members = await this.prisma.groupMember.findMany({ where: { groupId, userId: { not: user.id } }, select: { userId: true } });
    for (const x of members) {
      await this.notifications.notify({
        userId: x.userId,
        type: 'grupo_topico',
        title: `Novo tópico em ${m.group.name}`,
        body: `${user.name.split(' ')[0]}: “${t.title}”`,
        link: `/grupos/${groupId}?topico=${t.id}`,
        actorId: user.id,
        refId: t.id,
      });
    }
    return this.detail(user, groupId, t.id);
  }

  /** Responde um tópico e avisa o autor do tópico. */
  async reply(user: User, groupId: string, topicId: string, text: string) {
    const m = await this.membership(user.id, groupId);
    const t = await this.topicOf(groupId, topicId);
    await this.prisma.$transaction([
      this.prisma.groupReply.create({ data: { topicId, authorId: user.id, text: text.trim() } }),
      this.prisma.groupTopic.update({ where: { id: topicId }, data: { lastActivityAt: new Date() } }),
    ]);
    await this.notifications.notify({
      userId: t.authorId,
      type: 'grupo_resposta',
      title: `${user.name.split(' ')[0]} respondeu seu tópico em ${m.group.name}`,
      body: `“${text.trim().slice(0, 100)}”`,
      link: `/grupos/${groupId}?topico=${topicId}`,
      actorId: user.id,
      refId: topicId,
    });
    return this.detail(user, groupId, topicId);
  }

  async removeTopic(user: User, groupId: string, topicId: string) {
    const m = await this.membership(user.id, groupId);
    const t = await this.topicOf(groupId, topicId);
    if (t.authorId !== user.id && m.role !== 'admin') throw new ForbiddenException('Só quem escreveu ou o administrador do grupo pode apagar.');
    await this.prisma.groupTopic.delete({ where: { id: topicId } });
  }

  async removeReply(user: User, groupId: string, topicId: string, replyId: string) {
    const m = await this.membership(user.id, groupId);
    await this.topicOf(groupId, topicId);
    const r = await this.prisma.groupReply.findFirst({ where: { id: replyId, topicId } });
    if (!r) throw new NotFoundException('Resposta não encontrada.');
    if (r.authorId !== user.id && m.role !== 'admin') throw new ForbiddenException('Só quem escreveu ou o administrador do grupo pode apagar.');
    await this.prisma.groupReply.delete({ where: { id: replyId } });
    return this.detail(user, groupId, topicId);
  }
}
