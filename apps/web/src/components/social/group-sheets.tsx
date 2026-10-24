'use client';

import { AREA, type AreaId, type GroupDetailDto, type GroupDto } from '@circle/shared';
import { useState } from 'react';
import { Art } from '@/components/art';
import { AreaPicker } from '@/components/backlog/forms';
import { Icon } from '@/components/icon';
import { Field, inputCls } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Cover, priceLabel } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useSocialActions } from '@/lib/social';
import { useTrilhas } from '@/lib/trilhas';
import { uploadImage } from '@/lib/upload';

/** Capa do grupo: a foto enviada pelo administrador ou a ilustração da área. */
export function GroupCover({ g, className }: { g: Pick<GroupDto, 'art' | 'area' | 'coverUrl'>; className?: string }) {
  return g.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={g.coverUrl} alt="" className={`object-cover ${className}`} />
  ) : (
    <Art v={g.art} c={AREA[g.area].color} className={className} />
  );
}

/** Criar ou editar um grupo. Quem cria vira administrador. */
export function GroupForm({ group, onClose, onSaved }: { group?: GroupDetailDto; onClose: () => void; onSaved?: (g: GroupDetailDto) => void }) {
  const actions = useSocialActions();
  const toast = useToast();
  const [f, setF] = useState({ name: group?.name ?? '', description: group?.description ?? '', area: (group?.area ?? 'intelectual') as AreaId });
  const [cover, setCover] = useState<{ id: string | null; url: string | null }>({ id: null, url: group?.coverUrl ?? null });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name.trim(), description: f.description.trim(), area: f.area, ...(cover.id ? { coverFileId: cover.id } : {}) };
      const g = group ? await actions.update(group.id, body) : await actions.create(body);
      toast(group ? 'Grupo atualizado' : 'Grupo criado');
      onClose();
      if (g) onSaved?.(g);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível salvar o grupo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={group ? 'Editar grupo' : 'Criar grupo'}
      icon={
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon n="users" />
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="accent" className="flex-1" disabled={busy || uploading || f.name.trim().length < 3} onClick={save}>
            {group ? 'Salvar' : 'Criar grupo'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome do grupo">
          <input className={inputCls} maxLength={60} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Leitores de Sêneca" autoFocus />
        </Field>
        <Field label="Descrição">
          <textarea rows={2} maxLength={300} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Sobre o que é o grupo" />
        </Field>
        <Field label="Área da vida">
          <AreaPicker value={f.area} onChange={area => setF({ ...f, area })} />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3 text-sm text-muted hover:border-primary/40">
          <GroupCover g={{ area: f.area, art: AREA[f.area].art, coverUrl: cover.url }} className="h-14 w-20 shrink-0 overflow-hidden rounded-lg" />
          {uploading ? 'Enviando…' : cover.url ? 'Trocar capa' : 'Capa (opcional). Sem imagem, usamos uma ilustração da área.'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setUploading(true);
              try {
                const up = await uploadImage(file, 'group', 1200);
                setCover({ id: up.id, url: up.url });
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Não foi possível enviar a capa.');
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      </div>
    </Sheet>
  );
}

/** O administrador escolhe trilhas aprovadas da loja para o grupo. */
export function AddTrilhaSheet({ group, onClose }: { group: GroupDetailDto; onClose: () => void }) {
  const { data } = useTrilhas();
  const actions = useSocialActions();
  const toast = useToast();
  const [q, setQ] = useState('');
  const inGroup = new Set(group.trilhaList.map(t => t.id));
  const list = (data ?? []).filter(t => t.status === 'aprovada' && !inGroup.has(t.id) && (!q || t.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <Sheet title="Adicionar trilha ao grupo" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Só trilhas aprovadas da loja. Os membros do grupo recebem um aviso.</p>
      <div className="relative mb-3">
        <Icon n="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar trilhas…" className={inputCls + ' pl-10'} />
      </div>
      <ul className="divide-y divide-line">
        {list.map(t => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <Cover t={t} className="h-12 w-16 shrink-0 overflow-hidden rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-xs text-muted">
                {t.tasksCount} tarefas • {priceLabel(t)}
              </p>
            </div>
            <Button
              variant="asoft"
              className="px-3 py-1.5"
              onClick={async () => {
                try {
                  await actions.addTrilha(group.id, t.id);
                  toast('Trilha adicionada ao grupo');
                  onClose();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : 'Não foi possível adicionar.');
                }
              }}
            >
              Adicionar
            </Button>
          </li>
        ))}
      </ul>
      {data && !list.length && <p className="py-6 text-center text-sm text-muted">Nenhuma trilha disponível.</p>}
    </Sheet>
  );
}
