'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { OffSprintNotice, useBacklogActions } from '@/lib/backlog';
import { useBacklogSheets } from './use-backlog-sheets';

/**
 * Seleção de tarefas no backlog (decisão do dono de 04/11/2026): a bolinha da tarefa
 * seleciona (não conclui mais). Com tarefas selecionadas, aparece uma barra com as
 * ações em massa: enviar para a sprint, concluir e excluir.
 */
type Selection = { ids: Set<string>; has: (id: string) => boolean; toggle: (id: string) => void; clear: () => void };

const SelectionContext = createContext<Selection | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const toggle = useCallback(
    (id: string) =>
      setIds(s => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  const clear = useCallback(() => setIds(new Set()), []);
  const value = useMemo(() => ({ ids, has: (id: string) => ids.has(id), toggle, clear }), [ids, toggle, clear]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection precisa estar dentro do SelectionProvider');
  return ctx;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Barra fixa embaixo com as ações em massa (aparece quando há tarefas selecionadas). */
export function BulkBar() {
  const sel = useSelection();
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const { openSheet } = useSheets();
  const toast = useToast();
  const n = sel.ids.size;
  if (!n) return null;
  const ids = [...sel.ids];

  const toSprint = () =>
    actions.bulkTasks(ids, 'sprint').then(r => {
      if (!r) return;
      sel.clear();
      toast(r.count ? `${plural(r.count, 'tarefa enviada', 'tarefas enviadas')} para a sprint` : 'As tarefas selecionadas já estavam na sprint.');
    });
  const conclude = () =>
    actions.bulkTasks(ids, 'done').then(r => {
      if (!r) return;
      sel.clear();
      if (r.offSprint && r.warn) openSheet(close => <OffSprintNotice onClose={close} />);
      else toast(`${plural(r.count, 'tarefa concluída', 'tarefas concluídas')}${r.xp.gained > 0 ? `, +${r.xp.gained} XP` : ''}`);
    });
  const remove = () =>
    sheets.confirmDelete(`Excluir ${plural(n, 'tarefa', 'tarefas')}?`, `${n === 1 ? 'A tarefa selecionada será excluída' : `As ${n} tarefas selecionadas serão excluídas`}. Não dá para desfazer.`, () =>
      actions.bulkTasks(ids, 'delete').then(r => {
        if (!r) return;
        sel.clear();
        toast(`${plural(r.count, 'tarefa excluída', 'tarefas excluídas')}`);
      }),
    );

  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}>
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-2.5 shadow-xl">
        <div className="flex items-center gap-2 px-1 pb-2">
          <span className="flex-1 text-sm font-semibold">{plural(n, 'tarefa selecionada', 'tarefas selecionadas')}</span>
          <button onClick={sel.clear} className="text-sm font-semibold text-primary">
            Limpar
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button className="px-2 py-2 text-[0.8125rem]" disabled={actions.busy} onClick={toSprint}>
            <Icon n="board" className="h-4 w-4" />
            Para a sprint
          </Button>
          <Button variant="line" className="px-2 py-2 text-[0.8125rem]" disabled={actions.busy} onClick={conclude}>
            <Icon n="check" className="h-4 w-4" />
            Concluir
          </Button>
          <Button variant="line" className="px-2 py-2 text-[0.8125rem] !text-red-600" disabled={actions.busy} onClick={remove}>
            <Icon n="trash" className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
