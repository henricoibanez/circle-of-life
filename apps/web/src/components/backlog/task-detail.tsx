'use client';

import { AREA, STATUS_LABEL, type AreaId, type TaskDto, type TaskStatus, type XpChange } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { Bar, IconBtn, inputCls, Prio, Seg, ImageHint } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError, type Me } from '@/lib/api';
import { BACKLOG_KEY, useBacklogActions } from '@/lib/backlog';
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
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 404) onClose();
  }, [error, onClose]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
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

  const onDesc = (v: string) => {
    setDesc(v);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => actions.updateTask(id, { description: v }).then(refresh), 700);
  };

  return (
    <Sheet
      onClose={onClose}
      icon={
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: tint(area.color, 0.12), color: area.color }}>
          <Icon n={area.icon} />
        </span>
      }
      title={
        <div>
          <p className="leading-snug">{t.title}</p>
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
          <Button variant="line" className="flex-1" onClick={() => sheets.openTask({ id })}>
            <Icon n="edit" className="h-4 w-4" />
            Editar
          </Button>
        </>
      }
    >
      <div className="no-bar -mx-5 mb-4 flex gap-1 overflow-x-auto border-b border-line px-5" role="tablist">
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
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="flex items-center gap-1.5 text-muted">
                <Icon n="calendar" className="h-4 w-4" />
                Prazo
              </p>
              <input
                type="date"
                value={t.dueDate ?? ''}
                onChange={e => actions.updateTask(id, { dueDate: e.target.value || null }).then(refresh)}
                className="mt-1 w-full bg-transparent font-medium focus:outline-none"
              />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-muted">
                <Icon n="folder" className="h-4 w-4" />
                {areaIds.length > 1 ? 'Áreas' : 'Área'}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
                {areaIds.map(a => (
                  <span key={a} className="inline-flex items-center gap-1">
                    <Icon n={AREA[a].icon} className="h-3.5 w-3.5" style={{ color: AREA[a].color }} />
                    {AREA[a].name}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <div className="text-sm">
            <p className="flex items-center gap-1.5 text-muted">
              <Icon n="target" className="h-4 w-4" />
              Iniciativa e épico
            </p>
            <p className="mt-1">
              {data.initiative.title} <span className="text-muted">›</span> {data.epic.title}
            </p>
          </div>
          <div className="text-sm">
            <p className="flex items-center gap-1.5 text-muted">
              <Icon n="list" className="h-4 w-4" />
              Descrição
            </p>
            <textarea
              rows={3}
              value={desc ?? t.description}
              onChange={e => onDesc(e.target.value)}
              placeholder="Adicione detalhes e próximos passos"
              className="mt-1 w-full resize-none bg-transparent text-[0.9375rem] leading-relaxed placeholder:text-muted/70 focus:outline-none"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Status</p>
            <Seg items={STATUSES} value={t.status} onChange={st => actions.moveTask(id, st).then(refresh)} />
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
