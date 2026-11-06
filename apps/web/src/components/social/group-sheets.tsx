'use client';

import { AREA, type AreaId, type GroupDetailDto, type GroupDto, type GroupInviteSearchDto, type GroupRequestDto } from '@circle/shared';
import { useState } from 'react';
import { Art } from '@/components/art';
import { AreaPicker } from '@/components/backlog/forms';
import { Icon } from '@/components/icon';
import { Avatar, Field, inputCls, ImageHint, Seg } from '@/components/primitives';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Cover, priceLabel } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useInviteSearch, useSocialActions } from '@/lib/social';
import { useTrilhas } from '@/lib/trilhas';
import { uploadImage } from '@/lib/upload';

/** Capa do grupo: a foto enviada pelo gestor ou a ilustração da área. */
export function GroupCover({ g, className }: { g: Pick<GroupDto, 'art' | 'area' | 'coverUrl'>; className?: string }) {
  return g.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={g.coverUrl} alt="" className={`object-cover ${className}`} />
  ) : (
    <Art v={g.art} c={AREA[g.area].color} className={className} />
  );
}

/** Criar ou editar um grupo. Quem cria vira gestor e escolhe os outros gestores. */
export function GroupForm({ group, onClose, onSaved }: { group?: GroupDetailDto; onClose: () => void; onSaved?: (g: GroupDetailDto) => void }) {
  const actions = useSocialActions();
  const toast = useToast();
  const [f, setF] = useState({ name: group?.name ?? '', description: group?.description ?? '', area: (group?.area ?? 'intelectual') as AreaId, private: group?.private ?? false });
  const [cover, setCover] = useState<{ id: string | null; url: string | null }>({ id: null, url: group?.coverUrl ?? null });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name.trim(), description: f.description.trim(), area: f.area, private: f.private, ...(cover.id ? { coverFileId: cover.id } : {}) };
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
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Quem pode entrar</span>
          <Seg
            items={[
              { id: 'publico', label: 'Público', icon: 'globe' },
              { id: 'privado', label: 'Privado', icon: 'lock' },
            ]}
            value={f.private ? 'privado' : 'publico'}
            onChange={v => setF({ ...f, private: v === 'privado' })}
          />
          <p className="mt-1.5 text-xs text-muted">
            {f.private
              ? 'Só entra quem um gestor aprovar ou quem aceitar um convite. Quem está de fora vê só o nome, a descrição e a capa.'
              : 'Qualquer pessoa do app pode entrar.'}
          </p>
        </div>
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
        <ImageHint purpose="group" />
      </div>
    </Sheet>
  );
}

/** Gestor convida pessoas do app (busca pelo nome ou @ID). */
export function InviteSheet({ group, onClose }: { group: GroupDetailDto; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { data, isFetching } = useInviteSearch(group.id, q);
  const actions = useSocialActions();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const label = { membro: 'No grupo', convidado: 'Convidado', banido: 'Banido', pediu: '' } as const;

  const invite = async (p: GroupInviteSearchDto) => {
    setBusy(p.id);
    try {
      await actions.invite(group.id, p.id);
      toast(p.status === 'pediu' ? `${p.name} entrou no grupo` : `Convite enviado para ${p.name}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível convidar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet title="Convidar pessoas" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">A pessoa recebe o convite no sino e escolhe se quer entrar em {group.name}.</p>
      <div className="relative mb-3">
        <Icon n="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome ou @ID" className={inputCls + ' pl-10'} autoFocus />
      </div>
      <ul className="divide-y divide-line">
        {(data ?? []).map(p => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={p.name} photo={p.photoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted">@{p.handle}</p>
            </div>
            {p.status && p.status !== 'pediu' ? (
              <span className="text-xs text-muted">{label[p.status]}</span>
            ) : (
              <Button variant="asoft" className="px-3 py-1.5" disabled={busy === p.id} onClick={() => invite(p)}>
                {p.status === 'pediu' ? 'Aprovar' : 'Convidar'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {q.trim().replace(/^@/, '').length >= 2 && data && !data.length && !isFetching && <p className="py-6 text-center text-sm text-muted">Ninguém encontrado.</p>}
    </Sheet>
  );
}

/** Gestor recusa um pedido para entrar, com motivo opcional. */
export function RejectSheet({ group, person, onClose }: { group: GroupDetailDto; person: GroupRequestDto; onClose: () => void }) {
  const actions = useSocialActions();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await actions.reject(group.id, person.id, reason.trim() || undefined);
      toast('Pedido recusado');
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível recusar.');
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={`Recusar ${person.name}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" className="flex-1 border border-red-500/40" disabled={busy} onClick={send}>
            Recusar
          </Button>
        </>
      }
    >
      <Field label="Motivo (opcional)">
        <textarea rows={3} maxLength={300} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: o grupo é só para a turma de março" />
      </Field>
      <p className="mt-2 text-xs text-muted">A pessoa recebe um aviso no sino{reason.trim() ? ' com o motivo' : ''} e pode pedir de novo depois.</p>
    </Sheet>
  );
}

/** Gestor traz uma trilha aprovada da loja: o grupo ganha uma cópia própria, que pode editar. */
export function AddTrilhaSheet({ group, onClose }: { group: GroupDetailDto; onClose: () => void }) {
  const { data } = useTrilhas();
  const actions = useSocialActions();
  const toast = useToast();
  const [q, setQ] = useState('');
  const inGroup = new Set(group.trilhaList.map(t => t.copiedFromId));
  const list = (data ?? []).filter(t => t.status === 'aprovada' && !inGroup.has(t.id) && (!q || t.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <Sheet title="Trazer trilha da loja" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        O grupo ganha uma cópia da trilha, grátis para os membros, que os gestores podem editar. A trilha da loja continua como está. Trilha paga só entra se você já tiver comprado.
      </p>
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
                {AREA[t.area].name} • {t.tasksCount} tarefas • {priceLabel(t)}
              </p>
            </div>
            <Button
              variant="asoft"
              className="px-3 py-1.5"
              onClick={async () => {
                try {
                  await actions.addTrilha(group.id, t.id);
                  toast('Trilha copiada para o grupo');
                  onClose();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : 'Não foi possível adicionar.');
                }
              }}
            >
              Trazer
            </Button>
          </li>
        ))}
      </ul>
      {data && !list.length && <p className="py-6 text-center text-sm text-muted">Nenhuma trilha disponível.</p>}
    </Sheet>
  );
}
