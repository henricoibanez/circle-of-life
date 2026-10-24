/**
 * Backlog e sprints de exemplo do protótipo (função seed() do circle-of-life.html),
 * para o usuário Henrico. Datas relativas a "agora", como no protótipo.
 */
import type { PrismaClient } from '../src/generated/prisma/client';

type Status = 'backlog' | 'todo' | 'doing' | 'done';
type Prio = 'alta' | 'media' | 'baixa';
type T = [title: string, status: Status, prio: Prio, opts?: { done?: number; archived?: boolean; due?: number; created?: number; check?: [string, boolean][] }];

const DAY = 86400000;
const ago = (days: number, h = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(h, 0, 0, 0);
  return d;
};
const dateIn = (days: number) => new Date(new Date(Date.now() + days * DAY).toISOString().slice(0, 10) + 'T12:00:00Z');

const INITIATIVES = [
  { key: 'i1', title: 'Vida longa e próspera', description: 'Viver com saúde, propósito e abundância', areas: ['saude', 'amor', 'financas'], isMaster: true },
  { key: 'i2', title: 'Desenvolver o lado artístico', description: 'Voltar a fazer algo só por gosto', areas: ['lazer'] },
  { key: 'i3', title: 'Ler os clássicos', description: 'Ler devagar o que atravessou séculos', areas: ['intelectual', 'espiritualidade'] },
  { key: 'i4', title: 'Ser útil para alguém', description: 'Transbordar o que aprendi', areas: ['sociedade'] },
] as const;

const EPICS: { key: string; ini: string; title: string; area: string; description: string; tasks: T[] }[] = [
  {
    key: 'e1', ini: 'i1', title: 'Casamento', area: 'amor', description: 'Construir uma relação sólida e duradoura',
    tasks: [
      ['Definir valores do relacionamento', 'done', 'alta', { done: 18, archived: true }],
      ['Conversar sobre planos futuros', 'done', 'media', { done: 11, archived: true }],
      ['Alinhar expectativas', 'doing', 'alta', { check: [['Finanças do casal', true], ['Filhos', true], ['Onde morar', false], ['Divisão das tarefas de casa', false]] }],
      ['Planejar cerimônia', 'todo', 'media', { due: 9 }],
      ['Escolher local da cerimônia', 'todo', 'baixa'],
      ['Definir lista de convidados', 'backlog', 'media'],
      ['Contratar fotógrafo', 'backlog', 'baixa'],
    ],
  },
  {
    key: 'e2', ini: 'i1', title: 'Comprar uma casa', area: 'financas', description: 'Conquistar nosso lar',
    tasks: [
      ['Definir orçamento', 'done', 'alta', { done: 6, archived: true }],
      ['Pesquisar bairros', 'done', 'media', { done: 2 }],
      ['Visitar imóveis', 'todo', 'alta', { due: 5, check: [['Listar 5 imóveis', true], ['Agendar visitas', false], ['Levar checklist de vistoria', false]] }],
      ['Simular financiamento', 'backlog', 'alta'],
      ['Separar documentos', 'backlog', 'media'],
      ['Fazer a proposta', 'backlog', 'media'],
    ],
  },
  {
    key: 'e3', ini: 'i1', title: 'Hidratação diária', area: 'saude', description: 'Beber a meta diária de água sem lembrete',
    tasks: [
      ['Descobrir quanto de água preciso por dia', 'done', 'alta', { done: 12, archived: true }],
      ['Semana 1: 500 ml a mais por dia', 'done', 'media', { done: 5, archived: true }],
      ['Semana 2: 1 litro a mais por dia', 'doing', 'media', { check: [['Seg', true], ['Ter', true], ['Qua', true], ['Qui', false], ['Sex', false], ['Sáb', false], ['Dom', false]] }],
      ['Semana 3: atingir a meta diária', 'backlog', 'media'],
    ],
  },
  {
    key: 'e4', ini: 'i2', title: 'Gaita de boca', area: 'lazer', description: 'Tocar uma música inteira',
    tasks: [
      ['Bands, casa 01', 'done', 'baixa', { done: 20, archived: true }],
      ['Bands, casa 03', 'done', 'baixa', { done: 15, archived: true }],
      ['Exercício de embocadura de bico', 'done', 'media', { done: 8, archived: true }],
      ['Música do Red Dead 2', 'done', 'media', { done: 1 }],
    ],
  },
  {
    key: 'e5', ini: 'i3', title: 'Ilíada de Homero', area: 'intelectual', description: 'Ler os 24 cantos',
    tasks: [
      ['Canto 1: a ira de Aquiles', 'done', 'media', { done: 4 }],
      ['Canto 2: o sonho de Agamêmnon e o catálogo das naus', 'doing', 'media', { check: [['Ler', true], ['Anotar personagens', false], ['Discutir no grupo', false]] }],
      ['Canto 3: o duelo de Páris e Menelau', 'todo', 'baixa'],
    ],
  },
  {
    key: 'e6', ini: 'i3', title: 'Catecismo em um ano', area: 'espiritualidade', description: 'Encontros semanais com o grupo de estudos',
    tasks: [
      ['Encontro 08', 'done', 'media', { done: 16, archived: true }],
      ['Encontro 09', 'done', 'media', { done: 3 }],
      ['Lição de casa: 1949 a 2195', 'todo', 'alta', { due: -2 }],
    ],
  },
  {
    key: 'e7', ini: 'i4', title: 'Mentoria', area: 'sociedade', description: 'Acompanhar duas pessoas por 6 meses',
    tasks: [
      ['Marcar a primeira conversa com a Barb', 'todo', 'media', { due: 3 }],
      ['Achar uma ONG para doar tempo', 'backlog', 'baixa'],
    ],
  },
];

