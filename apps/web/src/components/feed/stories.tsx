'use client';

import { AREA, AREAS, type AreaId, STORY_CAPTION_MAX, type StoryGroupDto, VISIBILITY, type Visibility } from '@circle/shared';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ConfirmSheet } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { AreaIcon, Avatar, Field, inputCls, Seg, ImageHint } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useStories, useStoryActions, useStoryViewers } from '@/lib/stories';
import { since } from '@/lib/time';
import { uploadBlob } from '@/lib/upload';
import { StoryCropper } from '@/components/feed/story-cropper';

const STORY_MS = 5000;
const noop = () => () => undefined;

/** Ícones das áreas como marca d'água no canto inferior da foto. */
export function AreaWatermark({ areas, className = '' }: { areas: AreaId[]; className?: string }) {
  return (
    <span className={`pointer-events-none flex gap-1.5 ${className}`} aria-label={`Áreas: ${areas.map(a => AREA[a].name).join(', ')}`}>
      {areas.map(a => (
        // Mesmo ícone colorido da Roda da Vida, sobre fundo branco, com 75% de opacidade.
        <span key={a} className="rounded-full bg-white opacity-75">
          <AreaIcon id={a} size="w-9 h-9" icon="w-[1.125rem] h-[1.125rem]" />
        </span>
      ))}
    </span>
  );
}

