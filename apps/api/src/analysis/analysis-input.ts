import { AREA_IDS, type AnalysisSource, type AreaId, MASLOW, maslowCurrentLevel, maslowItemKey, maslowLevelPct } from '@circle/shared';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Dados enviados para a IA. Só entram as fontes que a pessoa escolheu.
 * Os nomes ficam em português porque a IA escreve o relatório em português.
 */
export type AnalysisInput = {
  /** Primeiro nome, para a IA falar com a pessoa. */
  nome: string;
  necrologio?: string;
  roda?: { notas: Partial<Record<AreaId, number>>; mediaAnterior: number | null };
  maslow?: { nivelAtual: string; niveis: { nivel: string; pct: number; faltando: string[]; reflexoes: string[] }[] };
  quadro?: { sonho: string; area: AreaId; realizado: boolean }[];
  tarefas?: {
    iniciativa: string;
    areas: AreaId[];
    concluida: boolean;
    epicos: {
      epico: string;
      area: AreaId;
      encerrado: boolean;
      feitas: number;
      total: number;
      naSprint: number;
      /** Títulos e situação das tarefas (até 20 por épico, as abertas primeiro). */
      tarefas: { t: string; status: (typeof STATUS)[keyof typeof STATUS] }[];
    }[];
  }[];
  /** Últimas sprints encerradas: quantas tarefas ficaram prontas de quantas planejadas. */
  sprints?: { sprint: string; prontas: number; total: number }[];
};

const STATUS = { backlog: 'no backlog', todo: 'a fazer', doing: 'fazendo', done: 'pronta' } as const;
const MAX_TASKS_PER_EPIC = 20;

/** Texto puro do necrológio (sem as marcações do editor). */
export const htmlToText = (html: string) =>
  html
    .replace(/<\/(p|h1|h2|h3|li|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Quais fontes têm dados (as outras aparecem desativadas na tela). */
export async function availableSources(prisma: PrismaService, userId: string): Promise<AnalysisSource[]> {
  const [necro, roda, maslow, dreams, tasks] = await Promise.all([
    prisma.necrologio.findUnique({ where: { userId } }),
    prisma.rodaScore.count({ where: { userId } }),
    prisma.maslowCheck.count({ where: { userId } }),
    prisma.dream.count({ where: { userId } }),
    prisma.task.count({ where: { userId } }),
  ]);
  const out: AnalysisSource[] = [];
  if (necro && htmlToText(necro.html).length > 0) out.push('necrologio');
  if (roda) out.push('roda');
  if (maslow) out.push('maslow');
  if (dreams) out.push('quadro');
  if (tasks) out.push('tarefas');
  return out;
}

export async function buildInput(prisma: PrismaService, userId: string, name: string, sources: AnalysisSource[]): Promise<AnalysisInput> {
  const first = name.trim().split(/\s+/)[0] ?? '';
  const input: AnalysisInput = { nome: first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1) };
  const has = (s: AnalysisSource) => sources.includes(s);

  if (has('necrologio')) {
    const n = await prisma.necrologio.findUnique({ where: { userId } });
    input.necrologio = htmlToText(n?.html ?? '').slice(0, 8000);
  }
  if (has('roda')) {
    const [scores, last] = await Promise.all([
      prisma.rodaScore.findMany({ where: { userId } }),
      prisma.rodaSnapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: 1 }),
    ]);
    const prev = last ? Object.values(last.scores as Record<string, number>) : [];
    input.roda = {
      notas: Object.fromEntries(scores.map(s => [s.area, s.score])),
      mediaAnterior: prev.length ? Math.round((prev.reduce((a, b) => a + b, 0) / prev.length) * 10) / 10 : null,
    };
  }
  if (has('maslow')) {
    const [checks, notes] = await Promise.all([prisma.maslowCheck.findMany({ where: { userId } }), prisma.maslowNote.findMany({ where: { userId } })]);
    const set = new Set(checks.map(c => c.itemKey));
    input.maslow = {
      nivelAtual: maslowCurrentLevel(set).name,
      niveis: MASLOW.map(m => ({
        nivel: m.name,
        pct: Math.round(maslowLevelPct(set, m.id) * 100),
        faltando: m.items.filter((_, i) => !set.has(maslowItemKey(m.id, i))).map(x => x[0]),
        reflexoes: notes.filter(n => n.level === m.id).map(n => n.text),
      })),
    };
  }
  if (has('quadro')) {
    const dreams = await prisma.dream.findMany({ where: { userId }, orderBy: { position: 'asc' } });
    input.quadro = dreams.map(d => ({ sonho: d.text, area: d.area, realizado: Boolean(d.doneAt) }));
  }
  if (has('tarefas')) {
    const inis = await prisma.initiative.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      include: { epics: { orderBy: { position: 'asc' }, include: { tasks: { select: { title: true, status: true }, orderBy: { position: 'asc' } } } } },
    });
    const open = (s: string) => (s === 'done' ? 1 : 0);
    input.tarefas = inis.map(i => ({
      iniciativa: i.title,
      areas: i.areas,
      concluida: Boolean(i.completedAt),
      epicos: i.epics.map(e => ({
        epico: e.title,
        area: e.area,
        encerrado: Boolean(e.closedAt),
        feitas: e.tasks.filter(t => t.status === 'done').length,
        total: e.tasks.length,
        naSprint: e.tasks.filter(t => t.status === 'todo' || t.status === 'doing').length,
        tarefas: [...e.tasks]
          .sort((a, b) => open(a.status) - open(b.status))
          .slice(0, MAX_TASKS_PER_EPIC)
          .map(t => ({ t: t.title, status: STATUS[t.status] })),
      })),
    }));
    const sprints = await prisma.sprint.findMany({ where: { userId, closedAt: { not: null } }, orderBy: { number: 'desc' }, take: 6 });
    input.sprints = sprints.map(s => ({ sprint: s.name || `Sprint ${s.number}`, prontas: s.doneCount ?? 0, total: s.totalCount ?? 0 }));
  }
  return input;
}

export const isArea = (v: unknown): v is AreaId => typeof v === 'string' && (AREA_IDS as readonly string[]).includes(v);
