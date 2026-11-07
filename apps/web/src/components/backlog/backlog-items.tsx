'use client';

import { AREA, type BacklogDto, type EpicDto, type TaskDto } from '@circle/shared';
import { useState } from 'react';
import { useCelebrate } from '@/components/celebrate';
import { Icon } from '@/components/icon';
import { AreaIcon, AreaIcons, Bar, IconBtn, MANY_AREAS, Prio, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { PublishSheet } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { epicTasks, progress, useBacklogActions } from '@/lib/backlog';
import { tint } from '@/lib/color';
import { Reorderable } from './reorderable';
import { useSelection } from './selection';
import { useBacklogSheets } from './use-backlog-sheets';

/**
 * Linha de tarefa do backlog: bolinha de selecionar (as ações em massa ficam na barra
 * de baixo; concluir uma tarefa só é feito pelo quadro ou pelo detalhe), título,
 * prioridade e menu.
 */
export function TaskLine({ t, last }: { t: TaskDto; last?: boolean }) {
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const sel = useSelection();
  const { openActions } = useSheets();
  const toast = useToast();
  const done = t.status === 'done';
  const on = sel.has(t.id);
  return (
    <div className={`relative flex items-center gap-3 py-3.5 ${on ? '-mx-2 rounded-xl bg-primary/5 px-2' : ''}`}>
      {!last && <span className="absolute bottom-[-14px] left-[0.6875rem] top-[2.375rem] w-px bg-line" />}
      <button
        onClick={() => sel.toggle(t.id)}
        aria-label={on ? 'Desmarcar tarefa' : 'Selecionar tarefa'}
        aria-pressed={on}
        className={`relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
          on ? 'border-primary bg-primary text-onprimary' : 'border-muted/50 bg-surface hover:border-primary'
        }`}
      >
        {on && <Icon n="check" className="h-3.5 w-3.5" sw={3} />}
      </button>
      <button onClick={() => sheets.openTaskDetail(t.id)} className="min-w-0 flex-1 text-left">
        <span className={`block text-[0.9375rem] leading-snug ${done ? 'text-ink/60 line-through' : ''}`}>{t.title}</span>
        {(t.status === 'todo' || t.status === 'doing') && (
          <span className="text-[0.6875rem] font-semibold text-blue-600">{t.status === 'doing' ? 'Fazendo agora' : 'Na sprint'}</span>
        )}
        {done && <span className="text-[0.6875rem] font-semibold text-primary">Pronta</span>}
      </button>
      <Prio p={t.priority} />
      <button
        aria-label="Opções da tarefa"
        onClick={() =>
          openActions(t.title, [
            t.status === 'backlog'
              ? { icon: 'board', label: 'Puxar para a sprint', run: () => actions.moveTask(t.id, 'todo').then(r => r && toast('Tarefa na sprint atual')) }
              : !done && { icon: 'backlog', label: 'Voltar para o backlog', run: () => actions.moveTask(t.id, 'backlog') },
            { icon: 'checkSq', label: 'Abrir detalhes', run: () => sheets.openTaskDetail(t.id) },
            { icon: 'edit', label: 'Editar', run: () => sheets.openTask({ id: t.id }) },
            { icon: 'copy', label: 'Duplicar', run: () => actions.duplicateTask(t.id).then(() => toast('Tarefa duplicada')) },
            {
              icon: 'trash',
              label: 'Excluir',
              danger: true,
              run: () => sheets.confirmDelete('Excluir tarefa', `“${t.title}” será excluída. Não dá para desfazer.`, () => actions.deleteTask(t.id)),
            },
          ])
        }
        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunk"
      >
        <Icon n="more" sw={2.6} />
      </button>
    </div>
  );
}

/** Cartão de épico: área, progresso e (aberto) as tarefas e ações. */
export function EpicCard({ e, data, nested, showIni, reorder }: { e: EpicDto; data: BacklogDto; nested?: boolean; showIni?: boolean; reorder?: boolean }) {
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const { openActions, openSheet } = useSheets();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [open, setOpen] = useState(Boolean(nested && !e.closedAt));
  const [all, setAll] = useState(false);
  const ts = epicTasks(data, e.id);
  const pr = progress(ts);
  const a = AREA[e.area];
  const shown = all ? ts : ts.slice(0, 5);

  const close = async () => {
    const r = await actions.closeEpic(e.id);
    celebrate({ icon: 'trophy', title: `Épico concluído: ${r.epic.title}`, text: `${r.doneTasks} tarefas entregues.`, xp: r.xp.gained, area: r.epic.area, refType: 'epic', refId: r.epic.id });
  };

  return (
    <div id={`epico-${e.id}`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-line/80 bg-surface shadow-soft transition">
      <div className="flex items-start gap-3 p-4">
        {e.areas.length >= MANY_AREAS ? (
          <AreaIcon areas={e.areas} size="h-14 w-14" rounded="rounded-2xl" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: tint(a.color, 0.12), color: a.color }}>
            <Icon n={a.icon} className="h-7 w-7" sw={1.6} />
          </span>
        )}
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          {showIni && <p className="truncate text-xs text-muted">{data.initiatives.find(i => i.id === e.initiativeId)?.title}</p>}
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[1.125rem] font-semibold">{e.title}</span>
            <Tag c={a.color}>Épico</Tag>
            {e.areas.length > 1 && e.areas.length < MANY_AREAS && <AreaIcons areas={e.areas} />}
            {e.closedAt && <Tag>Encerrado</Tag>}
          </p>
          {e.description && <p className="mt-0.5 text-sm text-muted">{e.description}</p>}
          <div className="mt-2.5 flex items-center gap-3">
            <span className="whitespace-nowrap text-sm tabular-nums text-muted">
              {pr.done}/{pr.total} tarefas
            </span>
            <div className="min-w-[3rem] flex-1">
              <Bar pct={pr.pct} color={a.color} className="h-2" />
            </div>
            <span className="text-sm tabular-nums text-muted">{Math.round(pr.pct * 100)}%</span>
          </div>
        </button>
        <IconBtn n={open ? 'chevU' : 'chevD'} label={open ? 'Recolher' : 'Expandir'} className="-mr-1 h-8 w-8 text-muted" onClick={() => setOpen(!open)} />
      </div>
      {open && (
        <div className="border-t border-line px-4 pb-3">
          {reorder && (all || ts.length <= 5) && ts.length > 1 ? (
            <Reorderable items={shown} enabled onReorder={ids => actions.reorder('task', ids)} className="divide-y divide-line">
              {t => <TaskLine t={t} last />}
            </Reorderable>
          ) : (
            <div className="divide-y divide-line">
              {shown.map((t, i) => (
                <TaskLine key={t.id} t={t} last={i === shown.length - 1} />
              ))}
            </div>
          )}
          {ts.length === 0 && <p className="py-3 text-sm text-muted">Nenhuma tarefa ainda.</p>}
          {ts.length > 5 && (
            <button onClick={() => setAll(!all)} className="inline-flex w-full items-center justify-center gap-1 py-2 text-sm font-medium" style={{ color: a.color }}>
              {all ? 'Mostrar menos' : `Ver todas as ${ts.length} tarefas`}
              <Icon n={all ? 'chevU' : 'chevD'} className="h-4 w-4" />
            </button>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {!e.closedAt && (
              <Button variant="ghost" className="px-2.5 py-1.5 text-primary" onClick={() => sheets.openTask({ epicId: e.id })}>
                <Icon n="plus" className="h-4 w-4" />
                Tarefa
              </Button>
            )}
            <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => sheets.openEpic({ id: e.id })}>
              <Icon n="edit" className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="ghost"
              className="px-2.5 py-1.5"
              aria-label="Mais opções do épico"
              onClick={() =>
                openActions(e.title, [
                  { icon: 'copy', label: 'Duplicar épico', run: () => actions.duplicateEpic(e.id).then(() => toast('Épico duplicado')) },
                  e.closedAt && { icon: 'undo', label: 'Reabrir épico', run: () => actions.reopenEpic(e.id) },
                  { icon: 'share', label: 'Publicar como trilha', run: () => openSheet(close => <PublishSheet epicId={e.id} onClose={close} />) },
                  {
                    icon: 'trash',
                    label: 'Excluir épico',
                    danger: true,
                    run: () =>
                      sheets.confirmDelete('Excluir épico', `“${e.title}” e as ${ts.length} tarefas dele serão excluídos. Não dá para desfazer.`, () =>
                        actions.deleteEpic(e.id),
                      ),
                  },
                ])
              }
            >
              <Icon n="more" className="h-4 w-4" sw={2.6} />
            </Button>
            {!e.closedAt && pr.total > 0 && pr.done === pr.total && (
              <Button className="ml-auto px-3 py-1.5" onClick={close} disabled={actions.busy}>
                <Icon n="trophy" className="h-4 w-4" />
                Encerrar épico
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
