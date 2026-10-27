import {
  type AreaId,
  type BacklogImportResult,
  type BacklogRow,
  normalize,
  parseAreas,
  parseDateBr,
  parsePriority,
  parseStatus,
  parseYes,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from '@circle/shared';
import { Injectable } from '@nestjs/common';
import type { Priority, TaskStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SprintsService } from '../sprints/sprints.service';

const fmtDay = (d: Date | null) => (d ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '');
const key = (s: string) => normalize(s);

type NewTask = { title: string; description: string; dueDate: string | null; status: TaskStatus; priority: Priority; hadStatus: boolean; hadPriority: boolean };
type EpicPlan = { id: string | null; title: string; description: string; area: AreaId | null; areaLine: number; tasks: NewTask[]; hasTasks: boolean };
type IniPlan = { id: string | null; title: string; description: string; areas: AreaId[]; master: boolean; epics: Map<string, EpicPlan> };

/**
 * Exportar e importar o backlog em planilha (modelo do app antigo + colunas do app novo).
 * A importação junta sem duplicar: o que já existe com o mesmo nome (iniciativa;
 * épico dentro da iniciativa; tarefa dentro do épico) fica como está e só entra o que é novo.
 */
@Injectable()
export class BacklogIoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sprints: SprintsService,
  ) {}

  /** Linhas no modelo do app antigo: primeiro as iniciativas, depois os épicos, depois as tarefas. */
  async export(userId: string): Promise<BacklogRow[]> {
    const inis = await this.prisma.initiative.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { epics: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], include: { tasks: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } } } },
    });
    const blank = { epico: '', epicoDescricao: '', tarefa: '', tarefaDescricao: '', previsao: '', status: '', prioridade: '' };
    const iniCols = (i: (typeof inis)[number]) => ({ iniciativa: i.title, iniciativaDescricao: i.description, master: i.isMaster ? 'sim' : '' });
    const rows: BacklogRow[] = [];
    for (const i of inis) rows.push({ area: i.areas.join(', '), ...iniCols(i), ...blank });
    for (const i of inis) for (const e of i.epics) rows.push({ ...blank, area: e.area, ...iniCols(i), epico: e.title, epicoDescricao: e.description });
    for (const i of inis)
      for (const e of i.epics)
        for (const t of e.tasks)
          rows.push({
            area: e.area,
            ...iniCols(i),
            epico: e.title,
            epicoDescricao: e.description,
            tarefa: t.title,
            tarefaDescricao: t.description,
            previsao: fmtDay(t.dueDate),
            status: STATUS_LABEL[t.status],
            prioridade: PRIORITY_LABEL[t.priority],
          });
    return rows;
  }

  /** Com apply=false, só calcula o que vai entrar (prévia); com apply=true, grava. */
  async import(userId: string, rows: BacklogRow[], apply: boolean): Promise<BacklogImportResult> {
    const problemas: BacklogImportResult['problemas'] = [];
    const existing = await this.prisma.initiative.findMany({
      where: { userId },
      include: { epics: { include: { tasks: { select: { title: true } } } } },
    });

    // 1. Monta o plano: a árvore iniciativa → épicos → tarefas, juntando com o que já existe.
    const plan = new Map<string, IniPlan>();
    rows.forEach((r, idx) => {
      const linha = idx + 2; // linha 1 é o cabeçalho
      const ini = r.iniciativa.trim();
      const ep = r.epico.trim();
      const task = r.tarefa.trim();
      if (!ini && !ep && !task) return;
      if (!ini) return problemas.push({ linha, motivo: 'Sem nome de iniciativa.' });
      if (task && !ep) return problemas.push({ linha, motivo: `A tarefa “${task}” está sem épico.` });

      const { areas, unknown } = parseAreas(r.area);
      if (unknown.length) problemas.push({ linha, motivo: `Área não reconhecida: ${unknown.join(', ')}.` });

      let p = plan.get(key(ini));
      if (!p) {
        const found = existing.find(x => key(x.title) === key(ini));
        p = { id: found?.id ?? null, title: found?.title ?? ini, description: found?.description ?? '', areas: found ? [...found.areas] : [], master: found?.isMaster ?? false, epics: new Map() };
        if (found) for (const e of found.epics) p.epics.set(key(e.title), { id: e.id, title: e.title, description: e.description, area: e.area, areaLine: 0, tasks: [], hasTasks: e.tasks.length > 0 });
        plan.set(key(ini), p);
      }
      if (!p.id) {
        if (!p.description && r.iniciativaDescricao.trim()) p.description = r.iniciativaDescricao.trim();
        if (!ep) for (const a of areas) if (!p.areas.includes(a)) p.areas.push(a);
        if (parseYes(r.master)) p.master = true;
      }
      if (!ep) return;

      let e = p.epics.get(key(ep));
      if (!e) {
        e = { id: null, title: ep, description: r.epicoDescricao.trim(), area: areas[0] ?? null, areaLine: linha, tasks: [], hasTasks: false };
        p.epics.set(key(ep), e);
      } else if (!e.id && !e.area && areas[0]) e.area = areas[0];
      if (!task) return;

      const exists = existing.some(x => key(x.title) === key(ini) && x.epics.some(y => key(y.title) === key(ep) && y.tasks.some(z => key(z.title) === key(task))));
      if (exists || e.tasks.some(t => key(t.title) === key(task))) return void (e.hasTasks = true);
      const dueDate = parseDateBr(r.previsao);
      if (r.previsao.trim() && !dueDate) problemas.push({ linha, motivo: `Data inválida em “${task}”: ${r.previsao} (use dd/mm/aaaa). A tarefa entra sem prazo.` });
      const status = parseStatus(r.status);
      const priority = parsePriority(r.prioridade);
      e.tasks.push({
        title: task.slice(0, 200),
        description: r.tarefaDescricao.trim(),
        dueDate,
        status: status ?? 'backlog',
        priority: priority ?? 'media',
        hadStatus: Boolean(status),
        hadPriority: Boolean(priority),
      });
      e.hasTasks = true;
    });

    // Épico novo sem área: usa a primeira área da iniciativa; se não houver nenhuma, não dá para criar.
    for (const p of plan.values())
      for (const [k, e] of p.epics)
        if (!e.id && !e.area) {
          if (p.areas[0]) e.area = p.areas[0];
          else {
            problemas.push({ linha: e.areaLine, motivo: `O épico “${e.title}” está sem área da vida e foi ignorado.` });
            p.epics.delete(k);
          }
        }

    // 2. Resumo (o mesmo na prévia e depois de gravar).
    const all = [...plan.values()];
    const newInis = all.filter(p => !p.id);
    const newEpics = all.flatMap(p => [...p.epics.values()].filter(e => !e.id));
    const newTasks = all.flatMap(p => [...p.epics.values()].flatMap(e => e.tasks));
    const touchedEpics = all.flatMap(p => [...p.epics.values()]).filter(e => !e.id || e.tasks.length);
    const result: BacklogImportResult = {
      applied: false,
      iniciativas: { novas: newInis.length, existentes: all.length - newInis.length },
      epicos: { novos: newEpics.length, existentes: touchedEpics.length - newEpics.length },
      tarefas: { novas: newTasks.length, existentes: 0 },
      problemas,
      faltando: {
        tarefasSemStatus: newTasks.filter(t => !t.hadStatus).length,
        tarefasSemPrioridade: newTasks.filter(t => !t.hadPriority).length,
        tarefasSemPrazo: newTasks.filter(t => !t.dueDate).length,
        tarefasSemDescricao: newTasks.filter(t => !t.description).length,
        semObjetivoMaster: !all.some(p => p.master) && !existing.some(x => x.isMaster),
        iniciativasSemEpico: newInis.filter(p => p.epics.size === 0).map(p => p.title),
        epicosSemTarefa: newEpics.filter(e => !e.hasTasks).map(e => e.title),
      },
    };
    result.tarefas.existentes = rows.filter(r => r.tarefa.trim() && r.epico.trim() && r.iniciativa.trim()).length - newTasks.length;
    if (!apply || (!newInis.length && !newEpics.length && !newTasks.length)) return result;

    // 3. Grava tudo de uma vez (poucas idas ao banco, por isso as tarefas vão em lote).
    await this.prisma.$transaction(
      async tx => {
        const needsSprint = newTasks.some(t => t.status === 'todo' || t.status === 'doing');
        const sprint = needsSprint ? await this.sprints.current(userId, tx) : null;
        let iniPos = await tx.initiative.count({ where: { userId } });
        const now = new Date();
        for (const p of all) {
          if (!p.id) {
            const created = await tx.initiative.create({
              data: { userId, title: p.title.slice(0, 200), description: p.description, areas: p.areas, isMaster: p.master, position: iniPos++ },
            });
            p.id = created.id;
          }
          let epicPos = await tx.epic.count({ where: { initiativeId: p.id } });
          for (const e of p.epics.values()) {
            if (!e.id) {
              const created = await tx.epic.create({ data: { userId, initiativeId: p.id, title: e.title.slice(0, 200), description: e.description, area: e.area!, position: epicPos++ } });
              e.id = created.id;
            }
            if (!e.tasks.length) continue;
            const taskPos = await tx.task.count({ where: { epicId: e.id } });
            const created = await tx.task.createManyAndReturn({
              data: e.tasks.map((t, j) => ({
                userId,
                epicId: e.id!,
                title: t.title,
                description: t.description,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(`${t.dueDate}T12:00:00Z`) : null,
                status: t.status,
                position: taskPos + j,
                sprintId: t.status === 'todo' || t.status === 'doing' ? sprint!.id : null,
                // Concluídas na planilha entram como já entregues (fora do quadro), sem gerar XP.
                doneAt: t.status === 'done' ? now : null,
                archivedAt: t.status === 'done' ? now : null,
              })),
              select: { id: true },
            });
            await tx.taskLog.createMany({ data: created.map(c => ({ taskId: c.id, text: 'Importada da planilha' })) });
          }
        }
      },
      { timeout: 55_000, maxWait: 10_000 },
    );
    return { ...result, applied: true };
  }
}