/** Faixa de stories no topo do feed: criar post, seu story e os stories de quem você pode ver. */
export function StoryRow({ onNewPost }: { onNewPost: () => void }) {
  const { data: me } = useMe();
  const { data: groups } = useStories();
  // Só depois de montar: o servidor não conhece a pessoa logada (evita diferença na hidratação).
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const { openSheet } = useSheets();
  const mine = groups?.find(g => g.mine);
  const others = groups?.filter(g => !g.mine) ?? [];
  const open = (authorId: string) => {
    const list = groups ?? [];
    const i = list.findIndex(g => g.author.id === authorId);
    if (i >= 0) openSheet(close => <StoryViewer groups={list} start={i} onClose={close} />);
  };
  const newStory = () => openSheet(close => <StoryForm onClose={close} />);

  return (
    <div className="no-bar flex gap-3 overflow-x-auto px-4 pb-3 pt-2">
      <button onClick={onNewPost} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
        <span className="grid h-[4.125rem] w-[4.125rem] place-items-center rounded-2xl border border-line bg-surface shadow-soft">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-onprimary">
            <Icon n="plus" sw={2.5} />
          </span>
        </span>
        <span className="text-xs">Criar post</span>
      </button>
      {me && hydrated && (
        <div className="relative flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
          <button
            onClick={() => (mine ? open(me.id) : newStory())}
            aria-label={mine ? 'Ver seu story' : 'Publicar story'}
            className={`grid h-[4.125rem] w-[4.125rem] place-items-center rounded-full ring-offset-2 ring-offset-bg ${mine ? 'ring-2 ring-primary/40' : 'ring-2 ring-line'}`}
          >
            <Avatar name={me.name} photo={me.photoUrl} size="w-full h-full text-lg" />
          </button>
          <button
            onClick={newStory}
            aria-label="Novo story"
            className="absolute right-0.5 top-[2.875rem] grid h-6 w-6 place-items-center rounded-full bg-primary text-onprimary ring-2 ring-bg"
          >
            <Icon n="plus" className="h-3.5 w-3.5" sw={3} />
          </button>
          <span className="w-full truncate text-center text-xs">Seu story</span>
        </div>
      )}
      {others.map(g => (
        <button key={g.author.id} onClick={() => open(g.author.id)} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
          <span className={`grid h-[4.125rem] w-[4.125rem] place-items-center rounded-full ring-offset-2 ring-offset-bg ${g.allSeen ? 'ring-2 ring-line' : 'ring-[0.1875rem] ring-primary'}`}>
            <Avatar name={g.author.name} photo={g.author.photoUrl} size="w-full h-full text-lg" />
          </span>
          <span className={`w-full truncate text-center text-xs ${g.allSeen ? 'text-muted' : ''}`}>{g.author.name.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  );
}

/** Visualizador em tela cheia: barras de progresso, toque à esquerda/direita, curtir e "Visto por". */
export function StoryViewer({ groups: initial, start, onClose }: { groups: StoryGroupDto[]; start: number; onClose: () => void }) {
  const { data: live } = useStories();
  const actions = useStoryActions();
  const toast = useToast();
  const { openSheet } = useSheets();
  // Cópia da lista que estava na tela ao abrir, para a ordem não pular enquanto a pessoa assiste.
  const [groups] = useState(() => initial.map(x => ({ ...x, stories: [...x.stories] })));
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => Math.max(0, groups[start]!.stories.findIndex(s => !s.seen)));
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const last = useRef(0);

  // Curtidas e contagens vêm da lista atualizada.
  const g = groups[gi];
  const s0 = g?.stories[si];
  const s = s0 && (live?.flatMap(x => x.stories).find(x => x.id === s0.id) ?? s0);

  const close = () => {
    actions.refresh();
    onClose();
  };
  const next = () => {
    setElapsed(0);
    if (g && si < g.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setSi(0);
    } else close();
  };
  const prev = () => {
    setElapsed(0);
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(groups[gi - 1]!.stories.length - 1);
    }
  };

  useEffect(() => {
    if (s && g && !g.mine && !s.seen) void actions.view(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id]);

  useEffect(() => {
    if (paused) return;
    last.current = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      setElapsed(e => e + (now - last.current));
      last.current = now;
    }, 50);
    return () => clearInterval(t);
  }, [paused, gi, si]);

  useEffect(() => {
    if (elapsed >= STORY_MS) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  if (!g || !s) return null;
  const pct = Math.min(1, elapsed / STORY_MS);

  const pauseWhile = (open: (resume: () => void) => void) => {
    setPaused(true);
    open(() => setPaused(false));
  };

  return (
    <DialogPrimitive.Root open onOpenChange={o => !o && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-0 z-50 mx-auto flex max-w-lg flex-col bg-black text-white outline-none">
          <DialogPrimitive.Title className="sr-only">Story de {g.mine ? 'você' : g.author.name}</DialogPrimitive.Title>
          <div className="relative min-h-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt={s.caption || `Story de ${g.author.name}`} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
              <div className="flex gap-1">
                {g.stories.map((x, i) => (
                  <span key={x.id} className="h-[0.1875rem] flex-1 overflow-hidden rounded-full bg-white/35">
                    <span className="block h-full bg-white" style={{ width: `${i < si ? 100 : i === si ? pct * 100 : 0}%` }} />
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <Avatar name={g.author.name} photo={g.author.photoUrl} size="w-9 h-9 text-xs" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {g.mine ? 'Você' : g.author.name} <span className="font-normal text-white/70">{since(s.createdAt)}</span>
                </p>
                {g.mine && (
                  <button
                    aria-label="Apagar story"
                    className="grid h-9 w-9 place-items-center rounded-full text-white/90 hover:bg-white/10"
                    onClick={() =>
                      pauseWhile(resume =>
                        openSheet(c => (
                          <ConfirmSheet
                            title="Apagar story?"
                            confirm="Apagar"
                            danger
                            onConfirm={async () => {
                              await actions.remove(s.id);
                              toast('Story apagado');
                              if (g.stories.length === 1) onClose();
                              else {
                                g.stories.splice(si, 1);
                                setSi(Math.min(si, g.stories.length - 1));
                                setElapsed(0);
                              }
                            }}
                            onClose={() => {
                              c();
                              resume();
                            }}
                          >
                            A foto some para todos agora.
                          </ConfirmSheet>
                        )),
                      )
                    }
                  >
                    <Icon n="trash" className="h-5 w-5" />
                  </button>
                )}
                <DialogPrimitive.Close className="grid h-9 w-9 place-items-center rounded-full text-white/90 hover:bg-white/10" aria-label="Fechar">
                  <Icon n="x" className="h-6 w-6" />
                </DialogPrimitive.Close>
              </div>
            </div>
            <button aria-label="Story anterior" className="absolute bottom-24 left-0 top-24 w-1/3" onClick={prev} />
            <button
              aria-label="Próximo story"
              className="absolute bottom-24 right-0 top-24 w-2/3"
              onClick={next}
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
            />
            <AreaWatermark areas={s.areas} className="absolute bottom-4 right-4" />
          </div>
          <div className="flex items-center gap-3 px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.875rem)' }}>
            <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug">{s.caption}</p>
            {g.mine ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold"
                onClick={() => pauseWhile(resume => openSheet(c => <ViewersSheet id={s.id} onClose={() => (c(), resume())} />))}
              >
                <Icon n="eye" className="h-4 w-4" />
                Visto por {s.views ?? 0}
                {(s.likes ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-300">
                    <Icon n="heart" className="h-4 w-4" fill="currentColor" />
                    {s.likes}
                  </span>
                )}
              </button>
            ) : (
              <button
                aria-label={s.liked ? 'Descurtir' : 'Curtir'}
                aria-pressed={s.liked}
                className={`grid h-11 w-11 place-items-center rounded-full ${s.liked ? 'text-red-500' : 'text-white'}`}
                onClick={() => actions.like(s.id, !s.liked).catch(e => toast(e instanceof ApiError ? e.message : 'Não foi possível curtir.'))}
              >
                <Icon n="heart" className="h-7 w-7" fill={s.liked ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ViewersSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useStoryViewers(id);
  return (
    <Sheet title="Visto por" onClose={onClose}>
      {data && !data.length && <p className="py-6 text-center text-muted">Ninguém viu ainda.</p>}
      <ul className="divide-y divide-line">
        {data?.map(v => (
          <li key={v.person.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={v.person.name} photo={v.person.photoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{v.person.name}</p>
              <p className="text-xs text-muted">{since(v.viewedAt)}</p>
            </div>
            {v.liked && (
              <span className="text-red-500" aria-label="Curtiu">
                <Icon n="heart" className="h-5 w-5" fill="currentColor" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Publicar story: foto, 1 a 3 áreas (viram marca d'água), legenda curta e quem pode ver. */
export function StoryForm({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe();
  const actions = useStoryActions();
  const toast = useToast();
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(me?.preferences.defaultPostVisibility ?? 'publico');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setRawFile(file);
    setCropping(true);
  };

  const useCrop = async (blob: Blob) => {
    setCropping(false);
    setUploading(true);
    try {
      const up = await uploadBlob(blob, 'story', 'story.jpg');
      setPhoto({ id: up.id, url: up.url });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploading(false);
    }
  };

  const toggle = (a: AreaId) => setAreas(x => (x.includes(a) ? x.filter(y => y !== a) : [...x, a]));

  const publish = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const r = await actions.create({ fileId: photo.id, areas, caption: caption.trim(), visibility });
      toast(r.xp.gained > 0 ? `Story publicado, +${r.xp.gained} XP` : 'Story publicado');
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Novo story"
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={busy || uploading || !photo || !areas.length} onClick={publish}>
            Publicar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Campo de arquivo sempre montado, acionado pelos botões abaixo. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            pickFile(file);
          }}
        />
        {cropping && rawFile ? (
          <StoryCropper
            file={rawFile}
            onCancel={() => fileRef.current?.click()}
            onDone={useCrop}
          />
        ) : photo ? (
          <>
            <div className="relative mx-auto aspect-[9/16] w-48 overflow-hidden rounded-2xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              <AreaWatermark areas={areas} className="absolute bottom-2 right-2" />
            </div>
            <div className="mx-auto flex w-48 gap-2">
              <Button variant="line" className="flex-1" onClick={() => rawFile && setCropping(true)} disabled={!rawFile}>
                Ajustar
              </Button>
              <Button variant="line" className="flex-1" onClick={() => fileRef.current?.click()}>
                Trocar
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative mx-auto grid aspect-[9/16] w-48 place-items-center rounded-2xl border-2 border-dashed border-line bg-sunk p-4 text-center text-sm text-muted"
          >
            <span>
              <Icon n="camera" className="mx-auto mb-2 h-8 w-8" />
              {uploading ? 'Enviando…' : 'Escolher foto'}
            </span>
          </button>
        )}
        {!cropping && <ImageHint purpose="story" className="justify-center" />}
        <p className="text-center text-xs text-muted">O story some sozinho em 24 horas.</p>
        <Field label="Áreas da vida (1 ou mais)">
          <div className="mb-2 flex justify-end">
            {areas.length >= AREAS.length ? (
              <button type="button" onClick={() => setAreas([])} className="text-xs font-semibold text-muted">
                Limpar
              </button>
            ) : (
              <button type="button" onClick={() => setAreas(AREAS.map(a => a.id))} className="text-xs font-semibold text-primary">
                Marcar todas
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {AREAS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                aria-pressed={areas.includes(a.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm transition ${areas.includes(a.id) ? 'border-primary bg-primary/10' : 'border-line text-muted'}`}
              >
                <AreaIcon id={a.id} size="w-6 h-6" icon="w-3.5 h-3.5" />
                {a.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Legenda (opcional)">
          <input className={inputCls} maxLength={STORY_CAPTION_MAX} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Uma frase curta" />
        </Field>
        <Field label="Quem pode ver">
          <Seg items={VISIBILITY.map(v => ({ id: v.id, label: v.label }))} value={visibility} onChange={setVisibility} />
        </Field>
      </div>
    </Sheet>
  );
}

