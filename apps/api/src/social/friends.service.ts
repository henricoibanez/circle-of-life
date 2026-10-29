import type { FriendsDto, PersonSearchDto } from '@circle/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService, PERSON_SELECT } from './people.service';

/**
 * Amizades: pedido por e-mail ou @ID, aceitar, recusar, cancelar e remover.
 * Nesta versão só quem já tem conta pode ser adicionado (convites de acesso são só pelos admins).
 */
@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(userId: string): Promise<FriendsDto> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: { select: PERSON_SELECT }, addressee: { select: PERSON_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    const other = (r: (typeof rows)[number]) => (r.requesterId === userId ? r.addressee : r.requester);
    const people = await this.people.many(rows.map(other));
    const byId = new Map(people.map(p => [p.id, p]));
    const map = (r: (typeof rows)[number]) => ({ id: r.id, person: byId.get(other(r).id)!, createdAt: r.createdAt.toISOString() });
    return {
      friends: rows.filter(r => r.status === 'accepted').map(r => byId.get(other(r).id)!).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      received: rows.filter(r => r.status === 'pending' && r.addresseeId === userId).map(map),
      sent: rows.filter(r => r.status === 'pending' && r.requesterId === userId).map(map),
    };
  }

  /**
   * Busca pessoas que já usam o app, pelo nome ou @ID (não pelo e-mail, que fica privado).
   * Cada resultado diz a situação com você: amigo, pedido enviado, pedido recebido ou nenhuma.
   */
  async search(me: User, q: string): Promise<PersonSearchDto[]> {
    const term = q.trim().replace(/^@/, '');
    if (term.length < 2) return [];
    const blocked = await this.people.blockedIds(me.id);
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: me.id, notIn: blocked },
        OR: [{ name: { contains: term, mode: 'insensitive' } }, { handle: { contains: term.toLowerCase() } }],
      },
      select: PERSON_SELECT,
      orderBy: { name: 'asc' },
      take: 8,
    });
    const links = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: me.id, addresseeId: { in: rows.map(r => r.id) } },
          { addresseeId: me.id, requesterId: { in: rows.map(r => r.id) } },
        ],
      },
    });
    const people = await this.people.many(rows);
    return people.map(p => {
      const l = links.find(x => x.requesterId === p.id || x.addresseeId === p.id);
      const relation = !l ? null : l.status === 'accepted' ? 'amigo' : l.requesterId === me.id ? 'enviado' : 'recebido';
      return { ...p, relation, requestId: l && l.status === 'pending' ? l.id : null };
    });
  }

  /** Pede amizade por e-mail ou @ID. Se a outra pessoa já tinha pedido, vira amizade na hora. */
  async request(me: User, who: string) {
    const key = who.trim().toLowerCase().replace(/^@/, '');
    const target = await this.prisma.user.findFirst({ where: key.includes('@') ? { email: key } : { handle: key } });
    if (!target) throw new NotFoundException('Essa pessoa ainda não está no Circle of Life. Por enquanto, só administradores convidam pessoas novas.');
    if (target.id === me.id) throw new BadRequestException('Você não pode adicionar a si mesmo.');
    if ((await this.people.blockedIds(me.id)).includes(target.id)) throw new BadRequestException('Não é possível adicionar essa pessoa.');

    const existing = await this.prisma.friendship.findFirst({
      where: { OR: [{ requesterId: me.id, addresseeId: target.id }, { requesterId: target.id, addresseeId: me.id }] },
    });
    if (existing?.status === 'accepted') throw new ConflictException('Vocês já são amigos.');
    if (existing && existing.requesterId === me.id) throw new ConflictException('Você já mandou um pedido para essa pessoa.');
    if (existing) return this.accept(me, existing.id);

    const f = await this.prisma.friendship.create({ data: { requesterId: me.id, addresseeId: target.id } });
    await this.notifications.notify({
      userId: target.id,
      type: 'amizade_pedido',
      title: `${me.name} quer ser seu amigo`,
      body: 'Aceite para ver os posts e as conquistas um do outro.',
      link: '/grupos?aba=amigos',
      actorId: me.id,
      refId: f.id,
    });
    await this.mail
      .send({
        to: target.email,
        subject: `${me.name} quer ser seu amigo no Circle of Life`,
        title: `${me.name} quer ser seu amigo`,
        paragraphs: ['Aceite o pedido para acompanhar a caminhada um do outro no Sprint da Vida.'],
        button: { label: 'Ver pedido', url: `${this.config.get('WEB_URL')}/grupos?aba=amigos` },
      })
      .catch(() => undefined);
    return { status: 'enviado' as const };
  }

  async accept(me: User, requestId: string) {
    const f = await this.prisma.friendship.findFirst({ where: { id: requestId, addresseeId: me.id, status: 'pending' } });
    if (!f) throw new NotFoundException('Pedido não encontrado.');
    await this.prisma.friendship.update({ where: { id: f.id }, data: { status: 'accepted', acceptedAt: new Date() } });
    await this.notifications.notify({
      userId: f.requesterId,
      type: 'amizade_aceita',
      title: `${me.name} aceitou seu pedido de amizade`,
      link: '/grupos?aba=amigos',
      actorId: me.id,
      refId: f.id,
    });
    return { status: 'amigos' as const };
  }

  /** Recusar (quem recebeu) ou cancelar (quem mandou) um pedido pendente. */
  async dismiss(me: User, requestId: string) {
    const r = await this.prisma.friendship.deleteMany({
      where: { id: requestId, status: 'pending', OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
    });
    if (!r.count) throw new NotFoundException('Pedido não encontrado.');
  }

  async remove(me: User, friendId: string) {
    await this.prisma.friendship.deleteMany({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: me.id, addresseeId: friendId },
          { requesterId: friendId, addresseeId: me.id },
        ],
      },
    });
  }
}
