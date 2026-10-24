'use client';

import { AREAS, type AreaId, MAX_POST_IMAGES, type PostDraft, VISIBILITY, type Visibility } from '@circle/shared';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Avatar, Field, inputCls, Seg } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useFeedActions } from '@/lib/feed';
import { useMe } from '@/lib/me';
import { useGroups } from '@/lib/social';
import { uploadImage } from '@/lib/upload';

/** Criar post (como no protótipo), com visibilidade. Pode vir preenchido ao compartilhar uma conclusão. */
export function PostForm({ draft, groupId, onClose }: { draft?: PostDraft; groupId?: string; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: groups } = useGroups();
  const actions = useFeedActions();
  const toast = useToast();
  const [f, setF] = useState({
    title: draft?.title ?? '',
    text: draft?.text ?? '',
    area: (draft?.area ?? '') as AreaId | '',
    group: groupId ?? '',
    tags: '',
    visibility: (me?.preferences.defaultPostVisibility ?? 'publico') as Visibility,
  });
  const [media, setMedia] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    setBusy(true);
    try {
      const r = await actions.create({
        title: f.title.trim(),
        text: f.text.trim(),
        area: f.area || null,
        groupId: f.group || null,
        visibility: f.visibility,
        tags: f.tags.split(/[\s,#]+/).filter(Boolean),
        mediaIds: media.map(m => m.id),
        refType: draft?.refType,
        refId: draft?.refId,
      });
      toast(r.xp.gained > 0 ? `Publicado no feed, +${r.xp.gained} XP` : 'Publicado no feed');
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Criar post"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={busy || uploading > 0 || (!f.text.trim() && !f.title.trim())} onClick={publish}>
            Publicar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={me?.name} photo={me?.photoUrl} />
          <p className="font-semibold">{me?.name}</p>
        </div>
        <Field label="Conquista (opcional)">
          <input className={inputCls} maxLength={120} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Ex.: Sprint 12 concluída" />
        </Field>
        <textarea
          autoFocus={!draft}
          rows={4}
          maxLength={3000}
          className={inputCls}
          value={f.text}
          onChange={e => setF({ ...f, text: e.target.value })}
          placeholder="O que aconteceu na sua sprint?"
        />
        <div className="grid grid-cols-4 gap-2">
          {media.map(m => (
            <div key={m.id} className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="aspect-square w-full object-cover" />
              <button
                aria-label="Remover imagem"
                onClick={() => setMedia(x => x.filter(y => y.id !== m.id))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white"
              >
                <Icon n="x" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up${i}`} className="grid aspect-square animate-pulse place-items-center rounded-xl bg-sunk text-xs text-muted">
              Enviando…
            </div>
          ))}
          {media.length + uploading < MAX_POST_IMAGES && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:text-primary">
              <Icon n="camera" />
              <span className="sr-only">Adicionar imagens</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={async e => {
                  const files = [...(e.target.files ?? [])].slice(0, MAX_POST_IMAGES - media.length - uploading);
                  e.target.value = '';
                  setUploading(n => n + files.length);
                  await Promise.all(
                    files.map(async file => {
                      try {
                        const up = await uploadImage(file, 'post', 1200);
                        setMedia(x => [...x, { id: up.id, url: up.url }]);
                      } catch (err) {
                        toast(err instanceof Error ? err.message : 'Não foi possível abrir essa imagem');
                      } finally {
                        setUploading(n => n - 1);
                      }
                    }),
                  );
                }}
              />
            </label>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Área">
            <select className={inputCls} value={f.area} onChange={e => setF({ ...f, area: e.target.value as AreaId | '' })}>
              <option value="">Nenhuma</option>
              {AREAS.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grupo">
            <select className={inputCls} value={f.group} onChange={e => setF({ ...f, group: e.target.value })}>
              <option value="">Nenhum</option>
              {groups?.mine.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Hashtags">
          <input className={inputCls} value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="sprint, evolução" />
        </Field>
        <Field label="Quem pode ver">
          {f.group ? (
            <p className="flex items-center gap-2 rounded-xl bg-sunk px-3 py-2.5 text-sm text-muted">
              <Icon n="users" className="h-4 w-4" />
              Só os membros do grupo.
            </p>
          ) : (
            <Seg items={VISIBILITY.map(v => ({ id: v.id, label: v.label }))} value={f.visibility} onChange={visibility => setF({ ...f, visibility })} />
          )}
        </Field>
      </div>
    </Sheet>
  );
}

/** Abre o "Criar post" (vazio ou com um rascunho). */
export function usePostForm() {
  const { openSheet } = useSheets();
  return (draft?: PostDraft, groupId?: string) => openSheet(close => <PostForm draft={draft} groupId={groupId} onClose={close} />);
}

/**
 * "Quer compartilhar?" — perguntado sempre que uma tarefa é concluída.
 * Compartilhar abre o "Criar post" já preenchido; nada vai para o feed sem a pessoa publicar.
 */
export function SharePrompt({ draft, xp, onClose }: { draft: PostDraft; xp?: number; onClose: () => void }) {
  const { openSheet } = useSheets();
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="burst mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon n="checkSq" className="h-10 w-10" sw={1.6} />
        </div>
        <h2 className="mt-4 text-xl font-bold">Tarefa concluída!</h2>
        <p className="mt-1 text-muted">“{draft.title}”</p>
        {(xp ?? 0) > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 font-bold text-amber-600">
            <Icon n="star" className="h-4 w-4" fill="currentColor" />+{xp} XP
          </p>
        )}
        <p className="mt-4 font-semibold">Quer compartilhar?</p>
        <div className="mt-4 flex gap-2">
          <Button variant="line" className="flex-1" onClick={onClose}>
            Agora não
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onClose();
              openSheet(close => <PostForm draft={draft} onClose={close} />);
            }}
          >
            <Icon n="share" className="h-4 w-4" />
            Compartilhar
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">Compartilhar é opcional. Só aparece no feed se você quiser.</p>
      </div>
    </Sheet>
  );
}
