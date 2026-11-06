'use client';

import {
  JOURNEY_PHASES,
  MINHA_VIDA_PHASES,
  NECRO_MIN_CHARS,
  SOCIAL_UNLOCK_PRICE,
  SOCIAL_WAIT_DAYS,
  sprintName,
  type JourneyDto,
  type JourneyPhase,
  GEMS,
  gemsLabel,
} from '@circle/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { api, ApiError } from '@/lib/api';
import { daysLeft, freeNow, inJourney, JOURNEY_KEY, useJourney, useJourneySeen, useUnlockSocial } from '@/lib/journey';
import { useMe } from '@/lib/me';
import { fmtDay, useSprints } from '@/lib/sprints';
import { Art, TrophyArt } from './art';
import { CoinIcon } from '@/components/coin';
import { ConfirmSheet } from './confirm';
import { PostForm } from './feed/post-form';
import { Icon, type IconName } from './icon';
import { Sheet, useSheets } from './sheet';
import { useToast } from './toasts';
import { Button } from './ui/button';

/** Pop-up de parabéns ao concluir uma fase da Jornada (a fase também fica destacada no caminho). */
export function PhaseCongratsSheet({ phase, onClose }: { phase: number; onClose: () => void }) {
  const p = JOURNEY_PHASES[phase - 1]!;
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="burst mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon n="checkCircle" className="h-11 w-11" sw={1.6} />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-primary">
          Etapa {phase} de {JOURNEY_PHASES.length}
        </p>
        <h2 className="mt-1 text-2xl font-bold">Parabéns, você concluiu essa etapa!</h2>
        <p className="mt-1 font-semibold">{p.title}</p>
        <p className="mt-2 text-muted">{p.congrats}</p>
        <Button className="mt-6 w-full" onClick={onClose}>
          Continuar
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * Orientação de cada etapa da Jornada: abre antes de a pessoa ir para a etapa
 * (o que é o exercício, por que importa no método e o que fazer para concluir).
 * Todos os textos ficam aqui.
 */
export const JOURNEY_GUIDES: Partial<Record<JourneyPhase, { about: string[]; todo: string }>> = {
  roda: {
    about: [
      'A Roda da Vida mostra como você está hoje em 10 áreas da sua vida, como saúde, família, finanças e carreira.',
      'Em cada área, você dá uma nota de 0 a 10 para o quanto está contente com ela. Responda com sinceridade: as notas são só suas.',
      'A roda não diz o que fazer. Ela é a fotografia do seu presente e o ponto de partida do seu Sprint da Vida.',
      'Travou em alguma área? Use o botão "Me ajude": ele traz perguntas para você refletir.',
    ],
    todo: 'Dê uma nota de 0 a 10 a cada uma das 10 áreas. As notas salvam sozinhas.',
  },
  maslow: {
    about: [
      'A Pirâmide de Maslow organiza as necessidades humanas em 5 níveis: fisiológicas, segurança, relacionamento, estima e autorrealização.',
      'As necessidades da base costumam precisar estar atendidas para você subir com tranquilidade.',
      'Aqui você marca o que já está atendido na sua vida, fora e dentro do trabalho, e descobre em que nível está hoje.',
      'Isso mostra o que é base e o que é sonho no seu planejamento.',
    ],
    todo: 'Abra um nível da pirâmide e marque pelo menos 1 item que já está atendido.',
  },
  quadro: {
    about: [
      'O Quadro de visualização reúne os seus maiores sonhos de vida, com imagem e área.',
      'Ver os seus sonhos dá foco, clareza e motivação para trabalhar neles.',
      'Pense grande: você pode ter até 10 sonhos abertos. Quando um se realizar, é só marcar como realizado.',
    ],
    todo: 'Toque em "Novo sonho" e cadastre pelo menos 1 sonho.',
  },
  necrologio: {
    about: [
      'Imagine que você viveu 70, 80, 90 anos, tudo o que deveria, e morreu. Um amigo jornalista vai escrever sobre quem você foi.',
      'Escreva no lugar dele: o que você realizou, quem você foi para as pessoas, o que deixou.',
      'Mire alto e seja sincero. "Teve um carro bonito" é raso.',
      'Esse texto vira a baliza da sua vida. Antes de cada sprint, você relê para ver se o que planeja conversa com ele.',
    ],
    todo: `Escreva pelo menos ${NECRO_MIN_CHARS} caracteres. O texto salva sozinho.`,
  },
  backlog: {
    about: [
      'Agora é hora de planejar. O backlog é a lista do que você quer fazer na vida, em 3 níveis.',
      'Iniciativa é um grande objetivo (ex.: "Vida longa e próspera"). Épico é um conjunto de entregas dentro dela (ex.: "Cuidar da saúde"). Tarefa é uma ação concreta (ex.: "Marcar um check-up").',
      'Use o que apareceu na Roda, na Pirâmide, no Quadro e no Necrológio. Se preferir, comece pela trilha "Primeiros passos": uma tarefa pronta em cada área da vida.',
      'Depois, escolha o que vai fazer nas próximas semanas e envie para a sprint.',
    ],
    todo: 'Crie 1 iniciativa, 1 épico e 1 tarefa (ou baixe a trilha "Primeiros passos") e envie pelo menos 1 tarefa para a sprint.',
  },
  sprint: {
    about: [
      'A sprint é um ciclo curto de execução: 7, 14 ou 30 dias. As tarefas que você enviou vão para o quadro, em A Fazer, Fazendo e Pronto.',
      'Dê um nome à sprint, escreva um objetivo se quiser e escolha a duração.',
      'Ela só começa quando você apertar "Iniciar sprint". Quando o prazo vencer, o app avisa e você decide quando encerrar.',
    ],
    todo: 'Na tela da sprint, aperte "Iniciar sprint".',
  },
};

/** Folha de orientação da etapa. "Começar" leva para a etapa. */
export function PhaseGuideSheet({ phase, href, onClose }: { phase: JourneyPhase; href: string; onClose: () => void }) {
  const router = useRouter();
  const n = JOURNEY_PHASES.findIndex(p => p.id === phase) + 1;
  const p = JOURNEY_PHASES[n - 1]!;
  const g = JOURNEY_GUIDES[phase];
  const go = () => {
    onClose();
    router.push(href);
  };
  return (
    <Sheet
      title={p.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="line" className="flex-1" onClick={onClose}>
            Agora não
          </Button>
          <Button className="flex-1" onClick={go}>
            Começar
          </Button>
        </>
      }
    >
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        Etapa {n} de {JOURNEY_PHASES.length}
      </p>
      <div className="mt-2 space-y-2 text-[0.9375rem] leading-relaxed text-ink/85">
        {g?.about.map(t => <p key={t}>{t}</p>)}
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-primary/5 p-4">
        <Icon n="target" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm">
          <span className="block font-semibold">Para concluir esta etapa</span>
          <span className="block text-ink/85">{g?.todo ?? p.goal}</span>
        </p>
      </div>
    </Sheet>
  );
}

/**
 * Botão "Voltar à Jornada" no fim da tela de um exercício: aparece só na Jornada
 * e quando a etapa já está concluída.
 */
export function BackToJourney({ phase }: { phase: JourneyPhase }) {
  const { data: me } = useMe();
  const on = inJourney(me);
  const { data: j } = useJourney(on);
  if (!on || !j?.phases.find(p => p.id === phase)?.done) return null;
  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-4 text-center">
      <p className="inline-flex items-center gap-1.5 font-semibold text-primary">
        <Icon n="checkCircle" className="h-5 w-5" />
        Etapa concluída
      </p>
      <p className="mt-1 text-sm text-muted">Volte à sua Jornada para seguir para a próxima etapa.</p>
      <Button className="mt-3 w-full" asChild>
        <Link href="/jornada">Voltar à Jornada</Link>
      </Button>
    </div>
  );
}

