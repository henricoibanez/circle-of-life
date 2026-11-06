import type { AreaId, ArtVariant } from './areas';

/** Categorias da loja (as do protótipo). */
export const TRILHA_CATEGORIES = [
  { id: 'relacionamento', label: 'Relacionamento', icon: 'heart', color: '#ef4444' },
  { id: 'financeira', label: 'Financeira', icon: 'banknote', color: '#16a34a' },
  { id: 'saude', label: 'Saúde e bem-estar', icon: 'heartPulse', color: '#16a34a' },
  { id: 'pessoal', label: 'Pessoal', icon: 'user', color: '#8b5cf6' },
  { id: 'hobbies', label: 'Hobbies', icon: 'star', color: '#f59e0b' },
  { id: 'espiritualidade', label: 'Espiritualidade', icon: 'lotus', color: '#14b8a6' },
  { id: 'estudos', label: 'Estudos', icon: 'graduation', color: '#3b82f6' },
] as const;

export type TrilhaCategory = (typeof TRILHA_CATEGORIES)[number]['id'];
export const TRILHA_CATEGORY_IDS = TRILHA_CATEGORIES.map(c => c.id) as TrilhaCategory[];

export type TrilhaStatus = 'pendente' | 'aprovada' | 'recusada' | 'despublicada';

export type TrilhaDto = {
  id: string;
  title: string;
  description: string;
  category: TrilhaCategory;
  /** Área principal do épico (capa e categoria): a primeira de `areas`. */
  area: AreaId;
  /** Todas as áreas do épico publicado. */
  areas: AreaId[];
  art: ArtVariant;
  color: string;
  coverText: string | null;
  coverUrl: string | null;
  /** Preço em gemas (0 = grátis). */
  priceGems: number;
  status: TrilhaStatus;
  rejectionReason: string | null;
  /** Nulo = trilha oficial do Circle of Life. */
  author: { name: string; handle: string } | null;
  tasksCount: number;
  downloads: number;
  favorite: boolean;
  /** Já baixou/comprou (importar de novo é grátis). */
  acquired: boolean;
  mine: boolean;
  /** Trilha de grupo (só os membros veem). Nulo = loja. */
  groupId: string | null;
  /** Cópia do grupo: id da trilha da loja de onde veio. */
  copiedFromId: string | null;
  createdAt: string;
};

/**
 * Detalhe: as tarefas do épico. `canReview`: pode aprovar ou recusar (admin do app na loja,
 * gestor no grupo). `canEdit`: gestor do grupo dono da trilha.
 */
export type TrilhaDetailDto = TrilhaDto & { tasks: string[]; group: { id: string; name: string } | null; canReview: boolean; canEdit: boolean };

/** Onde o épico baixado entra: numa iniciativa sua ou numa nova. */
export type TrilhaImportInput = { initiativeId: string } | { newInitiative: string };
