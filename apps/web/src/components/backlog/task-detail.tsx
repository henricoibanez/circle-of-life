'use client';

import { AREA, STATUS_LABEL, type AreaId, type TaskDto, type TaskStatus, type XpChange } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { Bar, IconBtn, inputCls, Prio, Seg, ImageHint } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError, type Me } from '@/lib/api';
import { BACKLOG_KEY, useBacklog, useBacklogActions } from '@/lib/backlog';
import { useMe } from '@/lib/me';
import { AreaPicker } from './forms';
import { tint } from '@/lib/color';
import { useSprints } from '@/lib/sprints';
import { since } from '@/lib/time';
import { uploadImage } from '@/lib/upload';
import { useBacklogSheets } from './use-backlog-sheets';

type Detail = {
  task: TaskDto;
  epic: { id: string; title: string; area: AreaId; areas: AreaId[] };
  initiative: { id: string; title: string };
  checklist: { id: string; text: string; done: boolean }[];
  logs: { id: string; text: string; createdAt: string }[];
  attachments: { id: string; name: string; url: string }[];
};

const STATUSES = (['backlog', 'todo', 'doing', 'done'] as TaskStatus[]).map(id => ({ id, label: STATUS_LABEL[id] }));

/** Detalhe da tarefa (folha com abas Detalhes, Checklist, Anexos e Atividade), como no protótipo. */
export function TaskDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const actions = useBacklogActions();
  const sheets = useBacklogSheets();
  const { data: sprints } = useSprints();
  const key = ['task', id];
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api<Detail>(`/tasks/${id}`) });
  const [tab, setTab] = useState<'det' | 'ck' | 'files' | 'log'>('det');
  const [item, setItem] = useState('');
  const [desc, setDesc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [areasDraft, setAreasDraft] = useState<AreaId[] | null>(null);
  const [areasOpen, setAreasOpen] = useState(false);
  const [askCal, setAskCal] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const areasTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { data: backlog } = useBacklog();
  const { data: me } = useMe();

  useEffect(() => {
    if (error instanceof ApiError && error.status === 404) onClose();
  }, [error, onClose]);
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(areasTimer.current);
    },
    [],
  );
  if (!data) return null;

  const t = data.task;
  // Áreas próprias da tarefa ou, se nenhuma, as do épico.
  const areaIds = t.areas.length ? t.areas : data.epic.areas;
  const area = AREA[areaIds[0]!];
  const ck = data.checklist;
  const ckDone = ck.filter(c => c.done).length;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: BACKLOG_KEY });
  };
  const applyXp = (xp?: XpChange) => {
    if (!xp) return;
    qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: xp.total, gems: xp.gems } });
    if (xp.gained > 0) toast(`Item concluído, +${xp.gained} XP`);
  };
  const call = async <T,>(fn: () => Promise<T>) => {
    try {
      const r = await fn();
      refresh();
      return r;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
      return undefined;
    }
  };

  const tabs = [
    { id: 'det' as const, label: 'Detalhes' },
    { id: 'ck' as const, label: 'Checklist', n: ck.length ? `${ckDone}/${ck.length}` : null },
    { id: 'files' as const, label: 'Anexos', n: data.attachments.length || null },
    { id: 'log' as const, label: 'Atividade' },
  ];

  // Cada campo salva sozinho ao mudar (como no Jira): não há botão "Editar" nem "Salvar".
  const save = (body: Record<string, unknown>) =>
    actions
      .updateTask(id, body)
      .then(refresh)
      .catch(() => undefined);
  const onDesc = (v: string) => {
    setDesc(v);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save({ description: v }), 700);
  };
  const saveTitle = () => {
    const v = (title ?? '').trim();
    setTitle(null);
    if (v && v !== t.title) save({ title: v });
  };
  const onAreas = (v: AreaId[]) => {
    setAreasDraft(v);
    clearTimeout(areasTimer.current);
    areasTimer.current = setTimeout(() => save({ areas: v }), 600);
  };
  // Ao pôr ou mudar o prazo, o app pergunta se a pessoa quer a tarefa na Google Agenda.
  // (Se ela já estiver na agenda, o servidor atualiza o evento sozinho; sem prazo, tira da agenda.)
  const changeDue = async (v: string) => {
    await save({ dueDate: v || null });
    setAskCal(Boolean(v) && !t.inCalendar);
  };
  const toggleCalendar = (on: boolean) =>
    (on ? actions.addToCalendar(id) : actions.removeFromCalendar(id))
      .then(() => {
        setAskCal(false);
        if (on) toast('Tarefa na sua Google Agenda');
        refresh();
      })
      .catch(() => undefined);
  const epics = (backlog?.epics ?? []).filter(e => !e.closedAt || e.id === t.epicId);
  const iniTitle = (iid: string) => backlog?.initiatives.find(i => i.id === iid)?.title ?? '';
  const calendar = me?.googleCalendar;
  // Campo que parece texto e vira caixa de edição ao tocar.
  const fieldCls =
    'w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-medium hover:bg-sunk focus:border-primary/50 focus:bg-surface focus:outline-none';
  const label = (n: string, text: string) => (
    <p className="flex items-center gap-1.5 px-2 text-[0.8125rem] text-muted">
      <Icon n={n} className="h-3.5 w-3.5" />
      {text}
    </p>
  );

  return (
    <Sheet
      onClose={onClose}
      fixed
      icon={
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: tint(area.color, 0.12), color: area.color }}>
          <Icon n={area.icon} />
        </span>
      }
      title={
        <div>
          {/* O título cresce em linhas conforme o texto: um texto invisível igual, atrás do campo, dá a altura. */}
          <div className="-mx-2 -my-1 grid">
            <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre-wrap break-words border border-transparent px-2 py-1 leading-snug">
              {(title ?? t.title) + ' '}
            </span>
            <textarea
              rows={1}
              aria-label="Nome da tarefa"
              value={title ?? t.title}
              maxLength={120}
              onFocus={() => setTitle(t.title)}
              onChange={e => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="col-start-1 row-start-1 block h-full w-full resize-none overflow-hidden break-words rounded-lg border border-transparent bg-transparent px-2 py-1 leading-snug hover:bg-sunk focus:border-primary/50 focus:bg-surface focus:outline-none"
            />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-normal text-muted">
            {t.status !== 'backlog' && sprints && <span>Sprint {sprints.current.number}</span>}
            {t.status !== 'backlog' && <span>•</span>}
            <Prio p={t.priority} long />
          </p>
        </div>
      }
      footer={
        <>
          <Button
            variant="danger"
            onClick={() =>
              sheets.confirmDelete('Excluir tarefa', `“${t.title}” será excluída. Não dá para desfazer.`, async () => {
                await actions.deleteTask(id);
                onClose();
              })
            }
          >
            <Icon n="trash" className="h-4 w-4" />
            Excluir
          </Button>
          <p className="flex flex-1 items-center justify-end gap-1 text-xs text-muted">
            <Icon n="check" className="h-3.5 w-3.5" />
            As mudanças salvam sozinhas
          </p>
        </>
      }
    >
      <div className="no-bar sticky top-0 z-10 -mx-5 mb-4 flex gap-1 overflow-x-auto border-b border-line bg-surface px-5" role="tablist">
        {tabs.map(x => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`inline-flex shrink-0 gap-1.5 rounded-t-xl px-3 py-2.5 text-sm font-semibold ${tab === x.id ? 'bg-primary/10 text-primary' : 'text-muted'}`}
          >
            {x.label}
            {x.n && <span className="font-normal text-muted">{x.n}</span>}
          </button>
        ))}
      </div>

      {tab === 'det' && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 text-sm font-semibold">Status</p>
            <Seg items={STATUSES} value={t.status} onChange={st => actions.moveTask(id, st).then(refresh).catch(() => undefined)} />
          </div>
          <div className="-mx-2 grid grid-cols-2 gap-x-2 gap-y-3">
            <div>
              {label('flag', 'Prioridade')}
              <select aria-label="Prioridade" value={t.priority} onChange={e => save({ priority: e.target.value })} className={fieldCls}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              {label('calendar', 'Prazo')}
              <input type="date" aria-label="Prazo" value={t.dueDate ?? ''} onChange={e => changeDue(e.target.value)} className={fieldCls} />
            </div>
            <div className="col-span-2">
              {label('layersArea', 'Épico (iniciativa)')}
              <select aria-label="Épico" value={t.epicId} onChange={e => save({ epicId: e.target.value })} className={`${fieldCls} truncate`}>
                {epics.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {iniTitle(e.initiativeId)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              {label('wheel', areaIds.length > 1 ? 'Áreas da vida' : 'Área da vida')}
              <button
                type="button"
                aria-expanded={areasOpen}
                onClick={() => setAreasOpen(!areasOpen)}
                className={`${fieldCls} flex flex-wrap items-center gap-x-2.5 gap-y-1 text-left pointer-coarse:text-base`}
              >
                {(areasDraft?.length ? areasDraft : areaIds).map(a => (
                  <span key={a} className="inline-flex items-center gap-1">
                    <Icon n={AREA[a].icon} className="h-3.5 w-3.5" style={{ color: AREA[a].color }} />
                    {AREA[a].name}
                  </span>
                ))}
                {!(areasDraft ?? t.areas).length && <span className="text-xs font-normal text-muted">(as do épico)</span>}
                <Icon n={areasOpen ? 'chevU' : 'chevD'} className="ml-auto h-4 w-4 text-muted" />
              </button>
              {areasOpen && (
                <div className="mt-2 px-2">
                  <AreaPicker multi value={areasDraft ?? t.areas} onChange={onAreas} />
                  <p className="mt-2 text-xs text-muted">Sem nenhuma marcada, a tarefa usa as áreas do épico.</p>
                </div>
              )}
            </div>
          </div>
          {askCal && t.dueDate && !t.inCalendar && calendar?.connected && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="flex items-center gap-2 font-semibold">
                <Icon n="calendar" className="h-4 w-4 text-primary" />
                Colocar na sua Google Agenda?
              </p>
              <p className="mt-0.5 text-xs text-muted">A tarefa entra na agenda no dia do prazo.</p>
              <div className="mt-2.5 flex gap-2">
                <Button className="flex-1" onClick={() => toggleCalendar(true)} disabled={actions.busy}>
                  Adicionar
                </Button>
                <Button variant="line" className="flex-1" onClick={() => setAskCal(false)}>
                  Agora não
                </Button>
              </div>
            </div>
          )}
          {askCal && t.dueDate && calendar?.available && !calendar.connected && (
            <div className="rounded-xl bg-sunk p-3 text-xs text-muted">
              <p>
                Quer as tarefas com prazo na sua agenda?{' '}
                <Link href="/perfil" onClick={onClose} className="font-semibold text-primary">
                  Conecte a Google Agenda
                </Link>{' '}
                nas Configurações.
              </p>
              <button type="button" onClick={() => setAskCal(false)} className="mt-1.5 font-semibold text-ink/70">
                Agora não
              </button>
            </div>
          )}
          {calendar?.connected && t.dueDate && !(askCal && !t.inCalendar) && (
            <label className="flex items-center gap-2.5 rounded-xl bg-sunk px-3.5 py-2.5">
              <input type="checkbox" checked={t.inCalendar} onChange={e => toggleCalendar(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--p))]" />
              <Icon n="calendar" className="h-4 w-4 text-primary" />
              <span>Na minha Google Agenda</span>
            </label>
          )}
          <div className="-mx-2">
            {label('list', 'Descrição')}
            <textarea
              rows={4}
              value={desc ?? t.description}
              onChange={e => onDesc(e.target.value)}
              maxLength={4000}
              placeholder="Adicione detalhes e próximos passos"
              className={`${fieldCls} resize-none text-[0.9375rem] font-normal leading-relaxed placeholder:text-muted/70`}
            />
          </div>
        </div>
      )}

      {tab === 'ck' && (
        <div>
          {ck.length > 0 && (
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <Bar pct={ckDone / ck.length} />
              </div>
              <span className="text-sm tabular-nums text-muted">{Math.round((ckDone / ck.length) * 100)}%</span>
            </div>
          )}
          <div className="divide-y divide-line">
            {ck.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={c.done}
                  aria-label={c.text}
                  onChange={e =>
                    call(() => api<{ xp: XpChange }>(`/tasks/${id}/checklist/${c.id}`, { method: 'PATCH', body: { done: e.target.checked } })).then(r =>
                      applyXp(r?.xp),
                    )
                  }
                  className="h-5 w-5"
                  style={{ accentColor: 'rgb(var(--p))' }}
                />
                <span className={`flex-1 text-[0.9375rem] ${c.done ? 'text-muted line-through' : ''}`}>{c.text}</span>
                <IconBtn
                  n="x"
                  label="Remover item"
                  className="h-8 w-8 text-muted"
                  onClick={() => call(() => api<{ xp: XpChange }>(`/tasks/${id}/checklist/${c.id}`, { method: 'DELETE' })).then(r => applyXp(r?.xp))}
                />
              </div>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              if (!item.trim()) return;
              call(() => api(`/tasks/${id}/checklist`, { method: 'POST', body: { text: item.trim() } }));
              setItem('');
            }}
          >
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="Novo item" maxLength={200} className={inputCls} />
            <Button type="submit" variant="soft" disabled={!item.trim()}>
              Adicionar
            </Button>
          </form>
        </div>
      )}

      {tab === 'files' && (
        <div className="grid grid-cols-3 gap-2">
          {data.attachments.map(f => (
            <div key={f.id} className="relative overflow-hidden rounded-xl border border-line">
              <a href={f.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.name} className="aspect-square w-full object-cover" />
              </a>
              <button
                aria-label="Remover anexo"
                onClick={() => call(() => api(`/tasks/${id}/attachments/${f.id}`, { method: 'DELETE' }))}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"
              >
                <Icon n="x" className="h-4 w-4" />
              </button>
            </div>
          ))}
          <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-xs text-muted hover:border-primary/40 hover:text-primary">
            <span className="flex flex-col items-center gap-1">
              <Icon n="clip" />
              {uploading ? 'Enviando…' : 'Anexar imagem'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploading(true);
                try {
                  const up = await uploadImage(file, 'task', 1200);
                  await call(() => api(`/tasks/${id}/attachments`, { method: 'POST', body: { fileId: up.id } }));
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.');
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
      )}
      {tab === 'files' && <ImageHint purpose="task" className="mt-2" />}

      {tab === 'log' && (
        <ol className="relative ml-2 space-y-4 border-l border-line">
          {data.logs.map(l => (
            <li key={l.id} className="relative pl-4">
              <span className="absolute -left-[0.3125rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-[0.9375rem]">{l.text}</p>
              <p className="text-xs text-muted">{since(l.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
