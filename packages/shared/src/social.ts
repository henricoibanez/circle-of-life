import type { AreaId, ArtVariant } from './areas';
import type { TrilhaDto } from './trilhas';

/** Uma pessoa como aparece nas listas sociais. */
export type PersonDto = { id: string; name: string; handle: string; photoUrl: string | null };

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
  /** Faço parte? E sou administrador? */
  member: boolean;
  admin: boolean;
};

export type GroupDetailDto = GroupDto & {
  memberList: (PersonDto & { role: 'admin' | 'member' })[];
  trilhaList: TrilhaDto[];
};
