'use client';

import { BOARD_LOCKED_MESSAGE, type AreaId, type BacklogDto, type EpicDto, type InitiativeDto, type TaskDto, type TaskStatus, type XpChange } from '@circle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { SharePrompt } from '@/components/feed/post-form';
import { BoardLockedSheet } from '@/components/journey';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError, type Me } from './api';
import { socialLocked } from './journey';

export const BACKLOG_KEY = ['backlog'];

/** Backlog completo (iniciativas, épicos e tarefas) da pessoa logada. */
export function useBacklog() {
  return useQuery({ queryKey: BACKLOG_KEY, queryFn: () => api<BacklogDto>('/backlog') });
}

// ---------- Seletores (iguais aos do protótipo) ----------

/** Ordem salva (quando a pessoa arrastou) ou, se ninguém reordenou, ordem alfabética. */
export function sortByOrder<T extends { position: number; title: string }>(items: T[]): T[] {
  const custom = items.some(i => i.position > 0);
  const key = (p: number) => (p > 0 ? p : Infinity); // itens novos (0) vão para o fim da ordem manual
  return [...items].sort((a, b) => (custom ? key(a.position) - key(b.position) : 0) || a.title.localeCompare(b.title, 'pt-BR'));
}

export const epicTasks = (b: BacklogDto, epicId: string) => sortByOrder(b.tasks.filter(t => t.epicId === epicId));
export const initEpics = (b: BacklogDto, initiativeId: string) => sortByOrder(b.epics.filter(e => e.initiativeId === initiativeId));
/** Áreas da tarefa: as próprias ou, se nenhuma foi escolhida, as áreas do épico. */
export const taskAreas = (b: BacklogDto, t: TaskDto): AreaId[] => {
  if (t.areas.length) return t.areas;
  const ep = b.epics.find(e => e.id === t.epicId);
  return ep ? (ep.areas.length ? ep.areas : [ep.area]) : [];
};
/** Área principal da tarefa (a primeira), para quando só cabe uma cor/ícone. */
export const taskArea = (b: BacklogDto, t: TaskDto): AreaId | undefined => taskAreas(b, t)[0];
export const progress = (list: TaskDto[]) => {
  const done = list.filter(t => t.status === 'done').length;
  return { done, total: list.length, pct: list.length ? done / list.length : 0 };
};

// ---------- Ações ----------

type Body = Record<string, unknown>;

/**
 * Todas as ações do backlog. Depois de cada uma, os dados são recarregados
 * (backlog, quadro…) e erros da API aparecem como aviso na tela.
 */
