'use client';

import { AREA, AREAS, isLate, sprintName, type AreaId, type TaskDto, type TaskStatus } from '@circle/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useBacklogSheets } from '@/components/backlog/use-backlog-sheets';
import { Header, useGoBack } from '@/components/header';
import { BoardLocked } from '@/components/journey';
import { useBoardLocked, useJourney } from '@/lib/journey';
import { Icon } from '@/components/icon';
import { AreaIcon, AreaIcons, Bar, Card, IconBtn, inputCls, Prio } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { taskAreas, useBacklog, useBacklogActions } from '@/lib/backlog';
import { boardTasks, fmtDay, sprintPeriod, useSprints } from '@/lib/sprints';

const COLS: { id: 'todo' | 'doing' | 'done'; label: string; c: string }[] = [
  { id: 'todo', label: 'A Fazer', c: '#9ca3af' },
  { id: 'doing', label: 'Fazendo', c: '#3b82f6' },
  { id: 'done', label: 'Pronto', c: 'rgb(var(--p))' },
];

type Drag = { id: string; from: TaskStatus; x: number; y: number; offX: number; offY: number; w: number; over: string | null };

/** Quadro Kanban da sprint atual: A Fazer, Fazendo e Pronto, com arrastar e soltar (como no protótipo). */
export default function BoardPage() {
  const { data } = useBacklog();
  const { data: sprints } = useSprints();
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const { openActions } = useSheets();
  const router = useRouter();
  const goBack = useGoBack('/feed');
  const [view, setView] = useState<'quadro' | 'lista'>('quadro');
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(false);
  const [showLate, setShowLate] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragging = useRef(false);
  const locked = useBoardLocked();
  const { data: journey } = useJourney();

  // Enquanto arrasta no celular, a página não rola.
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };
    window.addEventListener('touchmove', block, { passive: false });
    return () => window.removeEventListener('touchmove', block);
  }, []);

  const tasks = data ? boardTasks(data).filter(t => (area === 'all' || taskAreas(data, t).includes(area)) && (!q || t.title.toLowerCase().includes(q.toLowerCase()))) : [];
  const late = data ? data.tasks.filter(t => !t.archivedAt && isLate(t)) : [];
  const epicOf = (t: TaskDto) => data?.epics.find(e => e.id === t.epicId);

  const openTask = (id: string) => sheets.openTaskDetail(id);
  const setStatus = (id: string, status: TaskStatus) => actions.moveTask(id, status);

  const overCol = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-col]') as HTMLElement | null)?.dataset.col ?? null;

  /** Toque/clique no cartão: no mouse arrasta ao mover; no toque, segurar ~0,3s ativa o arrastar. */
  const start = (e: ReactPointerEvent<HTMLElement>, t: TaskDto) => {
    if (e.button && e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const st = { x0: e.clientX, y0: e.clientY, active: false, timer: 0 as unknown as ReturnType<typeof setTimeout> };
    const base = { id: t.id, from: t.status, offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width };
    const mouse = e.pointerType === 'mouse';
    const activate = () => {
      st.active = true;
      dragging.current = true;
      setDrag({ ...base, x: st.x0, y: st.y0, over: t.status });
      navigator.vibrate?.(10);
    };
    if (!mouse) st.timer = setTimeout(activate, 260);
    const move = (ev: PointerEvent) => {
      if (!st.active) {
        const dist = Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0);
        if (mouse && dist > 6) activate();
        else if (!mouse && dist > 10) {
          clearTimeout(st.timer);
          cleanup();
        }
        return;
      }
      setDrag(d => d && { ...d, x: ev.clientX, y: ev.clientY, over: overCol(ev.clientX, ev.clientY) });
    };
    const end = (ev: PointerEvent) => {
      clearTimeout(st.timer);
      cleanup();
      if (st.active) {
        const c = overCol(ev.clientX, ev.clientY);
        if (c && c !== t.status) setStatus(t.id, c as TaskStatus);
        dragging.current = false;
        setDrag(null);
      } else if (ev.type === 'pointerup' && Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) < 10) openTask(t.id);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const cardMenu = (t: TaskDto) =>
    openActions(t.title, [
      ...COLS.filter(c => c.id !== t.status).map(c => ({ icon: 'chevR' as const, label: `Mover para ${c.label}`, run: () => setStatus(t.id, c.id) })),
      { icon: 'backlog', label: 'Voltar para o backlog', run: () => setStatus(t.id, 'backlog') },
      { icon: 'edit', label: 'Editar', run: () => sheets.openTask({ id: t.id }) },
    ]);

  const areaFilter = () =>
    openActions('Filtrar por área da vida', [
      { icon: 'grid', label: 'Todas as áreas', run: () => setArea('all') },
      ...AREAS.map(a => ({ icon: a.icon as never, label: a.name, run: () => setArea(a.id) })),
    ]);

  const renderCard = (t: TaskDto, ghost?: boolean) => {
    const areas = data ? taskAreas(data, t) : [];
    const ck = t.checklist;
    const ckp = ck.total ? ck.done / ck.total : 0;
    const isLateNow = isLate(t);
    return (
      <article
        key={t.id}
        onPointerDown={ghost ? undefined : e => start(e, t)}
        style={{ touchAction: 'pan-y' }}
        className={`relative select-none rounded-2xl border border-line/80 bg-surface p-3 shadow-soft ${ghost ? 'rotate-[4deg] shadow-xl' : 'cursor-grab'} ${
          drag?.id === t.id && !ghost ? 'opacity-30' : ''
        }`}
      >
        <div className="flex items-start gap-1">
          <p className={`flex-1 text-[0.875rem] font-medium leading-snug ${t.status === 'done' ? 'text-ink/70' : ''}`}>{t.title}</p>
          {t.status === 'done' ? (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-onprimary">
              <Icon n="check" className="h-3.5 w-3.5" sw={3} />
            </span>
          ) : (
            !ghost && (
              <button
                aria-label="Opções da tarefa"
                onPointerDown={e => e.stopPropagation()}
                onClick={() => cardMenu(t)}
                className="-mr-1.5 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunk"
              >
                <Icon n="moreV" className="h-4 w-4" sw={2.4} />
              </button>
            )
          )}
        </div>
        <div className="mt-2">
          <Prio p={t.priority} />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[0.75rem] text-muted">
          {ck.total > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Icon n="checkSq" className="h-3.5 w-3.5" />
              {ck.done}/{ck.total}
            </span>
          )}
          {areas.length > 0 && (
            <span className="ml-auto flex">
              <AreaIcons areas={areas} />
            </span>
          )}
        </div>
        {t.dueDate && (
          <p className={`mt-1.5 flex items-center gap-1 text-[0.6875rem] ${isLateNow ? 'font-semibold text-red-600' : 'text-muted'}`}>
            <Icon n="calendar" className="h-3 w-3" />
            {fmtDay(t.dueDate + 'T12:00')}
          </p>
        )}
        {t.status === 'doing' && ck.total > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <Bar pct={ckp} color="#3b82f6" className="h-1" />
            <span className="text-[0.6875rem] tabular-nums text-muted">{Math.round(ckp * 100)}%</span>
          </div>
        )}
      </article>
    );
  };

  const dragTask = drag && data?.tasks.find(t => t.id === drag.id);
  const s = sprints?.current;
  // Sprint em planejamento: sem cartões no quadro, mostra "Nenhuma sprint em andamento"; com cartões, mostra o quadro e o convite para iniciar.
  const planning = Boolean(s && !s.startAt);
  const onBoard = data ? boardTasks(data).length > 0 : false;

  // Jornada: com Minha vida incompleta, o quadro fica trancado (o backlog continua aberto).
  if (locked) {
    return (
      <>
        <Header title="Quadro Kanban" fallback="/jornada" />
        <BoardLocked j={journey} />
      </>
    );
  }

  return (
    <>
      <header className="sticky z-20 bg-bg/90 px-4 pb-3 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3">
          <IconBtn n="chevL" label="Voltar" box onClick={goBack} />
          <span className="text-primary">
            <Icon n="board" className="h-7 w-7" />
          </span>
          <button className="min-w-0 flex-1 text-left" onClick={() => router.push('/sprint')}>
            <p className="text-[1.375rem] font-bold leading-tight">Quadro Kanban</p>
            <p className="flex items-center gap-1 text-sm text-muted">
              <span className="truncate">{s ? `${sprintName(s)} • ${sprintPeriod(s)}` : ' '}</span>
              <Icon n="chevR" className="h-4 w-4 shrink-0" />
            </p>
          </button>
          <IconBtn n="search" label="Buscar" box onClick={() => setSearch(!search)} />
        </div>
        {search && <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar título da tarefa" className={inputCls + ' mt-3'} />}
      </header>

      {late.length > 0 && (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/5">
          <button onClick={() => setShowLate(!showLate)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={showLate}>
            <span className="text-red-600">
              <Icon n="alert" className="h-5 w-5" />
            </span>
            <span className="flex-1 text-sm font-semibold text-red-700">
              {late.length} {late.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
            </span>
            <Icon n={showLate ? 'chevU' : 'chevD'} className="h-4 w-4 text-red-600" />
          </button>
          {showLate && (
            <div className="divide-y divide-red-500/10 border-t border-red-500/10">
              {late.map(t => (
                <button key={t.id} onClick={() => openTask(t.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="text-xs font-semibold text-red-600">venceu {fmtDay(t.dueDate! + 'T12:00')}</span>
                  <Icon n="edit" className="h-4 w-4 text-muted" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 px-4 pb-3">
        {(
          [
            ['quadro', 'board', 'Quadro'],
            ['lista', 'list', 'Lista'],
          ] as const
        ).map(([id, ic, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 sm:px-4 text-sm font-semibold ${
              view === id ? 'bg-primary/10 text-primary' : 'border border-line bg-surface text-ink/80'
            }`}
          >
            <Icon n={ic} className="h-4 w-4" />
            <span className="max-sm:sr-only">{label}</span>
          </button>
        ))}
        <Link href="/backlog" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5 sm:px-4 text-sm font-semibold text-ink/80">
          <Icon n="backlog" className="h-4 w-4" />
          Backlog
        </Link>
        <Link href="/sprint" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5 sm:px-4 text-sm font-semibold text-ink/80">
          <Icon n="flag" className="h-4 w-4" />
          Sprint
        </Link>
        <button
          onClick={areaFilter}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 sm:px-4 text-sm font-semibold ${
            area !== 'all' ? 'border-primary/40 bg-primary/5 text-primary' : 'border-line bg-surface text-ink/80'
          }`}
        >
          <Icon n="filter" className="h-4 w-4" />
          {area === 'all' ? <span className="max-sm:sr-only">Filtros</span> : AREA[area].name.split(' ')[0]}
        </button>
      </div>

      {planning && !onBoard && (
        <div className="mx-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon n="flag" className="h-7 w-7" />
          </span>
          <p className="mt-3 text-lg font-bold">Nenhuma sprint em andamento</p>
          <p className="mt-1 text-sm text-muted">Selecione tarefas no backlog, envie para a sprint e inicie a {sprintName(s!)} quando estiver pronto.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/backlog?aba=tarefas" className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold">
              Selecionar itens
            </Link>
            <Link href="/sprint" className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-onprimary">
              Montar a sprint
            </Link>
          </div>
        </div>
      )}

      {planning && onBoard && (
        <Link href="/sprint" className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="text-amber-700">
            <Icon n="flag" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold text-amber-800">A {sprintName(s!)} ainda não começou</span>
            <span className="block text-amber-800/80">Concluir tarefas agora não rende XP. Toque para iniciar.</span>
          </span>
          <Icon n="chevR" className="h-4 w-4 text-amber-700" />
        </Link>
      )}

      {view === 'quadro' && (!planning || onBoard) && (
        <div className="grid grid-cols-3 items-start gap-2 px-3 pb-8">
          {COLS.map(c => {
            const list = tasks.filter(t => t.status === c.id);
            const over = drag && drag.over === c.id && drag.from !== c.id;
            return (
              <section key={c.id} data-col={c.id} className={`min-h-[60vh] rounded-2xl border border-line/60 p-1.5 transition ${over ? 'bg-primary/5' : 'bg-sunk/40'}`}>
                <div className="flex items-center gap-1.5 px-1 pt-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.c }} />
                  <h2 className="min-w-0 flex-1 text-[0.8438rem] font-semibold leading-tight">{c.label}</h2>
                  <span className="rounded-md border border-line bg-surface px-1.5 text-xs tabular-nums">{list.length}</span>
                </div>
                <div className="mx-1.5 mb-2.5 mt-2 h-[0.1875rem] rounded-full" style={{ background: c.c, opacity: 0.5 }} />
                <div className="space-y-2">
                  {list.map(t => renderCard(t))}
                  {over && (
                    <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/60 px-2 py-6 text-center text-[0.8125rem] text-blue-600">
                      Solte aqui para mover a tarefa
                    </div>
                  )}
                  {list.length === 0 && !over && (
                    <p className="px-1 py-6 text-center text-[0.75rem] text-muted">{c.id === 'todo' ? 'Puxe tarefas do backlog' : 'Nada aqui ainda'}</p>
                  )}
                </div>
                <button
                  onClick={() => sheets.openTask({ status: 'todo' })}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[0.8125rem] font-medium text-primary hover:bg-surface"
                >
                  <Icon n="plus" className="h-4 w-4" />
                  Nova tarefa
                </button>
              </section>
            );
          })}
        </div>
      )}

      {view === 'lista' && (!planning || onBoard) && (
        <div className="space-y-4 px-4 pb-8">
          {COLS.map(c => {
            const list = tasks.filter(t => t.status === c.id);
            return (
              <section key={c.id}>
                <h2 className="mb-2 flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.c }} />
                  {c.label}
                  <span className="text-sm font-normal text-muted">{list.length}</span>
                </h2>
                <Card className="divide-y divide-line">
                  {list.map(t => {
                    const ep = epicOf(t);
                    return (
                      <button key={t.id} onClick={() => openTask(t.id)} className="flex w-full items-center gap-3 p-3.5 text-left">
                        <AreaIcon id={data ? taskAreas(data, t)[0] : undefined} areas={data ? taskAreas(data, t) : undefined} size="w-9 h-9" icon="w-4 h-4" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate font-medium ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{t.title}</span>
                          <span className="block truncate text-xs text-muted">{ep?.title}</span>
                        </span>
                        <Prio p={t.priority} />
                      </button>
                    );
                  })}
                  {list.length === 0 && <p className="py-5 text-center text-sm text-muted">Nenhuma tarefa.</p>}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      {drag && dragTask && (
        <div className="pointer-events-none fixed z-[70]" style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w }}>
          {renderCard(dragTask, true)}
        </div>
      )}
    </>
  );
}
