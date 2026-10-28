import type { AreaId, ArtVariant } from './areas';
import type { TrilhaDto } from './trilhas';

/** Uma pessoa como aparece nas listas sociais. */
export type PersonDto = { id: string; name: string; handle: string; photoUrl: string | null };

/** Resultado da busca de pessoas ao adicionar amigo. */
export type PersonSearchDto = PersonDto & { relation: 'amigo' | 'enviado' | 'recebido' | null; requestId: string | null };

export type FriendsDto = {
  friends: PersonDto[];
  /** Pedidos que outras pessoas me mandaram. */
  received: { id: string; person: PersonDto; createdAt: string }[];
  /** Pedidos que eu mandei e ainda não foram aceitos. */
  sent: { id: string; person: PersonDto; createdAt: string }[];
};

export type GroupDto = {
  id: string;
  name: string;
  description: string;
  area: AreaId;
  icon: string;
  art: ArtVariant;
  coverUrl: string | null;
  members: number;
  trilhas: number;
  /** Faço parte? Sou gestor? (`admin` = gestor do grupo.) */
  member: boolean;
  admin: boolean;
};

export type GroupDetailDto = GroupDto & {
  memberList: (PersonDto & { role: 'admin' | 'member'; creator: boolean })[];
  /** Posso escolher quem é gestor (o criador; se ele saiu, os gestores). */
  canManageGestores: boolean;
  trilhaList: TrilhaDto[];
  /** Gestor: todas as sugestões aguardando. Membro: as suas (em análise ou recusadas). */
  suggestions: TrilhaDto[];
};

// ---------- Fórum dos grupos ----------

export type TopicDto = {
  id: string;
  title: string;
  text: string;
  author: PersonDto;
  mine: boolean;
  replies: number;
  lastActivityAt: string;
  createdAt: string;
};

export type ReplyDto = { id: string; author: PersonDto; mine: boolean; text: string; createdAt: string };

/** Tópico aberto, com as respostas. `canModerate`: você é gestor do grupo. */
export type TopicDetailDto = TopicDto & { replyList: ReplyDto[]; canModerate: boolean };
