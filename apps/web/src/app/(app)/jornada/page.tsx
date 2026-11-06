'use client';

import { AREA_IDS, JOURNEY_PHASES, NECRO_MIN_CHARS, gemsLabel, SOCIAL_UNLOCK_PRICE, STARTER_TRILHA_ID, type ArtVariant, type JourneyDto, type JourneyPhase } from '@circle/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Art, Logo } from '@/components/art';
import { Bell } from '@/components/bell';
import { Icon, type IconName } from '@/components/icon';
import { FinishSheet, PhaseCongratsSheet, PhaseGuideSheet, useUnlockWithConfirm } from '@/components/journey';
import { Bar } from '@/components/primitives';
import { Sheet, useSheets } from '@/components/sheet';
import { useToast } from '@/components/toasts';
import { TrilhaSheet } from '@/components/trilhas/trilha-sheets';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { daysLeft, freeNow, journeyActive, useFinishJourney, useJourney, useJourneySeen, useJourneyWelcome } from '@/lib/journey';
import { useMe } from '@/lib/me';
import { fmtDay } from '@/lib/sprints';

const LOOK: Record<JourneyPhase, { art: ArtVariant; c: string; icon: IconName; chapter: string }> = {
  roda: { art: 'lake', c: '#3b82f6', icon: 'wheel', chapter: 'Minha vida' },
  maslow: { art: 'field', c: '#5e873c', icon: 'triangle', chapter: 'Minha vida' },
  quadro: { art: 'sea', c: '#f59e0b', icon: 'eye', chapter: 'Minha vida' },
  necrologio: { art: 'night', c: '#7c4dde', icon: 'feather', chapter: 'Minha vida' },
  backlog: { art: 'forest', c: '#14b8a6', icon: 'backlog', chapter: 'Planejar' },
  sprint: { art: 'sun', c: '#16a34a', icon: 'flag', chapter: 'Executar' },
  concluir: { art: 'sun', c: '#d97706', icon: 'trophy', chapter: 'Concluir' },
};

/**
 * Jornada de primeiro acesso (decisões do dono de 03 e 04/11/2026): fica no lugar do
 * Feed até a pessoa concluir de vez. Sete fases em ordem; cada uma só abre quando a
 * anterior termina, e cada conclusão mostra um pop-up de parabéns.
 */
