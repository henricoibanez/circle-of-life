'use client';

import { AREA, type PostDto, VISIBILITY } from '@circle/shared';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { PostForm } from '@/components/feed/post-form';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Card, IconBtn, inputCls } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { postText, useComments, useFeedActions } from '@/lib/feed';
import { since } from '@/lib/time';

const first = (name: string) => name.split(' ')[0];

/** Post do feed (como no protótipo, sem nível e sequência). */
export function PostCard({ p }: { p: PostDto }) {
  const actions = useFeedActions();
  const toast = useToast();
  const { openSheet, openActions } = useSheets();
  const g = p.group;
  const a = p.area ? AREA[p.area] : null;
  const media = p.media;
  const vis = VISIBILITY.find(v => v.id === p.visibility)!;

  const copy = (msg: string) =>
    navigator.clipboard?.writeText(postText(p)).then(
      () => toast(msg),
      () => toast('Não foi possível copiar'),
    );
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
  const save = () => actions.save(p).then(on => toast(on ? 'Post salvo' : 'Removido dos salvos'), fail);

  const menu = () =>
    openActions('Post', [
      { icon: 'bookmark', label: p.saved ? 'Remover dos salvos' : 'Salvar post', run: save },
      { icon: 'copy', label: 'Copiar texto', run: () => copy('Texto copiado') },
      p.mine && { icon: 'edit', label: 'Editar post', run: () => openSheet(close => <PostForm post={p} onClose={close} />) },
      p.mine && {
        icon: 'trash',
        label: 'Excluir post',
        danger: true,
        run: () =>
          openSheet(close => (
            <ConfirmSheet title="Excluir post?" confirm="Excluir" danger onConfirm={() => actions.remove(p.id).then(() => toast('Post excluído'), fail)} onClose={close}>
              O post, as curtidas e os comentários somem para todos.
            </ConfirmSheet>
          )),
      },
    ]);

  const likers = p.likers.map(l => first(l.name));
  const names = [p.liked && 'Você', ...likers].filter(Boolean).slice(0, 2) as string[];

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={p.author.name} photo={p.author.photoUrl} size="w-11 h-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{p.mine ? 'Você' : p.author.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            {since(p.createdAt)}
            {(g || a) && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  <Icon n={(g ? g.icon : a!.icon) as IconName} className="h-4 w-4" />
                  {g ? g.name : a!.name}
                </span>
              </>
            )}
            {p.mine && !g && p.visibility !== 'publico' && (
              <span className="inline-flex items-center gap-1" title={vis.label}>
                <span>•</span>
                <Icon n={vis.icon} className="h-3.5 w-3.5" />
                <span className="sr-only">{vis.label}</span>
              </span>
            )}
          </p>
        </div>
        <IconBtn n="more" label="Opções do post" className="-mr-2 -mt-1 h-9 w-9" onClick={menu} />
      </div>
      {p.title && (
        <p className="mt-3 flex items-start gap-2 text-[1.0625rem] font-semibold">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-onprimary">
            <Icon n="check" className="h-3 w-3" sw={3} />
          </span>
          {p.title}
        </p>
      )}
      {p.text && <p className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink/80">{p.text}</p>}
      {media.length > 0 && (
        <div className={`mt-3 grid gap-2 ${media.length === 1 ? 'grid-cols-1' : media.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {media.slice(0, media.length > 4 ? 3 : 4).map((m, i) => (
            <button key={m.id} onClick={() => openSheet(close => <Gallery media={media} start={i} onClose={close} />)} aria-label={`Ver imagem ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className={`w-full rounded-xl object-cover ${media.length === 1 ? 'aspect-[16/9]' : 'aspect-square'}`} />
            </button>
          ))}
          {media.length > 4 && (
            <button onClick={() => openSheet(close => <Gallery media={media} start={3} onClose={close} />)} className="grid aspect-square place-items-center rounded-xl bg-sunk text-center">
              <span>
                <span className="block text-2xl font-semibold text-primary">+{media.length - 3}</span>
                <span className="text-xs text-muted">Ver todas</span>
              </span>
            </button>
          )}
        </div>
      )}
      {p.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.tags.map(t => (
            <span key={t} className="rounded-lg bg-sunk px-2.5 py-1 text-sm text-ink/70">
              #{t}
            </span>
          ))}
        </div>
      )}
      {(p.xpShown ?? 0) > 0 && (
        <div className="mt-3 rounded-xl bg-primary/5 px-3 py-2.5">
          <p className="font-bold text-primary">+{p.xpShown} XP</p>
          <p className="text-xs text-muted">Pontuação recebida</p>
        </div>
      )}
      <div className="mt-3 flex items-center gap-5 text-[0.9375rem]">
        <button onClick={() => actions.like(p).catch(fail)} aria-pressed={p.liked} aria-label="Curtir" className="inline-flex items-center gap-1.5">
          <span className={p.liked ? 'text-red-500' : 'text-ink/70'}>
            <Icon n="heart" className="h-6 w-6" fill={p.liked ? 'currentColor' : 'none'} />
          </span>
          {p.likes}
        </button>
        <button onClick={() => openSheet(close => <CommentsSheet id={p.id} onClose={close} />)} aria-label="Comentários" className="inline-flex items-center gap-1.5 text-ink/80">
          <Icon n="msg" className="h-6 w-6" />
          {p.comments}
        </button>
        <button onClick={() => copy('Texto copiado para compartilhar')} aria-label="Compartilhar" className="inline-flex items-center gap-1.5 text-ink/80">
          <Icon n="share" className="h-6 w-6" />
        </button>
        <button onClick={save} aria-pressed={p.saved} aria-label="Salvar" className="ml-auto text-ink/70">
          <Icon n="bookmark" className="h-6 w-6" fill={p.saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      {names.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          <div className="flex -space-x-2">
            {p.likers.slice(0, 3).map(l => (
              <span key={l.id} className="rounded-full ring-2 ring-surface">
                <Avatar name={l.name} photo={l.photoUrl} size="w-6 h-6 text-[0.5625rem]" />
              </span>
            ))}
          </div>
          <span>
            Curtido por <strong className="font-semibold text-ink/80">{names.join(', ')}</strong>
            {p.likes - names.length === 1 ? ' e outra pessoa' : p.likes - names.length > 1 ? ` e outras ${p.likes - names.length} pessoas` : ''}
          </span>
        </div>
      )}
    </Card>
  );
}

