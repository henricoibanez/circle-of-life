'use client';

import { AREAS, type AreaId, MAX_POST_IMAGES, type PostDraft, type PostDto, VISIBILITY, type Visibility } from '@circle/shared';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { Avatar, Field, ImageHint, inputCls, Seg } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useFeedActions } from '@/lib/feed';
import { useMe } from '@/lib/me';
import { useGroups } from '@/lib/social';
import { uploadImage } from '@/lib/upload';

/**
 * Criar post (como no protótipo), com visibilidade. Pode vir preenchido ao compartilhar uma conclusão.
 * Até 3 áreas e quantos grupos quiser; os membros dos grupos veem além do que a visibilidade libera.
 * Com `post`, edita um post seu.
 */
export function PostForm({ draft, groupId, post, onClose }: { draft?: PostDraft; groupId?: string; post?: PostDto; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: groups } = useGroups();
  const actions = useFeedActions();
  const toast = useToast();
  const [f, setF] = useState({
    title: post?.title ?? draft?.title ?? '',
    text: post?.text ?? draft?.text ?? '',
    areas: post ? post.areas : draft?.area ? [draft.area] : ([] as AreaId[]),
    groups: post ? post.groups.map(g => g.id) : groupId ? [groupId] : ([] as string[]),
    tags: post?.tags.join(', ') ?? '',
    visibility: (post?.visibility ?? me?.preferences.defaultPostVisibility ?? 'publico') as Visibility,
  });
  const [media, setMedia] = useState<{ id: string; url: string }[]>(post?.media ?? []);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    setBusy(true);
    try {
      if (post) {
        await actions.update(post.id, {
          title: f.title.trim(),
          text: f.text.trim(),
          areas: f.areas,
          groupIds: f.groups,
          tags: f.tags.split(/[\s,#]+/).filter(Boolean),
          mediaIds: media.map(m => m.id),
          visibility: f.visibility,
        });
        toast('Post atualizado');
        onClose();
        return;
      }
      const r = await actions.create({
        title: f.title.trim(),
        text: f.text.trim(),
        areas: f.areas,
        groupIds: f.groups,
        visibility: f.visibility,
        tags: f.tags.split(/[\s,#]+/).filter(Boolean),
        mediaIds: media.map(m => m.id),
        refType: draft?.refType,
        refId: draft?.refId,
      });
      toast(r.xp.gained > 0 ? `Publicado no feed, +${r.xp.gained} XP` : 'Publicado no feed');
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : post ? 'Não foi possível salvar.' : 'Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={post ? 'Editar post' : 'Criar post'}
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={busy || uploading > 0 || (!f.text.trim() && !f.title.trim())} onClick={publish}>
            {post ? 'Salvar' : 'Publicar'}
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
        <ImageHint purpose="post" />
        <div className="grid grid-cols-2 gap-3">
          <MultiSelect
            label="Áreas"
            empty="Nenhuma"
            plural="áreas"
            allowAll
            options={AREAS.map(a => ({ id: a.id, label: a.name, icon: a.icon, color: a.color }))}
            value={f.areas}
            onChange={areas => setF({ ...f, areas: areas as AreaId[] })}
          />
          <MultiSelect
            label="Grupos"
            empty="Nenhum"
            plural="grupos"
            align="right"
            options={(groups?.mine ?? []).map(g => ({ id: g.id, label: g.name, icon: g.icon }))}
            value={f.groups}
            onChange={groups => setF({ ...f, groups })}
          />
        </div>
        <Field label="Hashtags">
          <input className={inputCls} value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="sprint, evolução" />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Quem pode ver</p>
          <Seg items={VISIBILITY.map(v => ({ id: v.id, label: v.label }))} value={f.visibility} onChange={visibility => setF({ ...f, visibility })} />
          <p className="mt-1.5 text-xs text-muted">
            {f.visibility === 'publico' ? 'Todas as pessoas do app.' : f.visibility === 'amigos' ? 'Só os seus amigos.' : 'Só você.'}
            {f.groups.length > 0 && (f.visibility === 'publico' ? ' O post também aparece nos grupos escolhidos.' : ' E os membros dos grupos escolhidos.')}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

type Option = { id: string; label: string; icon: string; color?: string };

/** Caixa de seleção que aceita várias opções: abre uma lista com marcações. */
function MultiSelect({
  label,
  empty,
  plural,
  max,
  allowAll,
  align = 'left',
  options,
  value,
  onChange,
}: {
  label: string;
  empty: string;
  plural: string;
  max?: number;
  /** Mostra "Marcar todas / Limpar" no topo da lista. */
  allowAll?: boolean;
  align?: 'left' | 'right';
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const chosen = options.filter(o => value.includes(o.id));
  const full = max !== undefined && value.length >= max;

  return (
    <div ref={box} className="relative">
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <button
        type="button"
        aria-expanded={open}
        disabled={options.length === 0}
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex items-center gap-2 text-left disabled:opacity-50`}
      >
        {chosen.length > 0 && (
          <span className="flex shrink-0 gap-0.5">
            {chosen.map(o => (
              <Icon key={o.id} n={o.icon} className="h-4 w-4" style={{ color: o.color }} />
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{chosen.length === 0 ? empty : chosen.length === 1 ? chosen[0]!.label : `${chosen.length} ${plural}`}</span>
        <Icon n="chevR" className={`h-4 w-4 shrink-0 text-muted transition ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open && (
        <div
          className={`absolute top-full z-20 mt-1 max-h-72 w-[15rem] max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {allowAll && (
            <div className="flex justify-end px-1.5 pb-1 pt-0.5">
              {value.length >= options.length ? (
                <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-muted">
                  Limpar
                </button>
              ) : (
                <button type="button" onClick={() => onChange(options.map(o => o.id))} className="text-xs font-semibold text-primary">
                  Marcar todas
                </button>
              )}
            </div>
          )}
          {options.map(o => {
            const on = value.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                disabled={!on && full}
                onClick={() => onChange(on ? value.filter(x => x !== o.id) : [...value, o.id])}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sunk disabled:opacity-40"
              >
                <span
                  className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded border ${on ? 'border-primary bg-primary text-onprimary' : 'border-line'}`}
                >
                  {on && <Icon n="check" className="h-3 w-3" sw={3} />}
                </span>
                <Icon n={o.icon} className="h-4 w-4 shrink-0" style={{ color: o.color }} />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
          {full && <p className="px-2.5 pb-1.5 pt-1 text-xs text-muted">Até {max} por post. Desmarque uma para trocar.</p>}
        </div>
      )}
    </div>
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