export default function JornadaPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: me } = useMe();
  const { data: j } = useJourney();
  const { openSheet } = useSheets();
  const finish = useFinishJourney();
  const unlock = useUnlockWithConfirm();
  const highlight = useCongrats(j);
  useWelcome(j);

  // Quem não está na Jornada (ou já liberou tudo) vai para o Feed.
  useEffect(() => {
    if (me && !journeyActive(me)) router.replace('/feed');
  }, [me, router]);

  if (!j) return <Top />;

  const doneCount = j.phases.filter(p => p.done).length;
  const first = me?.name.split(' ')[0] ?? '';
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : 'Algo deu errado. Tente de novo.');
  const conclude = () => finish.mutateAsync().then(r => openSheet(close => <FinishSheet prize={r.xp.gained || j.prize} onClose={close} />), fail);
  const free = () => unlock.start();

  return (
    <>
      <Top />
      <div className="px-4 pb-10">
        <section className="relative overflow-hidden rounded-3xl shadow-soft">
          <Art v="sun" c="#5e873c" className="absolute inset-0 h-full w-full" />
          <div className="relative bg-gradient-to-t from-black/50 via-black/15 to-transparent p-5 pt-14 text-white">
            <p className="text-sm font-medium opacity-90">{first ? `Olá, ${first}` : ' '}</p>
            <h1 className="mt-0.5 text-[1.375rem] font-bold leading-tight">Bem-vindo à sua jornada.</h1>
            <p className="mt-1 text-sm opacity-90">Siga o passo a passo para conhecer o método e aproveitar tudo o que o app tem.</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <Bar pct={doneCount / j.phases.length} color="#ffffff" track="bg-white/30" />
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {doneCount} de {j.phases.length}
              </span>
            </div>
          </div>
        </section>

        <div className="mt-6">
          {JOURNEY_PHASES.map((p, i) => {
            const state = j.phases[i]!.done ? 'done' : j.current === p.id ? 'current' : 'locked';
            const prevChapter = i > 0 ? LOOK[JOURNEY_PHASES[i - 1]!.id].chapter : null;
            return (
              <div key={p.id}>
                {LOOK[p.id].chapter !== prevChapter && <p className="mb-2 mt-2 text-center text-xs font-bold uppercase tracking-wider text-muted">{LOOK[p.id].chapter}</p>}
                <PhaseCard
                  n={i + 1}
                  id={p.id}
                  title={p.title}
                  goal={p.goal}
                  state={state}
                  side={i % 2 ? 'right' : 'left'}
                  highlight={highlight === i + 1}
                  detail={detailOf(p.id, j)}
                  actions={actionsOf(p.id, p.href, state, j, {
                    starter: () => openSheet(close => <TrilhaSheet id={STARTER_TRILHA_ID} onClose={close} />),
                    guide: (id, href) => openSheet(close => <PhaseGuideSheet phase={id} href={href} onClose={close} />),
                    conclude,
                    free,
                    busy: finish.isPending || unlock.busy,
                  })}
                />
                {i < JOURNEY_PHASES.length - 1 && <Trail from={i % 2 ? 'right' : 'left'} done={state === 'done'} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Top() {
  return (
    <header className="sticky z-20 flex items-center gap-2.5 bg-bg/90 px-4 pb-2 pt-3 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <Logo className="h-10 w-10" />
      <p className="flex-1 text-[1.375rem] font-bold tracking-tight">Sua jornada</p>
      <Bell />
    </header>
  );
}

/** Progresso dentro da fase (contadores e checklists). */
function detailOf(id: JourneyPhase, j: JourneyDto): ReactNode {
  const d = j.detail;
  if (id === 'roda') return <span className="tabular-nums">{Math.min(d.rodaAreas, AREA_IDS.length)}/{AREA_IDS.length} áreas com nota</span>;
  if (id === 'necrologio') return <span className="tabular-nums">{Math.min(d.necroChars, NECRO_MIN_CHARS)}/{NECRO_MIN_CHARS} caracteres</span>;
  if (id === 'backlog')
    return (
      <span className="flex flex-wrap gap-1.5">
        {(
          [
            ['Iniciativa', d.backlog.initiative],
            ['Épico', d.backlog.epic],
            ['Tarefa', d.backlog.task],
            ['Na sprint', d.backlog.inSprint],
          ] as const
        ).map(([label, ok]) => (
          <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-primary/10 text-primary' : 'bg-sunk text-muted'}`}>
            {ok && <Icon n="check" className="h-3 w-3" sw={3} />}
            {label}
          </span>
        ))}
      </span>
    );
  if (id === 'concluir' && j.finished && j.social.freeAt && !freeNow(j.social))
    return (
      <span>
        Libera de graça em {fmtDay(j.social.freeAt)} ({daysLeft(j.social.freeAt) === 1 ? 'falta 1 dia' : `faltam ${daysLeft(j.social.freeAt)} dias`}).
      </span>
    );
  return null;
}

type Action = { label: string; href?: string; onClick?: () => void; primary?: boolean; disabled?: boolean };

function actionsOf(
  id: JourneyPhase,
  href: string,
  state: 'done' | 'current' | 'locked',
  j: JourneyDto,
  fx: { starter: () => void; guide: (id: JourneyPhase, href: string) => void; conclude: () => void; free: () => void; busy: boolean },
): Action[] {
  if (state === 'locked') return [];
  if (id === 'concluir') {
    if (!j.finished) return [{ label: 'Concluir minha jornada', onClick: fx.conclude, primary: true, disabled: fx.busy }];
    if (freeNow(j.social)) return [{ label: 'Concluir jornada', onClick: fx.free, primary: true, disabled: fx.busy }];
    return [{ label: `Liberar agora por ${gemsLabel(SOCIAL_UNLOCK_PRICE)}`, onClick: fx.free, primary: true, disabled: fx.busy }];
  }
  if (id === 'sprint') return state === 'current' ? [{ label: 'Iniciar sprint', onClick: () => fx.guide(id, href), primary: true }] : [];
  if (id === 'backlog')
    return state === 'current'
      ? [
          { label: 'Ir para o backlog', onClick: () => fx.guide(id, '/backlog?aba=tarefas'), primary: true },
          { label: 'Minha primeira trilha', onClick: fx.starter },
        ]
      : [{ label: 'Ver o backlog', href: '/backlog' }];
  // Na etapa atual, antes de ir, abre a orientação do exercício.
  if (state === 'current') return [{ label: 'Começar', onClick: () => fx.guide(id, href), primary: true }];
  return [{ label: 'Rever', href }];
}

function PhaseCard({
  n,
  id,
  title,
  goal,
  state,
  side,
  highlight,
  detail,
  actions,
}: {
  n: number;
  id: JourneyPhase;
  title: string;
  goal: string;
  state: 'done' | 'current' | 'locked';
  side: 'left' | 'right';
  highlight: boolean;
  detail: ReactNode;
  actions: Action[];
}) {
  const look = LOOK[id];
  const locked = state === 'locked';
  return (
    <article
      className={`relative w-[88%] overflow-hidden rounded-2xl border bg-surface shadow-soft transition ${side === 'right' ? 'ml-auto' : ''} ${
        highlight ? 'burst border-primary ring-4 ring-primary/30' : state === 'current' ? 'border-primary ring-2 ring-primary/30' : 'border-line/80'
      } ${locked ? 'opacity-55' : ''}`}
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <Art v={look.art} c={look.c} className="h-full w-full" />
          <span className="absolute inset-0 grid place-items-center" style={{ color: look.c }}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90">
              <Icon n={locked ? 'lock' : look.icon} className="h-5 w-5" />
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">Etapa {n}</span>
            {state === 'current' && <span className="rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold text-onprimary">Agora</span>}
            {state === 'done' && (
              <span className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-primary text-onprimary" aria-label="Concluída">
                <Icon n="check" className="h-3.5 w-3.5" sw={3} />
              </span>
            )}
          </div>
          <h2 className="mt-0.5 font-bold leading-snug">{title}</h2>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{locked ? 'Abre quando você concluir a etapa anterior.' : goal}</p>
          {detail && !locked && <div className="mt-1.5 text-xs text-muted">{detail}</div>}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex gap-2 border-t border-line/70 px-3 py-2">
          {actions.map(a => {
            const cls = `flex-1 rounded-xl py-2 text-center text-sm font-semibold disabled:opacity-50 ${
              a.primary ? 'bg-primary text-onprimary' : 'border border-line text-ink/80'
            }`;
            return a.href ? (
              <Link key={a.label} href={a.href} className={cls}>
                {a.label}
              </Link>
            ) : (
              <button key={a.label} onClick={a.onClick} disabled={a.disabled} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

/** Trecho do caminho entre duas paradas (curva tracejada de um lado para o outro). */
function Trail({ from, done }: { from: 'left' | 'right'; done: boolean }) {
  const d = from === 'left' ? 'M25 0 C25 30, 75 10, 75 40' : 'M75 0 C75 30, 25 10, 25 40';
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={done ? 'rgb(var(--p))' : 'rgb(var(--muted) / .45)'} strokeWidth="2.5" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Pop-up de parabéns: quando há uma fase concluída que ainda não teve pop-up, mostra o
 * da última e destaca a fase no caminho. A fase "Concluir" tem o seu próprio pop-up.
 */
function useCongrats(j: JourneyDto | undefined) {
  const { openSheet } = useSheets();
  const seen = useJourneySeen();
  const [highlight, setHighlight] = useState(0);
  const shownFor = useRef(0);
  const doneCount = j ? j.phases.filter(p => p.done && p.id !== 'concluir').length : 0;
  useEffect(() => {
    if (!j?.active || !j.welcomed || doneCount <= j.phaseSeen || shownFor.current >= doneCount) return;
    shownFor.current = doneCount;
    setHighlight(doneCount);
    seen.mutate(doneCount);
    openSheet(close => <PhaseCongratsSheet phase={doneCount} onClose={close} />);
    // `seen` muda a cada render; o controle é pelo número da fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j?.active, j?.welcomed, j?.phaseSeen, doneCount, openSheet]);
  return highlight;
}

/** Boas-vindas na primeira vez que a pessoa abre a Jornada. */
function useWelcome(j: JourneyDto | undefined) {
  const { openSheet } = useSheets();
  const welcome = useJourneyWelcome();
  const shown = useRef(false);
  useEffect(() => {
    if (!j || !j.active || j.welcomed || shown.current) return;
    shown.current = true;
    openSheet(close => (
      <Sheet title="" onClose={() => (welcome.mutate(), close())}>
        <div className="pb-2 text-center">
          <div className="mx-auto h-28 w-full overflow-hidden rounded-2xl">
            <Art v="sun" c="#5e873c" className="h-full w-full" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Boas-vindas ao Sprint da Vida</h2>
          <div className="mt-2 space-y-2 text-left text-[0.9375rem] leading-relaxed text-ink/85">
            <p>
              Aqui você usa o jeito de trabalhar dos times ágeis na sua vida. Mas antes de planejar, vem a reflexão: <strong>Minha vida</strong>, com 4
              exercícios.
            </p>
            <p>Siga a sua jornada, um passo de cada vez. No fim, você ganha um prêmio e libera tudo o que o app tem.</p>
          </div>
          <Button className="mt-6 w-full" onClick={() => (welcome.mutate(), close())}>
            Começar a jornada
          </Button>
        </div>
      </Sheet>
    ));
    // Só uma vez por carregamento da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j?.welcomed, j?.active]);
}
