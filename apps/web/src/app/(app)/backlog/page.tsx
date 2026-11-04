'use client';

import { AREA, AREAS, type AreaId } from '@circle/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EpicCard, TaskLine } from '@/components/backlog/backlog-items';
import { ImportSheet } from '@/components/backlog/import-sheet';
import { Reorderable } from '@/components/backlog/reorderable';
import { BulkBar, SelectionProvider, useSelection } from '@/components/backlog/selection';
import { useBacklogSheets } from '@/components/backlog/use-backlog-sheets';
import { useCelebrate } from '@/components/celebrate';
import { useGoBack } from '@/components/header';
import { Icon } from '@/components/icon';
import { Bar, Card, Empty, IconBtn, inputCls, Seg, Tag } from '@/components/primitives';
import { useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { epicTasks, initEpics, progress, sortByOrder, taskAreas, useBacklog, useBacklogActions } from '@/lib/backlog';
import { downloadBacklogSpreadsheet } from '@/lib/backlog-io';

type Tab = 'ini' | 'epi' | 'tar';
type TaskFilter = 'backlog' | 'sprint' | 'done';

/** Backlog: a visão completa em cascata (Iniciativa > Épico > Tarefa), como no protótipo, com seleção e ações em massa. */
export default function BacklogPage() {
  return (
    <SelectionProvider>
      <Backlog />
      <BulkBar />
    </SelectionProvider>
  );
}

function Backlog() {
  const { data } = useBacklog();
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const { openActions, openSheet } = useSheets();
  const toast = useToast();
  const router = useRouter();
  const celebrate = useCelebrate();
  const completeInitiative = (id: string) =>
    actions.completeInitiative(id).then(r =>
      celebrate({
        icon: 'target',
        title: `Iniciativa concluída: ${r.initiative.title}`,
        text: `${r.doneTasks} ${r.doneTasks === 1 ? 'tarefa entregue' : 'tarefas entregues'} em todos os épicos.`,
        xp: r.xp.gained,
        area: r.initiative.areas[0] ?? null,
        refType: 'initiative',
        refId: r.initiative.id,
      }),
    );
  const [tab, setTab] = useState<Tab>('ini');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(false);
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);
  const [st, setSt] = useState<TaskFilter>('backlog');
  // "/backlog?aba=tarefas" abre direto na aba Tarefas (ex.: "Selecionar itens" do quadro vazio).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('aba') === 'tarefas') setTab('tar');
  }, []);
  // Trocar de aba ou de filtro limpa a seleção (para não agir em tarefas que não estão na tela).
  const sel = useSelection();
  const { clear } = sel;
  useEffect(() => clear(), [tab, st, clear]);

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
  const epOk = (e: (typeof data.epics)[number]) => (area === 'all' || e.areas.includes(area)) && (m(e.title) || epicTasks(data, e.id).some(t => m(t.title)));
  const inis = sortByOrder(data.initiatives).filter(
    i => (area === 'all' || i.areas.includes(area) || initEpics(data, i.id).some(e => e.areas.includes(area))) && (m(i.title) || initEpics(data, i.id).some(epOk)),
  );
  // Arrastar para reordenar vale na aba Iniciativas, sem filtro nem busca (dentro de cada "pai").
  const canReorder = tab === 'ini' && !q && area === 'all';
  const resetOrder = () =>
    Promise.all([
      actions.reorder('initiative', data.initiatives.map(i => i.id), true),
      actions.reorder('epic', data.epics.map(e => e.id), true),
      actions.reorder('task', data.tasks.map(t => t.id), true),
    ]).then(() => toast('Ordem alfabética restaurada'));
  const tks = data.tasks.filter(
    t =>
      (area === 'all' || taskAreas(data, t).includes(area)) &&
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
        run: () => completeInitiative(i.id),
      },
      i.completedAt && { icon: 'undo', label: 'Reabrir iniciativa', run: () => actions.reopenInitiative(i.id) },
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
            { icon: 'download', label: 'Importar tarefas (planilha)', run: () => openSheet(close => <ImportSheet onClose={close} />) },
            {
              icon: 'share',
              label: 'Exportar tarefas (planilha)',
              run: () =>
                downloadBacklogSpreadsheet().then(
                  n => toast(n ? 'Planilha baixada' : 'Planilha baixada (o backlog está vazio)'),
                  () => toast('Não foi possível gerar a planilha.'),
                ),
            },
            { icon: 'filter', label: 'Filtrar por área', run: areaFilter },
            { icon: 'list', label: 'Ordenar tudo por A–Z', run: resetOrder },
            { icon: 'chevD', label: 'Expandir todas as iniciativas', run: () => setOpen(Object.fromEntries(data.initiatives.map(i => [i.id, true]))) },
            { icon: 'chevU', label: 'Recolher todas', run: () => setOpen({}) },
          ])
        }
        tab={tab}
        setTab={setTab}
        area={area}
        clearArea={() => setArea('all')}
      />
      <div className={`space-y-4 px-4 ${sel.ids.size ? 'pb-36' : 'pb-8'}`}>
        {tab === 'ini' && (
          <>
            {canReorder && inis.length > 1 && <p className="-mt-1 text-xs text-muted">Segure e arraste uma iniciativa, épico ou tarefa para reordenar.</p>}
            <Reorderable items={inis} enabled={canReorder} onReorder={ids => actions.reorder('initiative', ids)} className="space-y-4">
            {(i: (typeof inis)[number]) => {
              const ie = initEpics(data, i.id).filter(epOk);
              const all = initEpics(data, i.id);
              const pr = progress(all.flatMap(e => epicTasks(data, e.id)));
              const opened = isOpen(i.id) || Boolean(q);
              const canComplete = !i.completedAt && all.length > 0 && all.every(e => e.closedAt);
              return (
                <Card className="rounded-3xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon n="target" className="h-6 w-6" />
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => toggle(i.id)} aria-expanded={opened}>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[1.25rem] font-semibold leading-tight">{i.title}</span>
                        {i.isMaster ? <Tag>Objetivo Master</Tag> : <Tag c="#6b7280">Iniciativa</Tag>}
                        {i.completedAt && <Tag c="#16a34a">Concluída</Tag>}
                      </p>
                      {i.description && <p className="mt-1 text-[0.9375rem] text-muted">{i.description}</p>}
                    </button>
                    <IconBtn n="moreV" label="Opções da iniciativa" className="-mr-1 h-8 w-8 text-muted" onClick={() => initiativeMenu(i)} />
                  </div>
                  <button onClick={() => toggle(i.id)} className="mt-3 flex w-full items-center gap-3 pl-[3.75rem]">
                    <span className="whitespace-nowrap text-sm text-muted">Progresso geral</span>
                    <div className="min-w-[3rem] flex-1">
                      <Bar pct={pr.pct} className="h-2" />
                    </div>
                    <span className="text-sm tabular-nums text-muted">{Math.round(pr.pct * 100)}%</span>
                    <Icon n={opened ? 'chevU' : 'chevD'} className="h-4 w-4 text-muted" />
                  </button>
                  {opened && (
                    <div className="relative mt-4 pl-6">
                      <span className="absolute -top-2 bottom-8 left-[1.4375rem] w-px bg-line" />
                      <Reorderable items={ie} enabled={canReorder} onReorder={ids => actions.reorder('epic', ids)} className="space-y-3">
                        {(e, dragging) => (
                          <div className="relative">
                            <span className="absolute -left-[0.0625rem] top-9 h-px w-5 bg-line" />
                            <span className="absolute left-[-5px] top-[2.0625rem] h-2.5 w-2.5 rounded-full bg-line" />
                            <div className="ml-5">
                              <EpicCard e={e} data={data} nested={!dragging && ie[0]?.id === e.id} reorder={canReorder} />
                            </div>
                          </div>
                        )}
                      </Reorderable>
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
                            onClick={() => completeInitiative(i.id)}
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
            }}
            </Reorderable>
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
            {!sel.ids.size && tks.length > 0 && (
              <p className="-mb-1 text-xs text-muted">Toque na bolinha das tarefas para selecionar e agir em várias de uma vez.</p>
            )}
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
  // O Backlog abre pelo "Mais" (não está mais na barra inferior): voltar leva para lá.
  const goBack = useGoBack('/mais');
  return (
    <header className="sticky z-20 bg-bg/90 px-4 pb-3 pt-4 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-start gap-2">
        <IconBtn n="arrowL" label="Voltar" box onClick={goBack} />
        <div className="flex-1">
          <h1 className="text-[2rem] font-bold leading-none tracking-tight">Backlog</h1>
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
              className={`rounded-2xl px-5 py-2.5 text-[0.9375rem] font-medium transition ${p.tab === id ? 'bg-primary text-onprimary' : 'bg-sunk text-ink/80'}`}
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