/**
 * Pop-up de etapa concluída no Backlog e na Sprint: quando a etapa termina ali mesmo,
 * mostra os parabéns (uma vez por etapa, pelo mesmo registro do pop-up da Jornada).
 * `watch` muda quando os dados da tela mudam: aí a Jornada é recarregada.
 */
export function JourneyStepDone({ phase, watch }: { phase: JourneyPhase; watch?: number }) {
  const { data: me } = useMe();
  const on = inJourney(me);
  const { data: j } = useJourney(on);
  const qc = useQueryClient();
  const seen = useJourneySeen();
  const { openSheet } = useSheets();
  const shown = useRef(false);
  const prev = useRef(watch);
  const n = JOURNEY_PHASES.findIndex(p => p.id === phase) + 1;

  useEffect(() => {
    if (on && prev.current && watch !== prev.current) qc.invalidateQueries({ queryKey: JOURNEY_KEY });
    prev.current = watch;
  }, [on, watch, qc]);

  const doneCount = j ? j.phases.filter(p => p.done && p.id !== 'concluir').length : 0;
  const due = Boolean(on && j?.active && j.welcomed && doneCount === n && j.phaseSeen < n);
  useEffect(() => {
    if (!due || shown.current) return;
    shown.current = true;
    seen.mutate(n);
    openSheet(close => <StepDoneSheet phase={n} onClose={close} />);
    // `seen` muda a cada render; o controle é pelo `shown`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due, n, openSheet]);
  return null;
}

function StepDoneSheet({ phase, onClose }: { phase: number; onClose: () => void }) {
  const router = useRouter();
  const p = JOURNEY_PHASES[phase - 1]!;
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="burst mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon n="checkCircle" className="h-11 w-11" sw={1.6} />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-primary">
          Etapa {phase} de {JOURNEY_PHASES.length}
        </p>
        <h2 className="mt-1 text-2xl font-bold">Você concluiu esta etapa da Jornada!</h2>
        <p className="mt-1 font-semibold">{p.title}</p>
        <p className="mt-2 text-muted">{p.congrats}</p>
        <Button
          className="mt-6 w-full"
          onClick={() => {
            onClose();
            router.push('/jornada');
          }}
        >
          Voltar à Jornada
        </Button>
        <Button variant="line" className="mt-2 w-full" onClick={onClose}>
          Continuar aqui
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * Liberar tudo (concluir a Jornada de vez). Antes dos 7 dias custa 500 gemas e sempre
 * pede confirmação (decisão do dono de 04/11/2026); depois dos 7 dias é de graça e direto.
 * Devolve uma função; `onDone` roda depois de liberar.
 */
export function useUnlockWithConfirm() {
  const { data: me } = useMe();
  const { openSheet } = useSheets();
  const toast = useToast();
  const unlock = useUnlockSocial();
  const run = () =>
    unlock.mutateAsync().then(
      () => toast('Tudo liberado!'),
      e => {
        toast(e instanceof ApiError ? e.message : 'Não foi possível liberar agora.');
        throw e;
      },
    );
  return {
    busy: unlock.isPending,
    start: (onDone?: () => void) => {
      if (!me) return;
      if (freeNow(me.social)) return void run().then(onDone, () => undefined);
      const left = me.xp.gems - SOCIAL_UNLOCK_PRICE;
      openSheet(close => (
        <ConfirmSheet title={`Gastar ${gemsLabel(SOCIAL_UNLOCK_PRICE)}?`} confirm={`Liberar por ${gemsLabel(SOCIAL_UNLOCK_PRICE)}`} onConfirm={() => run().then(onDone)} onClose={close}>
          <p>
            Você libera agora a rede social, amigos, grupos e a loja de trilhas completa. Seus círculos vão de{' '}
            <strong>{me.xp.gems.toLocaleString('pt-BR')}</strong> para <strong>{Math.max(0, left).toLocaleString('pt-BR')}</strong>.
          </p>
          {me.social.freeAt && <p className="mt-2 text-muted">Se preferir esperar, tudo libera de graça em {fmtDay(me.social.freeAt)}, e você fica com os círculos.</p>}
        </ConfirmSheet>
      ));
    },
  };
}

const UNLOCKS: { n: IconName; title: string; d: string }[] = [
  { n: 'home', title: 'Rede social', d: 'Feed e stories para acompanhar e celebrar as conquistas.' },
  { n: 'userPlus', title: 'Amigos', d: 'Adicione quem também está fazendo o Sprint da Vida.' },
  { n: 'users', title: 'Grupos', d: 'Pessoas com os mesmos objetivos, fóruns e trilhas do grupo.' },
  { n: 'bag', title: 'Loja de trilhas', d: 'Trilhas prontas para importar no seu backlog.' },
];

/**
 * Pop-up de "Concluir minha jornada": o prêmio (XP e gemas), o que é cada um,
 * o que vai ser liberado e a escolha entre liberar agora (500 gemas) ou aguardar 7 dias.
 */
export function FinishSheet({ prize, gems = GEMS.jornada, onClose }: { prize: number; gems?: number; onClose: () => void }) {
  const router = useRouter();
  const unlock = useUnlockWithConfirm();
  const now = () => unlock.start(onClose);
  const wait = () => {
    onClose();
    router.push('/board');
  };
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <TrophyArt className="burst mx-auto h-28 w-28" />
        <h2 className="mt-2 text-2xl font-bold">Parabéns! Você concluiu a sua jornada</h2>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-lg font-bold text-amber-600">
          <Icon n="star" className="h-5 w-5" fill="currentColor" />+{prize.toLocaleString('pt-BR')} XP
        </p>{' '}
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-lg font-bold text-amber-700">
          <CoinIcon className="h-5 w-5" />+{gemsLabel(gems)}
        </p>
      </div>
      <div className="mt-4 space-y-2 rounded-2xl bg-sunk/60 p-4 text-sm leading-relaxed">
        <p className="font-semibold">XP e círculos</p>
        <p>
          <strong>XP</strong> é a sua experiência: você ganha ao avançar (concluir tarefas, encerrar épicos e sprints, registrar a Roda, realizar
          sonhos) e ele só cresce.
        </p>
        <p>
          <strong>Círculos</strong> são a moeda do app: compram trilhas na loja e liberam funcionalidades. Você ganha círculos ao fechar uma sprint
          com todas as tarefas prontas e a cada dia seguido que abre o app.
        </p>
      </div>
      <p className="mt-4 font-semibold">Agora você pode liberar:</p>
      <div className="mt-2 space-y-2.5">
        {UNLOCKS.map(u => (
          <div key={u.title} className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Icon n={u.n} className="h-4 w-4" />
            </span>
            <span className="text-sm">
              <span className="block font-semibold">{u.title}</span>
              <span className="block text-muted">{u.d}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        <Button className="w-full" disabled={unlock.busy} onClick={now}>
          Liberar agora por {gemsLabel(SOCIAL_UNLOCK_PRICE)}
        </Button>
        <Button variant="line" className="w-full" onClick={wait}>
          Aguardar {SOCIAL_WAIT_DAYS} dias
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Se você aguardar, libera de graça e fica com todos os círculos.</p>
    </Sheet>
  );
}

/**
 * Troféu "Jornada concluída": quando tudo libera (500 gemas ou de graça depois dos 7 dias),
 * aparece uma vez, apresenta a rede social e oferece compartilhar a conclusão da sprint.
 * Fica montado em toda a área logada.
 */
export function JourneyDoneCelebration() {
  const { data: me } = useMe();
  const { openSheet } = useSheets();
  const qc = useQueryClient();
  const shown = useRef(false);
  const due = Boolean(me?.journey && me.social.open && !me.journeyCelebrated);
  useEffect(() => {
    if (!due || shown.current) return;
    shown.current = true;
    const seen = () => api('/journey/celebrated', { method: 'POST' }).then(() => qc.invalidateQueries({ queryKey: ['me'] }));
    openSheet(close => <JourneyDoneSheet onClose={() => (void seen(), close())} />);
  }, [due, openSheet, qc]);
  return null;
}

const SOCIAL_INTRO: { n: IconName; title: string; d: string }[] = [
  { n: 'home', title: 'Feed', d: 'Acompanhe e celebre as conquistas de amigos e grupos.' },
  { n: 'camera', title: 'Stories', d: 'Fotos que somem em 24 horas, com as áreas da vida.' },
  { n: 'users', title: 'Amigos e grupos', d: 'Pessoas com os mesmos objetivos, fóruns e trilhas do grupo.' },
  { n: 'share', title: 'Compartilhar', d: 'Ao concluir tarefas e sprints, você pode postar. Só se quiser.' },
];

function JourneyDoneSheet({ onClose }: { onClose: () => void }) {
  const { data: sprints } = useSprints();
  const { openSheet } = useSheets();
  const last = sprints?.history[0];
  const current = sprints?.current;
  const s = last ?? (current?.startAt ? current : undefined);
  const share = () => {
    onClose();
    openSheet(close => (
      <PostForm
        draft={{
          title: 'Concluí a minha Jornada no Sprint da Vida',
          text: last
            ? `Refleti sobre a minha vida, montei o meu backlog e encerrei a ${sprintName(last)}: ${last.doneCount} de ${last.totalCount} tarefas prontas.`
            : `Refleti sobre a minha vida, montei o meu backlog e comecei a ${s ? sprintName(s) : 'minha primeira sprint'}.`,
          refType: s ? 'sprint' : undefined,
          refId: s?.id,
        }}
        onClose={close}
      />
    ));
  };
  return (
    <Sheet title="" onClose={onClose}>
      <div className="pb-2 text-center">
        <TrophyArt className="burst mx-auto h-28 w-28" />
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-accent">Conquista desbloqueada</p>
        <h2 className="mt-1 text-2xl font-bold">Jornada concluída</h2>
        <p className="mt-1 text-muted">Você refletiu, planejou e executou. A conquista entrou em Minhas conquistas, em todas as áreas da vida.</p>
      </div>
      <div className="mt-4 rounded-2xl bg-sunk/60 p-4">
        <p className="font-semibold">A rede social está aberta</p>
        <div className="mt-3 space-y-3">
          {SOCIAL_INTRO.map(x => (
            <div key={x.title} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon n={x.n} className="h-4 w-4" />
              </span>
              <span className="text-sm">
                <span className="block font-semibold">{x.title}</span>
                <span className="block text-muted">{x.d}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-center font-semibold">Quer compartilhar a sua conclusão?</p>
      <div className="mt-3 flex gap-2">
        <Button variant="line" className="flex-1" onClick={onClose}>
          Agora não
        </Button>
        <Button className="flex-1" onClick={share}>
          <Icon n="share" className="h-4 w-4" />
          Compartilhar
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Compartilhar é opcional. Só aparece no feed se você publicar.</p>
    </Sheet>
  );
}

/** Tela de cadeado do que abre só ao concluir a Jornada (Feed, Grupos…). */
export function SocialLocked({ freeAt }: { freeAt: string | null }) {
  return (
    <div className="px-4 pb-8">
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        <div className="relative h-32">
          <Art v="lake" c="#ef4444" className="absolute inset-0 h-full w-full" />
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-primary shadow-soft">
            <Icon n="lock" className="h-7 w-7" />
          </span>
        </div>
        <div className="p-5">
          <h2 className="text-lg font-bold">Isso abre ao concluir a sua Jornada</h2>
          <p className="mt-1 text-sm text-muted">
            {freeAt
              ? `Libera de graça em ${fmtDay(freeAt)} (${daysLeft(freeAt) === 1 ? 'falta 1 dia' : `faltam ${daysLeft(freeAt)} dias`}), ou agora, por ${gemsLabel(SOCIAL_UNLOCK_PRICE)}, na sua Jornada.`
              : 'Amigos, grupos, feed e stories abrem quando você concluir as etapas da sua Jornada.'}
          </p>
          <Link href="/jornada" className="mt-4 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-onprimary">
            Ver a jornada
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Aviso ao tentar puxar para a sprint com o quadro trancado. */
export function BoardLockedSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Primeiro, Minha vida" onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon n="lock" className="h-5 w-5" />
        </span>
        <p className="text-[0.9375rem] leading-relaxed text-ink/85">
          O quadro e a sprint abrem quando você completar <strong>Minha vida</strong>: Roda da Vida, Pirâmide de Maslow, Quadro de visualização e
          Necrológio, nessa ordem, pela sua Jornada.
        </p>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="line" className="flex-1" onClick={onClose}>
          Entendi
        </Button>
        <Link href="/jornada" onClick={onClose} className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-onprimary">
          Ver a jornada
        </Link>
      </div>
    </Sheet>
  );
}

/** Tela de cadeado do quadro: mostra o que falta em Minha vida. */
export function BoardLocked({ j }: { j: JourneyDto | undefined }) {
  return (
    <div className="px-4 pb-8">
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        <div className="relative h-32">
          <Art v="forest" c="#5e873c" className="absolute inset-0 h-full w-full" />
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-primary shadow-soft">
            <Icon n="lock" className="h-7 w-7" />
          </span>
        </div>
        <div className="p-5">
          <h2 className="text-lg font-bold">O quadro abre depois de Minha vida</h2>
          <p className="mt-1 text-sm text-muted">Antes de executar, reflita: faça os 4 exercícios da sua Jornada, em ordem.</p>
          <div className="mt-4 divide-y divide-line">
            {MINHA_VIDA_PHASES.map(id => {
              const p = JOURNEY_PHASES.find(x => x.id === id)!;
              const done = j?.phases.find(x => x.id === id)?.done ?? false;
              return (
                <div key={id} className="flex items-center gap-3 py-2.5">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? 'bg-primary text-onprimary' : 'border border-line text-muted'}`}>
                    {done ? <Icon n="check" className="h-4 w-4" sw={3} /> : <Icon n="lock" className="h-3.5 w-3.5" />}
                  </span>
                  <span className={`flex-1 text-sm font-semibold ${done ? 'text-muted line-through' : ''}`}>{p.title}</span>
                </div>
              );
            })}
          </div>
          <Link href="/jornada" className="mt-4 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-onprimary">
            Ver a jornada
          </Link>
        </div>
      </div>
    </div>
  );
}
