import { SOCIAL_UNLOCK_PRICE, SOCIAL_WAIT_DAYS } from './xp';

/**
 * Jornada de primeiro acesso (decisões do dono de 03 e 04/11/2026): 7 fases, em
 * ordem (cada uma só abre quando a anterior termina). Enquanto a pessoa está na
 * Jornada, nenhuma ação rende XP; ao apertar "Concluir minha jornada" ela ganha
 * 1.000 XP e 1.000 círculos. A rede social abre pagando 500 círculos, ou de graça depois de 7 dias.
 */

/** Mínimo de caracteres do necrológio para contar como feito. */
export const NECRO_MIN_CHARS = 100;

export type JourneyPhase = 'roda' | 'maslow' | 'quadro' | 'necrologio' | 'backlog' | 'sprint' | 'concluir';

/** As 7 fases, na ordem. As 4 primeiras formam "Minha vida". */
export const JOURNEY_PHASES: { id: JourneyPhase; href: string; title: string; goal: string; congrats: string }[] = [
  {
    id: 'roda',
    href: '/roda',
    title: 'Roda da Vida',
    goal: 'Dê uma nota de 0 a 10 a cada uma das 10 áreas da sua vida.',
    congrats: 'Você olhou para cada área da sua vida. Próximo passo: a Pirâmide de Maslow.',
  },
  {
    id: 'maslow',
    href: '/maslow',
    title: 'Pirâmide de Maslow',
    goal: 'Marque pelo menos 1 item que já está atendido na sua vida.',
    congrats: 'Você entendeu o que já está atendido na sua vida. Próximo passo: o Quadro de visualização.',
  },
  {
    id: 'quadro',
    href: '/quadro',
    title: 'Quadro de visualização',
    goal: 'Cadastre pelo menos 1 sonho.',
    congrats: 'Seu primeiro sonho está no quadro. Próximo passo: o Necrológio.',
  },
  {
    id: 'necrologio',
    href: '/necrologio',
    title: 'Necrológio',
    goal: `Escreva pelo menos ${NECRO_MIN_CHARS} caracteres sobre quem você quer ter sido.`,
    congrats: 'Você escreveu a baliza da sua vida. Agora é hora de planejar: o quadro Kanban está liberado.',
  },
  {
    id: 'backlog',
    href: '/backlog',
    title: 'Monte o seu backlog',
    goal: 'Crie 1 iniciativa, 1 épico e 1 tarefa (ou baixe a trilha recomendada) e envie pelo menos 1 tarefa para a sprint.',
    congrats: 'Você concluiu o seu primeiro planejamento de backlog. Vamos iniciar a sprint.',
  },
  {
    id: 'sprint',
    href: '/sprint?de=jornada',
    title: 'Inicie a sua 1ª sprint',
    goal: 'Dê um nome à sprint, escolha a duração e aperte "Iniciar sprint".',
    congrats: 'Sua primeira sprint começou. Falta só um passo: concluir a sua jornada.',
  },
  {
    id: 'concluir',
    href: '/jornada',
    title: 'Conclua a sua jornada',
    goal: 'Receba o seu prêmio e libere tudo o que o app tem.',
    congrats: '',
  },
];

/** As 4 primeiras fases (os exercícios de reflexão). Completas, destrancam o quadro. */
export const MINHA_VIDA_PHASES: JourneyPhase[] = ['roda', 'maslow', 'quadro', 'necrologio'];

export type JourneyDto = {
  /** A pessoa passa pela Jornada (quem já usava o app: false, tudo liberado). */
  active: boolean;
  /** Já viu as boas-vindas. */
  welcomed: boolean;
  /** As 7 fases, em ordem. `done` só vale se as anteriores também estiverem feitas. */
  phases: { id: JourneyPhase; done: boolean }[];
  /** Fase atual (a primeira não feita); null quando tudo está feito. */
  current: JourneyPhase | null;
  /** Quantas fases já tiveram o pop-up de parabéns (para mostrar o da próxima concluída). */
  phaseSeen: number;
  /** Detalhes para mostrar o progresso dentro de cada fase. */
  detail: {
    rodaAreas: number;
    necroChars: number;
    backlog: { initiative: boolean; epic: boolean; task: boolean; inSprint: boolean };
  };
  /** Apertou "Concluir minha jornada" (já ganhou o XP). */
  finished: boolean;
  /** XP do prêmio da Jornada. */
  prize: number;
  social: SocialStatus;
};

/**
 * Rede social e o resto do app (Feed, stories, amigos, grupos, loja completa):
 * - `open`: liberado (fora da Jornada, ou Jornada concluída de vez);
 * - `freeAt`: a partir de quando dá para concluir de graça (7 dias depois de "Concluir minha jornada");
 * - `journeyDoneAt`: quando a Jornada foi concluída de vez (é a data da conquista).
 */
export type SocialStatus = { open: boolean; freeAt: string | null; journeyDoneAt: string | null };

export function socialStatus(u: { journey: boolean; journeyFinishedAt: Date | null; socialUnlockedAt: Date | null }): SocialStatus {
  if (!u.journey) return { open: true, freeAt: null, journeyDoneAt: null };
  if (u.socialUnlockedAt) return { open: true, freeAt: null, journeyDoneAt: u.socialUnlockedAt.toISOString() };
  const freeAt = u.journeyFinishedAt ? new Date(u.journeyFinishedAt.getTime() + SOCIAL_WAIT_DAYS * 86_400_000).toISOString() : null;
  return { open: false, freeAt, journeyDoneAt: null };
}

/** Mensagem da trava da rede social (a API devolve com status 403). */
export const SOCIAL_LOCKED_MESSAGE = `Isso abre quando você concluir a sua Jornada: por ${SOCIAL_UNLOCK_PRICE} círculos ou de graça depois de ${SOCIAL_WAIT_DAYS} dias.`;

/** Trilha oficial recomendada na Jornada (criada por migration): uma ação em cada área da vida. */
export const STARTER_TRILHA_ID = 'trilha-primeiros-passos';

/** Mensagem da trava do quadro (a API devolve com status 403). */
export const BOARD_LOCKED_MESSAGE = 'Complete Minha vida (Roda da Vida, Maslow, Quadro e Necrológio) para liberar o quadro e a sprint.';