export async function seedBacklog(prisma: PrismaClient, userId: string) {
  // Sprints 10 e 11 encerradas; a 12 em andamento, começou há 4 dias (como no protótipo).
  const s10 = await prisma.sprint.create({ data: { userId, number: 10, startAt: ago(32, 0), plannedEnd: ago(19, 0), closedAt: ago(19), doneCount: 7, totalCount: 9 } });
  const s11 = await prisma.sprint.create({ data: { userId, number: 11, startAt: ago(18, 0), plannedEnd: ago(5, 0), closedAt: ago(5), doneCount: 9, totalCount: 10 } });
  const s12 = await prisma.sprint.create({ data: { userId, number: 12, startAt: ago(4, 0), plannedEnd: new Date(ago(4, 0).getTime() + 13 * DAY) } });

  const ini: Record<string, string> = {};
  for (const [position, i] of INITIATIVES.entries()) {
    const { key, ...data } = i;
    const created = await prisma.initiative.create({ data: { ...data, areas: [...data.areas] as never, userId, position, createdAt: ago(40) } });
    ini[key] = created.id;
  }

  let count = 0;
  for (const [position, e] of EPICS.entries()) {
    const epic = await prisma.epic.create({
      data: { userId, initiativeId: ini[e.ini]!, title: e.title, area: e.area as never, description: e.description, position, createdAt: ago(35) },
    });
    for (const [tPos, [title, status, priority, o = {}]] of e.tasks.entries()) {
      const doneAt = status === 'done' ? ago(o.done ?? 3, 8 + (((o.done ?? 3) * 3) % 12)) : null;
      const sprintId = status === 'backlog' ? null : o.archived ? (o.done! > 19 ? s10.id : s11.id) : s12.id;
      await prisma.task.create({
        data: {
          userId,
          epicId: epic.id,
          title,
          status,
          priority,
          position: tPos,
          dueDate: o.due !== undefined ? dateIn(o.due) : null,
          createdAt: ago(o.created ?? 30),
          doneAt,
          archivedAt: o.archived ? (o.done! > 19 ? ago(19) : ago(5)) : null,
          sprintId,
          checklist: { create: (o.check ?? []).map(([text, done], p) => ({ text, done, position: p })) },
          logs: { create: [{ text: 'Tarefa criada', createdAt: ago(o.created ?? 30) }] },
        },
      });
      count++;
    }
  }
  return { initiatives: INITIATIVES.length, epics: EPICS.length, tasks: count };
}
