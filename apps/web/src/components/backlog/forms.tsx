'use client';

import { AREAS, type AreaId, type BacklogDto, type Priority } from '@circle/shared';
import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { AreaIcon, Field, inputCls, Seg } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { useBacklog, useBacklogActions } from '@/lib/backlog';
import { useMe } from '@/lib/me';
import Link from 'next/link';

/** Escolha de área(s) da vida em "pílulas" com o ícone de cada área. Com `max`, limita quantas podem ser marcadas. */
export function AreaPicker(
  p: { multi: true; value: AreaId[]; onChange: (v: AreaId[]) => void; max?: number } | { multi?: false; value: AreaId; onChange: (v: AreaId) => void },
) {
  const selected: AreaId[] = p.multi ? p.value : [p.value];
  const toggle = (id: AreaId) => {
    if (p.multi) {
      if (p.value.includes(id)) p.onChange(p.value.filter(x => x !== id));
      else if (p.max === undefined || p.value.length < p.max) p.onChange([...p.value, id]);
    } else p.onChange(id);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {AREAS.map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => toggle(a.id)}
          aria-pressed={selected.includes(a.id)}
          className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm transition ${
            selected.includes(a.id) ? 'border-primary bg-primary/10' : 'border-line text-muted'
          }`}
        >
          <AreaIcon id={a.id} size="w-6 h-6" icon="w-3.5 h-3.5" />
          {a.name}
        </button>
      ))}
    </div>
  );
}

const SheetIcon = ({ n, cls }: { n: 'target' | 'layersArea' | 'checkSq'; cls: string }) => (
  <span className={`grid h-11 w-11 place-items-center rounded-xl ${cls}`}>
    <Icon n={n} />
  </span>
);

function Footer({ onClose, disabled, onSave, label }: { onClose: () => void; disabled: boolean; onSave: () => void; label: string }) {
  return (
    <>
      <Button variant="line" className="flex-1" onClick={onClose}>
        Cancelar
      </Button>
      <Button className="flex-1" disabled={disabled} onClick={onSave}>
        {label}
      </Button>
    </>
  );
}

function NeedsParent({ title, text, action, onClose }: { title: string; text: string; action: ReactNode; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">{text}</p>
      {action}
    </Sheet>
  );
}

// ---------- Iniciativa ----------

export function InitiativeForm({ id, areas: initialAreas, onClose }: { id?: string; areas?: AreaId[]; onClose: () => void }) {
  const { data } = useBacklog();
  const actions = useBacklogActions();
  const toast = useToast();
  const edit = id ? data?.initiatives.find(i => i.id === id) : undefined;
  const [f, setF] = useState({
    title: edit?.title ?? '',
    description: edit?.description ?? '',
    areas: edit?.areas ?? initialAreas ?? ([] as AreaId[]),
    isMaster: edit?.isMaster ?? false,
  });
  const save = async () => {
    if (edit) await actions.updateInitiative(edit.id, f);
    else await actions.createInitiative(f);
    toast(edit ? 'Iniciativa salva' : 'Iniciativa criada');
    onClose();
  };
  return (
    <Sheet
      title={edit ? 'Editar iniciativa' : 'Nova iniciativa'}
      icon={<SheetIcon n="target" cls="bg-primary/10 text-primary" />}
      onClose={onClose}
      footer={<Footer onClose={onClose} disabled={!f.title.trim() || actions.busy} onSave={save} label={edit ? 'Salvar' : 'Criar iniciativa'} />}
    >
      <div className="space-y-4">
        <Field label="Nome">
          <input autoFocus className={inputCls} value={f.title} maxLength={120} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Ex.: Vida longa e próspera" />
        </Field>
        <Field label="Descrição">
          <textarea rows={2} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Por que isso importa para você" />
        </Field>
        <div>
          <span className="mb-2 block text-sm font-semibold">Áreas da vida</span>
          <AreaPicker multi value={f.areas} onChange={areas => setF({ ...f, areas })} />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" style={{ accentColor: 'rgb(var(--p))' }} checked={f.isMaster} onChange={e => setF({ ...f, isMaster: e.target.checked })} />
          Marcar como objetivo master
        </label>
      </div>
    </Sheet>
  );
}

// ---------- Épico ----------

export function EpicForm({
  id,
  initiativeId,
  title: initialTitle,
  area: initialArea,
  onClose,
  onNeedInitiative,
}: {
  id?: string;
  initiativeId?: string;
  title?: string;
  area?: AreaId;
  onClose: () => void;
  onNeedInitiative: () => void;
}) {
  const { data } = useBacklog();
  const actions = useBacklogActions();
  const toast = useToast();
  const edit = id ? data?.epics.find(e => e.id === id) : undefined;
  const inis = data?.initiatives ?? [];
  const iid0 = edit?.initiativeId ?? initiativeId ?? inis[0]?.id ?? '';
  const [f, setF] = useState({
    initiativeId: iid0,
    title: edit?.title ?? initialTitle ?? '',
    description: edit?.description ?? '',
    area: (edit?.area ?? initialArea ?? inis.find(i => i.id === iid0)?.areas[0] ?? 'saude') as AreaId,
  });
  if (data && !inis.length) {
    return (
      <NeedsParent
        title="Novo épico"
        text="Todo épico pertence a uma iniciativa. Crie a primeira antes."
        onClose={onClose}
        action={<Button onClick={() => { onClose(); onNeedInitiative(); }}>Criar iniciativa</Button>}
      />
    );
  }
  const save = async () => {
    if (edit) await actions.updateEpic(edit.id, f);
    else await actions.createEpic(f);
    toast(edit ? 'Épico salvo' : 'Épico criado');
    onClose();
  };
  return (
    <Sheet
      title={edit ? 'Editar épico' : 'Novo épico'}
      icon={<SheetIcon n="layersArea" cls="bg-accent/10 text-accent" />}
      onClose={onClose}
      footer={<Footer onClose={onClose} disabled={!f.title.trim() || !f.initiativeId || actions.busy} onSave={save} label={edit ? 'Salvar' : 'Criar épico'} />}
    >
      <div className="space-y-4">
        <Field label="Vincular à iniciativa">
          <select className={inputCls} value={f.initiativeId} onChange={e => setF({ ...f, initiativeId: e.target.value })}>
            {inis.map(i => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome do épico">
          <input autoFocus className={inputCls} value={f.title} maxLength={120} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Ex.: Comprar uma casa" />
        </Field>
        <Field label="Descrição">
          <textarea rows={2} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="O que fica pronto no fim" />
        </Field>
        <div>
          <span className="mb-2 block text-sm font-semibold">Área da vida</span>
          <AreaPicker value={f.area} onChange={area => setF({ ...f, area })} />
        </div>
      </div>
    </Sheet>
  );
}

// ---------- Tarefa ----------

export function TaskForm({
  id,
  epicId,
  title: initialTitle,
  status: initialStatus,
  onClose,
  onNeedEpic,
}: {
  id?: string;
  epicId?: string;
  title?: string;
  status?: 'backlog' | 'todo';
  onClose: () => void;
  onNeedEpic: () => void;
}) {
  const { data } = useBacklog();
  const actions = useBacklogActions();
  const toast = useToast();
  const { data: me } = useMe();
  const edit = id ? data?.tasks.find(t => t.id === id) : undefined;
  const open = (data?.epics ?? []).filter(e => !e.closedAt || e.id === edit?.epicId);
  const epicAreaOf = (eid: string): AreaId | undefined => data?.epics.find(e => e.id === eid)?.area;
  const iid0 = edit?.epicId ?? epicId ?? open[0]?.id ?? '';
  const [f, setF] = useState({
    epicId: iid0,
    title: edit?.title ?? initialTitle ?? '',
    description: edit?.description ?? '',
    // Áreas próprias (até 3): as da tarefa ou, se nenhuma, já vem a do épico.
    areas: (edit?.areas?.length ? edit.areas : [epicAreaOf(iid0)].filter(Boolean)) as AreaId[],
    priority: (edit?.priority ?? 'media') as Priority,
    dueDate: edit?.dueDate ?? '',
    status: initialStatus ?? 'backlog',
  });
  // Enquanto a pessoa não mexer nas áreas, elas acompanham a área do épico escolhido.
  const [touchedAreas, setTouchedAreas] = useState(Boolean(edit?.areas?.length));
  const changeEpic = (eid: string) =>
    setF(prev => ({ ...prev, epicId: eid, areas: touchedAreas ? prev.areas : ([epicAreaOf(eid)].filter(Boolean) as AreaId[]) }));
  // Vincular à Google Agenda (só quando a pessoa conectou nas Configurações).
  const [cal, setCal] = useState(edit?.inCalendar ?? false);
  const calendar = me?.googleCalendar;
  if (data && !open.length) {
    return (
      <NeedsParent
        title="Nova tarefa"
        text="Toda tarefa pertence a um épico. Crie um épico antes."
        onClose={onClose}
        action={<Button onClick={() => { onClose(); onNeedEpic(); }}>Criar épico</Button>}
      />
    );
  }
  const save = async () => {
    const body = { epicId: f.epicId, title: f.title, description: f.description, areas: f.areas, priority: f.priority, dueDate: f.dueDate || null };
    const saved = edit ? await actions.updateTask(edit.id, body) : await actions.createTask({ ...body, status: f.status });
    // Vincula/desvincula da agenda conforme a opção (só se conectada e com data).
    if (calendar?.connected) {
      if (cal && f.dueDate && !saved.inCalendar) await actions.addToCalendar(saved.id).catch(() => toast('Tarefa salva, mas não foi para a agenda.'));
      else if (!cal && saved.inCalendar) await actions.removeFromCalendar(saved.id).catch(() => undefined);
    }
    toast(edit ? 'Tarefa salva' : 'Tarefa criada');
    onClose();
  };
  const ini = (eid: string, b: BacklogDto | undefined) => b?.initiatives.find(i => i.id === b.epics.find(e => e.id === eid)?.initiativeId)?.title;
  return (
    <Sheet
      title={edit ? 'Editar tarefa' : 'Nova tarefa'}
      icon={<SheetIcon n="checkSq" cls="bg-primary/10 text-primary" />}
      onClose={onClose}
      footer={<Footer onClose={onClose} disabled={!f.title.trim() || !f.epicId || actions.busy} onSave={save} label={edit ? 'Salvar' : 'Criar tarefa'} />}
    >
      <div className="space-y-4">
        <Field label="Vincular a épico">
          <select className={inputCls} value={f.epicId} onChange={e => changeEpic(e.target.value)}>
            {open.map(e => (
              <option key={e.id} value={e.id}>
                {e.title} · {ini(e.id, data)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome da tarefa">
          <input autoFocus className={inputCls} value={f.title} maxLength={120} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Ex.: Visitar imóveis" />
        </Field>
        <Field label="Descrição">
          <textarea rows={3} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Descreva os detalhes e próximos passos" />
        </Field>
        <div>
          <span className="mb-2 block text-sm font-semibold">Áreas da vida <span className="font-normal text-muted">(até 3)</span></span>
          <AreaPicker multi max={3} value={f.areas} onChange={areas => { setTouchedAreas(true); setF(prev => ({ ...prev, areas })); }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade">
            <select className={inputCls} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as Priority })}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </Field>
          <Field label="Previsão de entrega">
            <input type="date" className={inputCls} value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
          </Field>
        </div>
        {calendar?.connected ? (
          f.dueDate && (
            <label className="flex items-center gap-2.5 rounded-xl bg-sunk px-3.5 py-2.5 text-sm">
              <input type="checkbox" checked={cal} onChange={e => setCal(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--p))]" />
              <Icon n="calendar" className="h-4 w-4 text-primary" />
              <span>Adicionar à minha Google Agenda</span>
            </label>
          )
        ) : (
          calendar?.available &&
          f.dueDate && (
            <p className="text-xs text-muted">
              Quer isto na sua agenda?{' '}
              <Link href="/perfil" onClick={onClose} className="font-semibold text-primary">
                Conecte a Google Agenda
              </Link>{' '}
              nas Configurações.
            </p>
          )
        )}
        {!edit && (
          <Field label="Onde colocar">
            <Seg
              items={[
                { id: 'backlog' as const, label: 'Backlog' },
                { id: 'todo' as const, label: 'Sprint atual' },
              ]}
              value={f.status}
              onChange={status => setF({ ...f, status })}
            />
          </Field>
        )}
      </div>
    </Sheet>
  );
}
