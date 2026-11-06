/**
 * Tabela de XP — REGRAS PROVISÓRIAS.
 *
 * O dono do projeto ainda vai definir a regra de negócio definitiva do XP.
 * Quando isso acontecer, todo o sistema de pontuação será refeito a partir
 * deste arquivo e do XpService da API. Não espalhe valores de XP pelo código.
 */
export const XP = {
  /** Concluir tarefa (reabrir tira). */
  task: 10,
  /** Concluir item de checklist (desmarcar tira). */
  check: 2,
  /** Encerrar épico. */
  epic: 50,
  /** Concluir iniciativa com mais de INITIATIVE_MIN_TASKS tarefas concluídas. */
  iniciativa: 100,
  /** Encerrar sprint com todas as tarefas prontas. */
  sprint: 100,
  /** Registrar avaliação da Roda da Vida. */
  roda: 20,
  /** Realizar um sonho do quadro. */
  sonho: 30,
  /** Primeiro post do dia. */
  post: 10,
  /** Primeiro story do dia. */
  story: 10,
  /** Primeiro comentário do dia. */
  comentario: 5,
  /** Alguém baixou (importou) uma trilha sua — uma vez por pessoa. */
  trilha_download: 10,
  /** Prêmio da Jornada: apertar "Concluir minha jornada" (uma vez só). */
  primeiros_passos: 1000,
} as const;

/** A iniciativa só rende XP se tiver MAIS de 5 tarefas concluídas (6 ou mais). */
export const INITIATIVE_MIN_TASKS = 5;

/** Jornada: depois de "Concluir minha jornada", o resto do app abre de graça depois destes dias… */
export const SOCIAL_WAIT_DAYS = 7;
/** …ou na hora, gastando estas gemas. */
export const SOCIAL_UNLOCK_PRICE = 500;

export type XpReason = keyof typeof XP;

/**
 * Círculos, a moeda do app (decisão do dono de 06/11/2026; no código, "gems"). XP é a experiência e não se gasta;
 * gemas compram trilhas na loja e liberam a rede social antes da hora. Só se ganha gemas assim:
 */
export const GEMS = {
  /** "Concluir minha jornada" (uma vez só), junto com os 1.000 XP. */
  jornada: 1000,
  /** Encerrar sprint com todas as tarefas prontas (e pelo menos uma). */
  sprint: 50,
} as const;

/** Nome da moeda nas telas. */
export const GEM_NAME = { one: 'círculo', many: 'círculos' } as const;
export const gemsLabel = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? GEM_NAME.one : GEM_NAME.many}`;

/**
 * Ofensiva da semana: a cada dia seguido que a pessoa abre o app na semana (segunda a domingo),
 * ganha mais gemas: 10 no 1º dia, 15 no 2º… até 40 no 7º. Pulou um dia ou virou a semana, volta para 10.
 */
export const STREAK_BASE = 10;
export const STREAK_STEP = 5;
export const streakReward = (dayInWeek: number) => STREAK_BASE + STREAK_STEP * (Math.min(7, Math.max(1, dayInWeek)) - 1);

/** Resultado de uma ação que mexeu no XP (e nas gemas), devolvido pela API para a tela comemorar. */
export type XpChange = { gained: number; total: number; gems: number; gemsGained: number };

/** Acessos e ofensiva, mostrados no perfil. */
export type StreakDto = {
  /** Dias seguidos abrindo o app (ofensiva). */
  ofensiva: number;
  /** Dias seguidos nesta semana (é o que define o prêmio). */
  semana: number;
  /** Dias com acesso neste mês. */
  acessosMes: number;
  /** Quanto rende amanhã, se voltar. */
  proximoPremio: number;
  /** Dias da semana atual (segunda a domingo) com acesso. */
  diasSemana: boolean[];
};

/** Resposta do "check-in" diário ao abrir o app. */
export type CheckinDto = { gemsGained: number; semana: number; ofensiva: number };
