'use client';

import { SPRINT_DAYS, type BacklogDto } from '@circle/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { useBacklog } from '@/lib/backlog';
import { fmtShort, useCloseSprint, useSprints } from '@/lib/sprints';

/** Tarefas que estão no quadro: A Fazer, Fazendo e Pronto, ainda não arquivadas. */
export const boardTasks = (b: BacklogDto) => b.tasks.filter(t => (t.status === 'todo' || t.status === 'doing' || t.status === 'done') && !t.archivedAt);

/** Folha da sprint: resumo, sprints anteriores e "Encerrar sprint". */
export function SprintSheet({ onClose }: { onClose: () => void }) {
  const { data: sprints } = useSprints();
  const { data } = useBacklog();
  const close = useCloseSprint();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  if (!sprints || !data) return null;

  const b = boardTasks(data);
  const done = b.filter(t => t.status === 'done').length;
  const open = b.length - done;
  const full = b.length > 0 && open === 0;
  const s = sprints.current;

  const finish = async () => {
    const r = await close.mutateAsync();
    onClose();
    toast(
      `Sprint ${r.closed.number} concluída: ${r.done} ${r.done === 1 ? 'tarefa entregue' : 'tarefas entregues'}${
        r.open ? `, ${r.open} ${r.open === 1 ? 'voltou' : 'voltaram'} ao backlog` : ''
      }`,
    );
  };

  return (
    <Sheet
      title={`Sprint ${s.number}`}
      onClose={onClose}
      footer={
        !confirm ? (
          <Button className="flex-1" onClick={() => setConfirm(true)}>
            Encerrar sprint
          </Button>
        ) : (
          <>
            <Button variant="line" className="flex-1" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={close.isPending} onClick={finish}>
              Confirmar encerramento
            </Button>
          </>
        )
      }
    >
      <p className="text-sm text-muted">
        {fmtShort(s.startAt)} a {fmtShort(s.plannedEnd)}, {SPRINT_DAYS} dias
      </p>
      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-sunk p-4">
          <p className="text-3xl font-bold tabular-nums">{done}</p>
          <p className="text-sm text-muted">prontas</p>
        </div>
        <div className="rounded-2xl bg-sunk p-4">
          <p className="text-3xl font-bold tabular-nums">{open}</p>
          <p className="text-sm text-muted">em aberto</p>
        </div>
      </div>
      {confirm ? (
        <p className="text-sm leading-relaxed">
          As tarefas prontas saem do quadro e vão para os relatórios. As em aberto voltam para o backlog.
          {full ? ' Sprint completa: todas as tarefas prontas.' : ''}
        </p>
      ) : (
        <>
          <h3 className="mb-2 font-semibold">Sprints anteriores</h3>
          <div className="divide-y divide-line">
            {sprints.history.map(h => (
              <div key={h.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-20 font-semibold">Sprint {h.number}</span>
                <span className="flex-1 text-muted">
                  {fmtShort(h.startAt)} a {fmtShort(h.closedAt ?? h.plannedEnd)}
                </span>
                <span className="tabular-nums">
                  {h.doneCount}/{h.totalCount}
                </span>
              </div>
            ))}
            {!sprints.history.length && <p className="py-2 text-sm text-muted">Esta é a sua primeira sprint.</p>}
          </div>
          <Link href="/necrologio" onClick={onClose} className="mt-4 block w-full rounded-2xl border border-accent/20 bg-accent/5 p-4 text-left">
            <p className="font-semibold text-accent">Antes da próxima planning</p>
            <p className="mt-0.5 text-sm text-muted">Releia o seu necrológio e veja se o backlog ainda conversa com ele.</p>
          </Link>
        </>
      )}
    </Sheet>
  );
}
