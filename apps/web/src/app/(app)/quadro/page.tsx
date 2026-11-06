'use client';

import { AREA, MAX_OPEN_DREAMS, type AreaConquistasDto, type AreaId, type ConquistasDto, type DreamDto, type XpChange } from '@circle/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Media, TrophyArt } from '@/components/art';
import { AreaPicker } from '@/components/backlog/forms';
import { useCelebrate } from '@/components/celebrate';
import { ConfirmSheet } from '@/components/confirm';
import { Header } from '@/components/header';
import { Icon } from '@/components/icon';
import { BackToJourney } from '@/components/journey';
import { AreaIcon, Field, inputCls, Ring, Seg, ImageHint } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { api, ApiError, type Me } from '@/lib/api';
import { JOURNEY_KEY } from '@/lib/journey';
import { fmtDay } from '@/lib/sprints';
import { uploadImage } from '@/lib/upload';

type Tab = 'conquistas' | 'quadro';
const DREAMS = ['dreams'];
const CONQ = ['conquistas'];

export default function QuadroPage() {
  return (
    <Suspense>
      <Quadro />
    </Suspense>
  );
}

/** Quadro de visualização (sonhos) e Minhas conquistas (épicos e iniciativas por área). */
function Quadro() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get('aba') === 'conquistas' ? 'conquistas' : 'quadro';
  const setTab = (t: Tab) => router.replace(`/quadro?aba=${t}`);
  const { data: dreams } = useQuery({ queryKey: DREAMS, queryFn: () => api<DreamDto[]>('/dreams') });
  const { data: conq } = useQuery({ queryKey: CONQ, queryFn: () => api<ConquistasDto>('/conquistas') });
  const { openSheet } = useSheets();
  const openDream = (d?: DreamDto) => openSheet(close => <DreamSheet dream={d} onClose={close} />);

  const open = (dreams ?? []).filter(d => !d.doneAt);
  const done = (dreams ?? []).filter(d => d.doneAt);
  const pct = conq && conq.tasks.total ? conq.tasks.done / conq.tasks.total : 0;

  return (
    <>
      <Header
        title={tab === 'conquistas' ? 'Minhas conquistas' : 'Quadro de visualização'}
        sub={tab === 'conquistas' ? 'Celebre cada passo da sua jornada' : 'Registre seus 10 maiores sonhos de vida'}
        info={tab === 'conquistas' ? 'conquistas' : 'quadro'}
      />
      <div className="space-y-4 px-4 pb-8">
        <Seg
          items={[
            { id: 'conquistas' as const, label: 'Minhas conquistas', icon: 'trophy' },
            { id: 'quadro' as const, label: 'Quadro de visualizações', icon: 'eye' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'conquistas' && conq && (
          <>
            <div className="flex items-center gap-3 rounded-3xl bg-accent/[.07] p-5">
              <TrophyArt className="w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[1.0625rem] font-semibold">Você está evoluindo!</p>
                <p className="mt-1 text-sm text-muted">Cada conquista te aproxima da vida que você deseja viver.</p>
              </div>
              <Ring pct={pct} size={96} stroke={8} color="rgb(var(--a))" track="rgb(var(--a) / .15)">
                <span className="text-xl font-semibold text-accent">{Math.round(pct * 100)}%</span>
              </Ring>
            </div>
            {conq.journeyDoneAt && (
              <div className="flex items-center gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/[.07] p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600">
                  <Icon n="trophy" className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Jornada concluída</span>
                  <span className="block text-[0.8125rem] text-muted">
                    Em {fmtDay(conq.journeyDoneAt)} · vale para todas as áreas da vida
                  </span>
                </span>
              </div>
            )}
            <h2 className="text-[1.0625rem] font-semibold">Minhas conquistas por área da vida</h2>
            {conq.areas
              .filter(x => x.epics + x.initiatives + x.journey > 0)
              .map(x => {
                const a = AREA[x.area];
                const n = x.epics + x.initiatives + x.journey;
                return (
                  <button
                    key={x.area}
                    onClick={() => openSheet(close => <AreaConquistas area={x.area} onClose={close} />)}
                    className="flex w-full items-center gap-3 rounded-3xl border border-line/80 bg-surface p-4 text-left shadow-soft"
                  >
                    <AreaIcon id={x.area} size="w-12 h-12" icon="w-6 h-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1rem] font-semibold leading-tight">{a.name}</span>
                      <span className="block text-[0.8125rem] leading-snug text-muted">{a.tag}</span>
                      <span className="mt-1.5 block text-[0.8125rem] font-medium" style={{ color: a.color }}>
                        {n} {n === 1 ? 'conquista' : 'conquistas'}
                      </span>
                    </span>
                    <span className="flex gap-1.5">
                      {[a.art, 'forest' as const, 'sun' as const].map((art, i) => (
                        <Media key={i} m={{ art, c: a.color }} className={`h-12 w-12 rounded-xl ${i === 2 ? 'hidden min-[26.25rem]:block' : ''}`} />
                      ))}
                    </span>
                    <Icon n="chevR" className="h-4 w-4 text-muted" />
                  </button>
                );
              })}
            {conq.areas.every(x => x.epics + x.initiatives + x.journey === 0) && (
              <p className="py-8 text-center text-muted">Encerre um épico ou conclua uma iniciativa para ver suas conquistas aqui.</p>
            )}
          </>
        )}

        {tab === 'quadro' && dreams && (
          <>
            <p className="text-sm text-muted">
              Descreva seus sonhos mais significativos. Cada sonho representa um desejo importante. Quando realizar um, marque como realizado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {open.map(d => (
                <button key={d.id} onClick={() => openDream(d)} className="overflow-hidden rounded-3xl border border-line/80 bg-surface text-left shadow-soft">
                  <Media m={d.imageUrl ? { src: d.imageUrl } : { art: AREA[d.area].art, c: AREA[d.area].color }} className="aspect-[4/3] w-full" />
                  <div className="p-3">
                    <p className="line-clamp-3 font-medium leading-snug">{d.text}</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: AREA[d.area].color }} />
                      {AREA[d.area].name}
                    </p>
                  </div>
                </button>
              ))}
              {open.length < MAX_OPEN_DREAMS && (
                <button
                  onClick={() => openDream()}
                  className="grid min-h-[12.5rem] place-items-center rounded-3xl border-2 border-dashed border-line text-muted hover:border-primary/40 hover:text-primary"
                >
                  <span className="flex flex-col items-center gap-1.5 text-sm font-semibold">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon n="plus" />
                    </span>
                    Novo sonho
                  </span>
                </button>
              )}
            </div>
            <p className="text-center text-xs text-muted">
              {open.length} de {MAX_OPEN_DREAMS} sonhos
            </p>
            {done.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 font-semibold">
                  <Icon n="star" className="h-4 w-4 text-amber-500" fill="currentColor" />
                  Sonhos realizados
                </h2>
                <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
                  {done.map(d => (
                    <button key={d.id} onClick={() => openDream(d)} className="flex w-full items-center gap-3 p-3 text-left">
                      <Media m={d.imageUrl ? { src: d.imageUrl } : { art: AREA[d.area].art, c: AREA[d.area].color }} className="h-11 w-11 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-medium">{d.text}</span>
                        <span className="block text-xs text-muted">Realizado em {new Date(d.doneAt!).toLocaleDateString('pt-BR')}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <BackToJourney phase="quadro" />
          </>
        )}
      </div>
    </>
  );
}

/** Folha de um sonho: imagem, texto, área; "Realizei" e excluir. */
function DreamSheet({ dream, onClose }: { dream?: DreamDto; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const { openSheet } = useSheets();
  const [f, setF] = useState({ text: dream?.text ?? '', area: (dream?.area ?? 'lazer') as AreaId });
  const [image, setImage] = useState<{ id: string | null; url: string | null }>({ id: dream?.imageFileId ?? null, url: dream?.imageUrl ?? null });
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: DREAMS });
    qc.invalidateQueries({ queryKey: CONQ });
    // Um sonho novo pode concluir a etapa da Jornada.
    qc.invalidateQueries({ queryKey: JOURNEY_KEY });
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      refresh();
      return true;
    } catch (e) {
      toast(e instanceof ApiError || e instanceof Error ? e.message : 'Algo deu errado.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const body = { text: f.text.trim(), area: f.area, imageFileId: image.id };
  const save = () =>
    run(() => (dream ? api(`/dreams/${dream.id}`, { method: 'PATCH', body }) : api('/dreams', { method: 'POST', body }))).then(ok => {
      if (ok) {
        toast('Sonho salvo');
        onClose();
      }
    });
  const realize = () =>
    run(async () => {
      if (dream) {
        await api(`/dreams/${dream.id}`, { method: 'PATCH', body });
        const r = await api<{ xp: XpChange }>(`/dreams/${dream.id}/realize`, { method: 'POST' });
        qc.setQueryData<Me>(['me'], m => m && { ...m, xp: { total: r.xp.total, gems: r.xp.gems } });
        onClose();
        celebrate({ icon: 'star', title: 'Sonho realizado', text: f.text, xp: r.xp.gained, area: f.area, refType: 'sonho', refId: dream.id });
      }
    });

  return (
    <Sheet
      title={dream ? (dream.doneAt ? 'Sonho realizado' : 'Sonho') : 'Novo sonho'}
      onClose={onClose}
      footer={
        <>
          {dream && (
            <Button
              variant="danger"
              aria-label="Excluir sonho"
              onClick={() =>
                openSheet(close => (
                  <ConfirmSheet
                    title="Excluir sonho"
                    confirm="Excluir"
                    danger
                    onClose={close}
                    onConfirm={async () => {
                      await api(`/dreams/${dream.id}`, { method: 'DELETE' });
                      refresh();
                      onClose();
                    }}
                  >
                    “{dream.text}” será excluído. Não dá para desfazer.
                  </ConfirmSheet>
                ))
              }
            >
              <Icon n="trash" className="h-4 w-4" />
            </Button>
          )}
          {dream && !dream.doneAt && (
            <Button variant="pline" className="flex-1" disabled={!f.text.trim() || busy} onClick={realize}>
              <Icon n="trophy" className="h-4 w-4" />
              Realizei
            </Button>
          )}
          <Button className="flex-1" disabled={!f.text.trim() || busy} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="relative block cursor-pointer overflow-hidden rounded-2xl">
          <Media m={image.url ? { src: image.url } : { art: AREA[f.area].art, c: AREA[f.area].color }} className="aspect-[4/3] w-full" />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white">
            <Icon n="camera" className="h-4 w-4" />
            {busy ? 'Enviando…' : image.url ? 'Trocar imagem' : 'Escolher imagem'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              await run(async () => {
                const up = await uploadImage(file, 'dream', 1200);
                setImage({ id: up.id, url: up.url });
              });
            }}
          />
        </label>
        <ImageHint purpose="dream" />
        {image.url && (
          <button className="text-sm text-muted" onClick={() => setImage({ id: null, url: null })}>
            Remover imagem
          </button>
        )}
        <Field label="O sonho">
          <textarea
            autoFocus={!dream}
            rows={2}
            maxLength={300}
            className={inputCls}
            value={f.text}
            onChange={e => setF({ ...f, text: e.target.value })}
            placeholder="Ex.: Ver a aurora boreal com quem eu amo"
          />
        </Field>
        <div>
          <span className="mb-2 block text-sm font-semibold">Área da vida</span>
          <AreaPicker value={f.area} onChange={area => setF({ ...f, area })} />
        </div>
      </div>
    </Sheet>
  );
}

/** Conquistas de uma área: épicos encerrados e iniciativas concluídas. */
function AreaConquistas({ area, onClose }: { area: AreaId; onClose: () => void }) {
  const a = AREA[area];
  const { data } = useQuery({ queryKey: ['conquistas', area], queryFn: () => api<AreaConquistasDto>(`/conquistas/${area}`) });
  return (
    <Sheet title={a.name} icon={<AreaIcon id={area} />} onClose={onClose}>
      <p className="-mt-1 mb-4 text-sm text-muted">{a.tag}</p>
      {data?.journeyDoneAt && (
        <>
          <h3 className="mb-2 font-semibold">Jornada</h3>
          <p className="mb-4 flex items-center gap-2 text-[0.9375rem]">
            <Icon n="trophy" className="h-4 w-4 text-amber-600" />
            Jornada concluída
            <span className="text-sm text-muted">· {fmtDay(data.journeyDoneAt)}</span>
          </p>
        </>
      )}
      {data && data.initiatives.length > 0 && (
        <>
          <h3 className="mb-2 font-semibold">Iniciativas concluídas</h3>
          <div className="mb-4 space-y-1.5">
            {data.initiatives.map(i => (
              <p key={i.id} className="flex items-center gap-2 text-[0.9375rem]">
                <Icon n="target" className="h-4 w-4 text-primary" />
                {i.title}
              </p>
            ))}
          </div>
        </>
      )}
      {data && data.epics.length > 0 && (
        <>
          <h3 className="mb-2 font-semibold">Épicos encerrados</h3>
          <div className="space-y-1.5">
            {data.epics.map(e => (
              <p key={e.id} className="flex items-center gap-2 text-[0.9375rem]">
                <Icon n="trophy" className="h-4 w-4" style={{ color: a.color }} />
                {e.title}
              </p>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
