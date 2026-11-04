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
/** …ou na hora, gastando este XP disponível. */
export const SOCIAL_UNLOCK_PRICE = 500;

export type XpReason = keyof typeof XP | 'trilha_compra' | 'rede_social';

/** Resultado de uma ação que mexeu no XP, devolvido pela API para a tela comemorar. */
export type XpChange = { gained: number; total: number; disponivel: number };
