import { AREA_IDS, type AreaId } from './areas';
import type { PersonDto } from './social';

export type Visibility = 'publico' | 'amigos' | 'privado';

export const VISIBILITY: { id: Visibility; label: string; icon: 'globe' | 'users' | 'lock' }[] = [
  { id: 'publico', label: 'Todo mundo', icon: 'globe' },
  { id: 'amigos', label: 'Somente amigos', icon: 'users' },
  { id: 'privado', label: 'Privado', icon: 'lock' },
];

/** Filtros do feed (chips). "Seguindo" = amigos + grupos de que você participa. */
export const FEED_FILTERS = ['para', 'amigos', 'grupos', 'seguindo', 'salvos'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export const MAX_POST_IMAGES = 8;
/** Áreas por post: sem limite (pode marcar todas). */
export const MAX_POST_AREAS = AREA_IDS.length;

/** O que originou um post de conclusão (para mostrar o "+N XP"). */
export const POST_REF_TYPES = ['task', 'epic', 'initiative', 'sprint', 'sonho'] as const;
export type PostRefType = (typeof POST_REF_TYPES)[number];

export type PostDto = {
  id: string;
  author: PersonDto;
  mine: boolean;
  title: string;
  text: string;
  areas: AreaId[];
  groups: { id: string; name: string; icon: string }[];
  visibility: Visibility;
  tags: string[];
  media: { id: string; url: string }[];
  xpShown: number | null;
  likes: number;
  liked: boolean;
  /** Até 3 pessoas que curtiram (sem você), para o "Curtido por". */
  likers: PersonDto[];
  comments: number;
  saved: boolean;
  createdAt: string;
};

export type FeedPageDto = { posts: PostDto[]; nextCursor: string | null };

export type CommentDto = { id: string; author: PersonDto; mine: boolean; text: string; createdAt: string };

/** Rascunho de post ao compartilhar uma conclusão ("Quer compartilhar?"). */
export type PostDraft = { title: string; text: string; area?: AreaId | null; refType?: PostRefType; refId?: string };

// ---------- Stories ----------

export const STORY_HOURS = 24;
/** Áreas por story: de 1 a todas (sem teto; pelo menos 1 para a marca d'água). */
export const STORY_MAX_AREAS = AREA_IDS.length;
export const STORY_CAPTION_MAX = 150;

export type StoryDto = {
  id: string;
  url: string;
  areas: AreaId[];
  caption: string;
  visibility: Visibility;
  liked: boolean;
  seen: boolean;
  /** Só para o autor. */
  likes: number | null;
  views: number | null;
  createdAt: string;
  expiresAt: string;
};

/** Stories ativos agrupados por pessoa (a sua primeiro, depois quem tem story não visto). */
export type StoryGroupDto = { author: PersonDto; mine: boolean; allSeen: boolean; stories: StoryDto[] };

export type StoryViewerDto = { person: PersonDto; viewedAt: string; liked: boolean };