function Gallery({ media, start, onClose }: { media: PostDto['media']; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  return (
    <Sheet title={`Imagem ${i + 1} de ${media.length}`} onClose={onClose}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media[i]!.url} alt="" className="max-h-[65vh] w-full rounded-2xl object-contain" />
        {media.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            <IconBtn n="chevL" label="Anterior" box disabled={i === 0} onClick={() => setI(i - 1)} />
            <IconBtn n="chevR" label="Próxima" box disabled={i === media.length - 1} onClick={() => setI(i + 1)} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function CommentsSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useComments(id);
  const actions = useFeedActions();
  const toast = useToast();
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await actions.comment(id, t.trim());
      setT('');
      if (r.xp.gained > 0) toast(`Comentário publicado, +${r.xp.gained} XP`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível comentar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Comentários"
      onClose={onClose}
      footer={
        <form
          className="flex flex-1 gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (t.trim()) send();
          }}
        >
          <input value={t} onChange={e => setT(e.target.value)} maxLength={1000} placeholder="Escreva um comentário" className={inputCls} />
          <Button type="submit" disabled={busy || !t.trim()} aria-label="Enviar">
            <Icon n="send" className="h-4 w-4" />
          </Button>
        </form>
      }
    >
      {data && data.length === 0 && <p className="py-6 text-center text-muted">Seja a primeira pessoa a comentar.</p>}
      <div className="space-y-4">
        {data?.map(c => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} photo={c.author.photoUrl} size="w-9 h-9 text-xs" />
            <div className="flex-1 rounded-2xl bg-sunk px-3.5 py-2.5">
              <p className="text-sm font-semibold">
                {c.mine ? 'Você' : c.author.name} <span className="text-xs font-normal text-muted">{since(c.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[0.9375rem]">{c.text}</p>
            </div>
            {c.mine && (
              <IconBtn
                n="trash"
                label="Apagar comentário"
                className="h-8 w-8 self-center text-muted"
                onClick={() => actions.removeComment(id, c.id).catch(() => toast('Não foi possível apagar.'))}
              />
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
