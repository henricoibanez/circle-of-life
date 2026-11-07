/**
 * Regras das notificações num lugar só (como o XP em xp.ts): categorias,
 * limites por dia e por semana e o horário de silêncio padrão.
 * Plano completo em docs/plano-notificacoes.md.
 */

/**
 * Categoria de cada aviso. Decide o que a pessoa pode desligar (no sino e no celular).
 * - `atividade`: o que outras pessoas fizeram (curtida, comentário, amizade, grupos, trilhas).
 * - `alertas`: avisos do próprio planejamento (tarefas atrasadas, sprint, épicos parados, Jornada).
 * - `dicas`: área parada, volte ao app, grupo sugerido, "aconteceu algo bom?".
 * - `lembrancas`: "Lembra disso?".
 * - `novidades`: novidades de uma versão do app (o admin publica).
 * - `pesquisas`: pesquisa rápida (o admin publica).
 */
export const NOTIFICATION_CATEGORIES = ['atividade', 'alertas', 'dicas', 'lembrancas', 'novidades', 'pesquisas'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_INFO: Record<NotificationCategory, { label: string; hint: string }> = {
  atividade: { label: 'Atividade', hint: 'Curtidas, comentários, amizades, grupos e trilhas.' },
  alertas: { label: 'Alertas', hint: 'Tarefas atrasadas, prazo da sprint, épicos parados e a Jornada.' },
  dicas: { label: 'Dicas', hint: 'Áreas da vida paradas, grupos e ideias para voltar ao app.' },
  lembrancas: { label: 'Lembranças', hint: '“Lembra disso?”: conquistas de meses atrás.' },
  novidades: { label: 'Novidades', hint: 'O que mudou no app a cada versão.' },
  pesquisas: { label: 'Pesquisas', hint: 'Perguntas rápidas sobre o app, com nota de 1 a 5.' },
};

/** Categorias que contam no limite por dia e por semana (as que o app manda sozinho). */
export const COUNTED_CATEGORIES: NotificationCategory[] = ['alertas', 'dicas', 'lembrancas'];

/** Abas do sino: o que os outros fizeram (Atividade) e o resto (Para você). */
export const isActivityType = (type: string) => notificationCategory(type) === 'atividade';

/** Dicas: no máximo uma por dia, mesmo com limite sobrando. */
export const TIPS_PER_DAY = 1;
/** Área parada: dias sem tarefa criada nem concluída na área. */
export const AREA_IDLE_DAYS = 30;
/** Dicas da mesma família só voltam depois de tantos dias. */
export const TIP_REPEAT_DAYS = 14;
/** "Volte ao app": depois de tantos dias sem abrir (um aviso em cada marco). */
export const COMEBACK_DAYS = [3, 7] as const;
/** Grupo sugerido: no máximo um a cada tantos dias. */
export const GROUP_TIP_DAYS = 30;
/** Jornada parada: avisos depois de tantos dias sem avançar (um em cada marco). */
export const JOURNEY_STALL_DAYS = [2, 5, 10] as const;
/** "Lembra disso?": conquistas de pelo menos tantos dias; no máximo uma lembrança a cada 7 dias. */
export const MEMORY_MIN_DAYS = 30;
export const MEMORY_EVERY_DAYS = 7;
/** Pesquisa: ninguém recebe mais de uma a cada tantos dias. Responder rende círculos (GEMS.pesquisa). */
export const SURVEY_EVERY_DAYS = 30;
/** Convite para ligar o celular: se a pessoa disser "Agora não", volta depois de tantos dias. */
export const PUSH_ASK_AGAIN_DAYS = 60;
/**
 * Google Agenda não conectada: ao pôr um prazo, o app sugere conectar. Se a pessoa disser
 * "Agora não", só sugere de novo depois de tantos dias (decisão do dono de 07/11/2026).
 * Com a agenda conectada, pergunta em toda tarefa (sem pausa).
 */
export const CALENDAR_ASK_AGAIN_DAYS = 7;

/** Já pode sugerir conectar a Google Agenda de novo? (askedAt = último "Agora não"). */
export function calendarAskDue(askedAt: Date | null, now = new Date()) {
  return !askedAt || askedAt.getTime() <= now.getTime() - CALENDAR_ASK_AGAIN_DAYS * 86_400_000;
}

/** Como cada área aparece na dica "Que tal pensar em algo para …?". */
export const AREA_TIP_NAME: Record<string, string> = {
  lazer: 'o seu lazer',
  amor: 'o seu relacionamento amoroso',
  financas: 'a sua vida financeira',
  familia: 'a família e os amigos',
  intelectual: 'a sua vida intelectual',
  espiritualidade: 'a sua espiritualidade',
  sociedade: 'a sua contribuição para a sociedade',
  saude: 'a sua saúde física',
  emocional: 'a sua saúde emocional',
  profissional: 'a sua carreira',
};

/** "Há 1 mês", "Há 3 meses", "Há 1 ano", "Há 2 anos e 3 meses"… */
export function timeAgo(from: Date, now = new Date()) {
  let months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth();
  if (now.getDate() < from.getDate()) months--;
  months = Math.max(1, months);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y ? `${y} ${y === 1 ? 'ano' : 'anos'}` : '';
  const ms = m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  return `Há ${[ys, ms].filter(Boolean).join(' e ')}`;
}

/** Item "Lembra disso?" (tela que o aviso abre). */
export type MemoryKind = 'task' | 'epic' | 'initiative';
export type MemoryDto = {
  kind: MemoryKind;
  id: string;
  title: string;
  description: string;
  doneAt: string;
  ago: string;
  areas: string[];
  epic: string | null;
  initiative: string | null;
  imageUrl: string | null;
  /** Quantas tarefas (épico ou iniciativa). */
  tasks: number | null;
};

/** Novidades de uma versão. */
export type ReleaseDto = { id: string; version: string; title: string; body: string; publishedAt: string | null; createdAt: string; notified?: number };

/** Pesquisa rápida como a pessoa vê (no sino e na tela). */
export type SurveyDto = { id: string; question: string; open: boolean; answer: { score: number; comment: string } | null };
/** Resultado da pesquisa (só admin). */
export type SurveyResultDto = {
  id: string;
  question: string;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  sent: number;
  responses: number;
  average: number | null;
  counts: number[];
  comments: { score: number; comment: string; createdAt: string }[];
};

/** Categoria de cada tipo de notificação (os tipos são o enum NotificationType do banco). */
export const NOTIFICATION_TYPE_CATEGORY: Record<string, NotificationCategory> = {
  amizade_pedido: 'atividade',
  amizade_aceita: 'atividade',
  curtida: 'atividade',
  curtida_story: 'atividade',
  comentario: 'atividade',
  trilha_baixada: 'atividade',
  trilha_aprovada: 'atividade',
  trilha_recusada: 'atividade',
  trilha_pendente: 'atividade',
  grupo_entrada: 'atividade',
  grupo_trilha: 'atividade',
  grupo_topico: 'atividade',
  grupo_resposta: 'atividade',
  grupo_trilha_sugerida: 'atividade',
  grupo_gestor: 'atividade',
  grupo_pedido: 'atividade',
  grupo_convite: 'atividade',
  grupo_aprovado: 'atividade',
  grupo_recusado: 'atividade',
  tarefa_atrasada: 'alertas',
  tarefas_atrasadas: 'alertas',
  epico_sem_proximo: 'alertas',
  epico_vazio: 'alertas',
  jornada_parada: 'alertas',
  area_parada: 'dicas',
  volte_ao_app: 'dicas',
  grupo_sugerido: 'dicas',
  algo_bom: 'dicas',
  lembranca: 'lembrancas',
  novidade: 'novidades',
  pesquisa: 'pesquisas',
  sprint_iniciada: 'alertas',
  sprint_prazo: 'alertas',
};

export const notificationCategory = (type: string): NotificationCategory => NOTIFICATION_TYPE_CATEGORY[type] ?? 'atividade';

/**
 * Quantos avisos automáticos (os que o app manda sozinho, pelas tarefas agendadas)
 * cada pessoa recebe no máximo. Avisos de Atividade não contam.
 * A semana vai de segunda a domingo, no fuso da pessoa.
 */
export const NOTIFICATION_VOLUMES = {
  pouco: { label: 'Pouco', perDay: 1, perWeek: 3 },
  normal: { label: 'Normal', perDay: 2, perWeek: 6 },
  mais: { label: 'Mais', perDay: 3, perWeek: 10 },
} as const;
export type NotificationVolume = keyof typeof NOTIFICATION_VOLUMES;

/** Horário de silêncio padrão: nada vai para o celular das 22h às 8h (decisão do dono de 07/11/2026). */
export const DEFAULT_QUIET_START = 22;
export const DEFAULT_QUIET_END = 8;

/** Está no horário de silêncio? (hora local de 0 a 23; início igual ao fim = sem silêncio) */
export function inQuietHours(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/** Preferências de notificação como a API devolve e recebe. */
export type NotificationPrefsDto = {
  volume: NotificationVolume;
  quietStart: number;
  quietEnd: number;
  /** Categorias desligadas no sino (e, por consequência, no celular). */
  offBell: NotificationCategory[];
  /** Categorias que não vão para o celular. */
  offPush: NotificationCategory[];
  /** Mostrar o convite para ligar as notificações no celular (fora da Jornada e sem "Agora não" recente). */
  askPush: boolean;
};
