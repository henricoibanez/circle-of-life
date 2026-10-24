'use client';

import { AREA, AREAS, type AreaId } from '@circle/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EpicCard, TaskLine } from '@/components/backlog/backlog-items';
import { useBacklogSheets } from '@/components/backlog/use-backlog-sheets';
import { Icon } from '@/components/icon';
import { Bar, Card, Empty, IconBtn, inputCls, Seg, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { epicTasks, initEpics, progress, taskArea, useBacklog, useBacklogActions } from '@/lib/backlog';

type Tab = 'ini' | 'epi' | 'tar';
type TaskFilter = 'backlog' | 'sprint' | 'done';

/** Backlog: a visão completa em cascata (Iniciativa > Épico > Tarefa), como no protótipo. */
export default function BacklogPage() {
  const { data } = useBacklog();
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const { openActions } = useSheets();
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ini');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(false);
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);
  const [st, setSt] = useState<TaskFilter>('backlog');

  const areaFilter = () =>
    openActions('Filtrar por área da vida', [
      { icon: 'grid', label: 'Todas as áreas', run: () => setArea('all') },
      ...AREAS.map(a => ({ icon: a.icon as never, label: a.name, run: () => setArea(a.id) })),
    ]);

  if (!data) return <Header />;

  // A primeira iniciativa começa aberta, como no protótipo.
  const isOpen = (id: string) => (open ? Boolean(open[id]) : data.initiatives[0]?.id === id);
  const toggle = (id: string) => setOpen(o => ({ ...(o ?? { [data.initiatives[0]?.id ?? '']: true }), [id]: !isOpen(id) }));

  const m = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase());
  const epOk = (e: (typeof data.epics)[number]) => (area === 'all' || e.area === area) && (m(e.title) || epicTasks(data, e.id).some(t => m(t.title)));
  const inis = data.initiatives.filter(
    i => (area === 'all' || i.areas.includes(area) || initEpics(data, i.id).some(e => e.area === area)) && (m(i.title) || initEpics(data, i.id).some(epOk)),
  );
  const tks = data.tasks.filter(
    t =>
      (area === 'all' || taskArea(data, t) === area) &&
      m(t.title) &&
      (st === 'backlog' ? t.status === 'backlog' : st === 'sprint' ? t.status === 'todo' || t.status === 'doing' : t.status === 'done'),
  );

  const initiativeMenu = (i: (typeof data.initiatives)[number]) => {
    const epics = initEpics(data, i.id);
    const canComplete = !i.completedAt && epics.length > 0 && epics.every(e => e.closedAt);
    openActions(i.title, [
      { icon: 'edit', label: 'Editar', run: () => sheets.openInitiative({ id: i.id }) },
      { icon: 'copy', label: 'Duplicar iniciativa', run: () => actions.duplicateInitiative(i.id).then(() => toast('Iniciativa duplicada')) },
      canComplete && {
        icon: 'trophy',
        label: 'Concluir iniciativa',
        run: () => actions.completeInitiative(i.id).then(r => toast(`Iniciativa concluída: ${r.initiative.title}`)),
      },
      i.completedAt && { icon: 'undo', label: 'Reabrir iniciativa', run: () => actions.reopenInitiative(i.id) },
      { icon: 'share', label: 'Publicar como trilha', run: () => toast('Publicar trilha: chega na etapa 15') },
      {
        icon: 'trash',
        label: 'Excluir iniciativa',
        danger: true,
        run: () =>
          sheets.confirmDelete('Excluir iniciativa', `“${i.title}”, os ${epics.length} épicos e todas as tarefas dela serão excluídos. Não dá para desfazer.`, () =>
            actions.deleteInitiative(i.id),
          ),
      },
    ]);
  };

  return (
    <>
      <Header
        search={search}
        q={q}
        setQ={setQ}
        onSearch={() => setSearch(!search)}
        onMore={() =>
          openActions('Backlog', [
            { icon: 'target', label: 'Nova iniciativa', run: () => sheets.openInitiative() },
            { icon: 'bag', label: 'Importar trilha da loja', run: () => router.push('/loja') },
            { icon: 'filter', label: 'Filtrar por área', run: areaFilter },
            { icon: 'chevD', label: 'Expandir todas as iniciativas', run: () => setOpen(Object.fromEntries(data.initiatives.map(i => [i.id, true]))) },
            { icon: 'chevU', label: 'Recolher todas', run: () => setOpen({}) },
          ])
        }
        tab={tab}
        setTab={setTab}
        area={area}
        clearArea={() => setArea('all')}
      />
      <div className="space-y-4 px-4 pb-8">
        {tab === 'ini' && (
          <>
            {inis.map(i => {
              const ie = initEpics(data, i.id).filter(epOk);
              const all = initEpics(data, i.id);
              const pr = progress(all.flatMap(e => epicTasks(data, e.id)));
              const opened = isOpen(i.id) || Boolean(q);
              const canComplete = !i.completedAt && all.length > 0 && all.every(e => e.closedAt);
              return (
                <Card key={i.id} className="rounded-3xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon n="target" className="h-6 w-6" />
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => toggle(i.id)} aria-expanded={opened}>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[20px] font-semibold leading-tight">{i.title}</span>
                        {i.isMaster ? <Tag>Objetivo Master</Tag> : <Tag c="#6b7280">Iniciativa</Tag>}
                        {i.completedAt && <Tag c="#16a34a">Concluída</Tag>}
                      </p>
                      {i.description && <p className="mt-1 text-[15px] text-muted">{i.description}</p>}
                    </button>
                    <IconBtn n="moreV" label="Opções da iniciativa" className="-mr-1 h-8 w-8 text-muted" onClick={() => initiativeMenu(i)} />
                  </div>
                  <button onClick={() => toggle(i.id)} className="mt-3 flex w-full items-center gap-3 pl-[60px]">
                    <span className="whitespace-nowrap text-sm text-muted">Progresso geral</span>
                    <div className="min-w-[48px] flex-1">
                      <Bar pct={pr.pct} className="h-2" />
                    </div>
                    <span className="text-sm tabular-nums text-muted">{Math.round(pr.pct * 100)}%</span>
                    <Icon n={opened ? 'chevU' : 'chevD'} className="h-4 w-4 text-muted" />
                  </button>
                  {opened && (
                    <div className="relative mt-4 pl-6">
                      <span className="absolute -top-2 bottom-8 left-[23px] w-px bg-line" />
                      <div className="space-y-3">
                        {ie.map((e, idx) => (
                          <div key={e.id} className="relative">
                            <span className="absolute -left-[1px] top-9 h-px w-5 bg-line" />
                            <span className="absolute left-[-5px] top-[33px] h-2.5 w-2.5 rounded-full bg-line" />
                            <div className="ml-5">
                              <EpicCard e={e} data={data} nested={idx === 0} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {ie.length === 0 && <p className="ml-5 text-sm text-muted">Nenhum épico ainda.</p>}
                      <div className="ml-5 mt-3 flex flex-wrap gap-2">
                        <Button variant="soft" className="px-3 py-2" onClick={() => sheets.openEpic({ initiativeId: i.id })}>
                          <Icon n="plus" className="h-4 w-4" />
                          Épico
                        </Button>
                        <Button variant="ghost" className="px-3 py-2" onClick={() => sheets.openInitiative({ id: i.id })}>
                          <Icon n="edit" className="h-4 w-4" />
                          Editar
                        </Button>
                        {canComplete && (
                          <Button
                            className="ml-auto px-3 py-2"
                            disabled={actions.busy}
                            onClick={() => actions.completeInitiative(i.id).then(r => toast(`Iniciativa concluída: ${r.initiative.title}`))}
                          >
                            <Icon n="trophy" className="h-4 w-4" />
                            Concluir iniciativa
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {inis.length === 0 && (
              <Empty action={<Button onClick={() => sheets.openInitiative()}>Criar iniciativa</Button>}>
                Nenhuma iniciativa {q || area !== 'all' ? 'com esse filtro' : 'ainda'}.
              </Empty>
            )}
          </>
        )}

        {tab === 'epi' && (
          <div className="space-y-3">
            {data.epics.filter(epOk).map(e => (
              <EpicCard key={e.id} e={e} data={data} showIni />
            ))}
            {!data.epics.filter(epOk).length && <p className="py-10 text-center text-muted">Nenhum épico com esse filtro.</p>}
          </div>
        )}

        {tab === 'tar' && (
          <>
            <Seg
              items={[
                { id: 'backlog' as const, label: 'No backlog' },
                { id: 'sprint' as const, label: 'Na sprint' },
                { id: 'done' as const, label: 'Concluídas' },
              ]}
              value={st}
              onChange={setSt}
            />
            <Card className="divide-y divide-line px-4">
              {tks.map(t => (
                <TaskLine key={t.id} t={t} last />
              ))}
              {!tks.length && <p className="py-8 text-center text-muted">Nenhuma tarefa aqui.</p>}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function Header(p: {
  search?: boolean;
  q?: string;
  setQ?: (v: string) => void;
  onSearch?: () => void;
  onMore?: () => void;
  tab?: Tab;
  setTab?: (t: Tab) => void;
  area?: AreaId | 'all';
  clearArea?: () => void;
}) {
  return (
    <header className="sticky z-20 bg-bg/90 px-4 pb-3 pt-4 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h1 className="text-[32px] font-bold leading-none tracking-tight">Backlog</h1>
          <p className="mt-1.5 text-muted">Sua visão completa em cascata</p>
        </div>
        <IconBtn n="search" label="Buscar" box className="rounded-full" onClick={p.onSearch} />
        <IconBtn n="more" label="Mais opções" box className="rounded-full" onClick={p.onMore} />
      </div>
      {p.search && (
        <input autoFocus value={p.q} onChange={e => p.setQ?.(e.target.value)} placeholder="Pesquisar por nome" className={inputCls + ' mt-3'} />
      )}
      {p.tab && (
        <div className="mt-4 flex gap-2">
          {(
            [
              ['ini', 'Iniciativas'],
              ['epi', 'Épicos'],
              ['tar', 'Tarefas'],
            ] as const
          ).map(([id, l]) => (
            <button
              key={id}
              onClick={() => p.setTab?.(id)}
              className={`rounded-2xl px-5 py-2.5 text-[15px] font-medium transition ${p.tab === id ? 'bg-primary text-onprimary' : 'bg-sunk text-ink/80'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {p.area && p.area !== 'all' && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted">Área:</span>
          <Tag c={AREA[p.area].color}>{AREA[p.area].name}</Tag>
          <button className="ml-auto font-semibold text-primary" onClick={p.clearArea}>
            Limpar
          </button>
        </div>
      )}
    </header>
  );
}