export function useBacklogActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const { openSheet } = useSheets();
  const mutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: Body }) => api<any>(path, { method, body }),
    onSuccess: (data: { xp?: XpChange } | undefined) => {
      // Ações que mexem no XP devolvem os totais novos: o número aparece atualizado na hora.
      if (data?.xp) qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: data.xp!.total, gems: data.xp!.gems } });
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      qc.invalidateQueries({ queryKey: ['sprints'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
    onError: e => {
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      // Quadro trancado pela Jornada: explica numa folha, em vez de um aviso rápido.
      if (e instanceof ApiError && e.message === BOARD_LOCKED_MESSAGE) openSheet(close => <BoardLockedSheet onClose={close} />);
      else toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
    },
  });
  const run = (path: string, method = 'POST', body?: Body) => mutation.mutateAsync({ path, method, body });

  /** Salva a ordem (arrastar) ou volta pra A–Z (reset). Atualiza a tela na hora. */
  const reorder = (type: 'initiative' | 'epic' | 'task', ids: string[], reset = false) => {
    qc.setQueryData<BacklogDto>(BACKLOG_KEY, b => {
      if (!b) return b;
      const pos = new Map(ids.map((id, i) => [id, reset ? 0 : i + 1]));
      const fix = <T extends { id: string; position: number }>(x: T) => (pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x);
      return type === 'initiative'
        ? { ...b, initiatives: b.initiatives.map(fix) }
        : type === 'epic'
          ? { ...b, epics: b.epics.map(fix) }
          : { ...b, tasks: b.tasks.map(fix) };
    });
    return run('/backlog/order', 'PUT', { type, ids, reset });
  };

  return {
    busy: mutation.isPending,
    reorder,
    createInitiative: (b: Body) => run('/initiatives', 'POST', b) as Promise<InitiativeDto>,
    updateInitiative: (id: string, b: Body) => run(`/initiatives/${id}`, 'PATCH', b) as Promise<InitiativeDto>,
    deleteInitiative: (id: string) => run(`/initiatives/${id}`, 'DELETE'),
    duplicateInitiative: (id: string) => run(`/initiatives/${id}/duplicate`) as Promise<InitiativeDto>,
    completeInitiative: (id: string) => run(`/initiatives/${id}/complete`) as Promise<{ initiative: InitiativeDto; doneTasks: number; xp: XpChange }>,
    reopenInitiative: (id: string) => run(`/initiatives/${id}/reopen`),

    createEpic: (b: Body) => run('/epics', 'POST', b) as Promise<EpicDto>,
    updateEpic: (id: string, b: Body) => run(`/epics/${id}`, 'PATCH', b) as Promise<EpicDto>,
    deleteEpic: (id: string) => run(`/epics/${id}`, 'DELETE'),
    duplicateEpic: (id: string) => run(`/epics/${id}/duplicate`) as Promise<EpicDto>,
    closeEpic: (id: string) => run(`/epics/${id}/close`) as Promise<{ epic: EpicDto; doneTasks: number; xp: XpChange }>,
    reopenEpic: (id: string) => run(`/epics/${id}/reopen`),

    createTask: (b: Body) => run('/tasks', 'POST', b) as Promise<TaskDto>,
    updateTask: (id: string, b: Body) => run(`/tasks/${id}`, 'PATCH', b) as Promise<TaskDto>,
    deleteTask: (id: string) => run(`/tasks/${id}`, 'DELETE'),
    duplicateTask: (id: string) => run(`/tasks/${id}/duplicate`) as Promise<TaskDto>,
    addToCalendar: (id: string) => run(`/tasks/${id}/calendar`, 'POST') as Promise<TaskDto>,
    removeFromCalendar: (id: string) => run(`/tasks/${id}/calendar`, 'DELETE') as Promise<TaskDto>,
    /** Ações em massa nas tarefas selecionadas. Em caso de erro (já mostrado na tela), devolve null. */
    bulkTasks: (ids: string[], action: 'sprint' | 'done' | 'delete') =>
      (run('/tasks/bulk', 'POST', { ids, action }) as Promise<{ count: number; offSprint: boolean; warn: boolean; xp: XpChange }>).catch(() => null),
    moveTask: (id: string, status: TaskStatus) => {
      // Atualiza a tela na hora (sem esperar a API), para o arrastar ficar fluido.
      qc.setQueryData<BacklogDto>(BACKLOG_KEY, b =>
        b && { ...b, tasks: b.tasks.map(t => (t.id === id ? { ...t, status, archivedAt: null, doneAt: status === 'done' ? new Date().toISOString() : null } : t)) },
      );
      return (run(`/tasks/${id}/move`, 'POST', { status }) as Promise<{ task: TaskDto; from: TaskStatus; xp: XpChange; offSprint: boolean; warn: boolean }>).then(r => {
        if (r.offSprint) {
          // Concluída sem sprint iniciada: sem XP e sem "Quer compartilhar?". O aviso aparece só na 1ª vez em cada intervalo.
          if (r.warn) openSheet(close => <OffSprintNotice onClose={close} />);
        } else if (status === 'done' && r.from !== 'done' && socialLocked(qc.getQueryData<Me>(['me']))) {
          // Rede social trancada (Jornada): sem "Quer compartilhar?", só o XP.
          toast(r.xp.gained > 0 ? `Tarefa concluída, +${r.xp.gained} XP` : 'Tarefa concluída');
        } else if (status === 'done' && r.from !== 'done') {
          // Sempre pergunta se quer compartilhar a conclusão (decisão do dono do projeto).
          const b = qc.getQueryData<BacklogDto>(BACKLOG_KEY);
          const area = (r.task.areas[0] ?? (b && b.epics.find(e => e.id === r.task.epicId)?.area)) ?? null;
          openSheet(close => <SharePrompt draft={{ title: r.task.title, text: '', area, refType: 'task', refId: r.task.id }} xp={r.xp.gained} onClose={close} />);
        } else if (r.xp.gained > 0) toast(`Tarefa concluída, +${r.xp.gained} XP`);
        return r;
      }, () => null); // O erro já aparece na tela (onError); quem chamou recebe null.
    },
  };
}

/** Aviso: concluir tarefa sem sprint iniciada não rende XP nem vira post. */
export function OffSprintNotice({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Nenhuma sprint em andamento" onClose={onClose}>
      <p className="text-[0.9375rem] leading-relaxed text-ink/85">
        A tarefa foi concluída, mas sem uma sprint iniciada ela <strong>não rende XP</strong> e não pergunta se você quer compartilhar. Quando você
        iniciar a sprint, as tarefas concluídas antes saem do quadro.
      </p>
      <p className="mt-2 text-sm text-muted">Este aviso aparece só uma vez até a próxima sprint.</p>
      <div className="mt-5 flex gap-2">
        <Button variant="line" className="flex-1" onClick={onClose}>
          Entendi
        </Button>
        <Link href="/sprint" onClick={onClose} className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-onprimary">
          Iniciar sprint
        </Link>
      </div>
    </Sheet>
  );
}
