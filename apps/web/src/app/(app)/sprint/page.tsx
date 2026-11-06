'use client';

import { SPRINT_LENGTHS, sprintName, type SprintDto } from '@circle/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCelebrate } from '@/components/celebrate';
import { Header } from '@/components/header';
import { BoardLocked, JourneyStepDone } from '@/components/journey';
import { inJourney, useBoardLocked, useJourney } from '@/lib/journey';
import { useMe } from '@/lib/me';
import { Icon } from '@/components/icon';
import { Card, Field, inputCls } from '@/components/primitives';
import { useToast } from '@/components/toasts';
import { Button } from '@/components/ui/button';
import { useBacklog } from '@/lib/backlog';
import { boardTasks, fmtDay, fmtShort, sprintPeriod, useCloseSprint, useSprints, useStartSprint, useUpdateSprint } from '@/lib/sprints';

/**
 * Tela da sprint (decisão do dono de 03/11/2026): nome, objetivo e duração;
 * "Iniciar sprint" (precisa de 1 tarefa em A Fazer) e "Encerrar sprint";
 * histórico das anteriores. A duração saiu das Configurações e veio para cá.
 */
export default function SprintPage() {
  const { data: sprints } = useSprints();
  const { data } = useBacklog();
  const locked = useBoardLocked();
  const { data: journey } = useJourney();
  if (locked)
    return (
      <>
        <Header title="Sprint" fallback="/jornada" />
        <BoardLocked j={journey} />
      </>
    );
  if (!sprints || !data) return <Header title="Sprint" fallback="/board" />;
  return (
    <>
      <SprintScreen key={sprints.current.id} s={sprints.current} history={sprints.history} board={boardTasks(data)} />
      <JourneyStepDone phase="sprint" />
    </>
  );
}

function SprintScreen({ s, history, board }: { s: SprintDto; history: SprintDto[]; board: ReturnType<typeof boardTasks> }) {
  const router = useRouter();
  const toast = useToast();
  const celebrate = useCelebrate();
  const update = useUpdateSprint();
  const start = useStartSprint();
  const close = useCloseSprint();
  const { data: me } = useMe();
  const { data: journey } = useJourney();
  const [f, setF] = useState({ name: s.name, description: s.description, length: s.length });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setF({ name: s.name, description: s.description, length: s.length }), [s.name, s.description, s.length]);

  const started = Boolean(s.startAt);
  const dirty = f.name !== s.name || f.description !== s.description || f.length !== s.length;
  const todo = board.filter(t => t.status === 'todo').length;
  const doing = board.filter(t => t.status === 'doing').length;
  const done = board.filter(t => t.status === 'done').length;
  const open = todo + doing;
  const full = board.length > 0 && open === 0;
  const lengthLabel = SPRINT_LENGTHS.find(l => l.days === f.length)?.hint;

  const begin = async () => {
    const r = await start.mutateAsync(f);
    const name = sprintName(r.sprint);
    toast(r.sprint.plannedEnd ? `${name} começou! Termina em ${fmtDay(r.sprint.plannedEnd)}.` : `${name} começou! Sem prazo: encerre quando quiser.`);
    // Na Jornada, a primeira sprint conclui a etapa: fica aqui e o pop-up de parabéns leva de volta à Jornada.
    if (inJourney(me) && journey && !journey.phases.find(p => p.id === 'sprint')?.done) return;
    // Pela Jornada, volta para a Jornada (o próximo passo é concluí-la); senão, vai para o quadro.
    router.push(new URLSearchParams(window.location.search).get('de') === 'jornada' ? '/jornada' : '/board');
  };

  const finish = async () => {
    const r = await close.mutateAsync();
    setConfirm(false);
    celebrate({
      icon: 'flag',
      title: `${sprintName(r.closed)} concluída`,
      text: `${r.done} ${r.done === 1 ? 'tarefa entregue' : 'tarefas entregues'}${r.open ? `, ${r.open} ${r.open === 1 ? 'voltou' : 'voltaram'} ao backlog` : ''}.`,
      xp: r.xp.gained,
      gems: r.xp.gemsGained,
      refType: 'sprint',
      refId: r.closed.id,
    });
  };

  return (
    <>
      <Header title={sprintName({ name: f.name, number: s.number })} sub={sprintPeriod(s)} fallback="/board" />
      <div className="space-y-4 px-4 pb-8">
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              started ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-700'
            }`}
          >
            <Icon n={started ? 'flag' : 'calendar'} className="h-3.5 w-3.5" />
            {started ? 'Em andamento' : 'Em planejamento'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['A Fazer', todo],
              ['Fazendo', doing],
              ['Prontas', done],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-sunk p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{n}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        <Card className="space-y-4 p-4">
          <Field label="Nome">
            <input className={inputCls} value={f.name} maxLength={60} placeholder={`Sprint ${s.number}`} onChange={e => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Objetivo (opcional)">
            <textarea
              className={inputCls + ' min-h-20 resize-y'}
              value={f.description}
              maxLength={1000}
              placeholder="O que você quer entregar nesta sprint?"
              onChange={e => setF({ ...f, description: e.target.value })}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Duração</p>
            <div className="grid grid-cols-2 gap-2">
              {SPRINT_LENGTHS.map(l => {
                const on = f.length === l.days;
                return (
                  <button
                    key={l.days}
                    onClick={() => setF({ ...f, length: l.days })}
                    aria-pressed={on}
                    className={`rounded-xl border p-3 text-left transition ${on ? 'border-primary bg-primary/5' : 'border-line hover:bg-sunk'}`}
                  >
                    <span className={`block text-sm font-semibold ${on ? 'text-primary' : ''}`}>{l.label}</span>
                    <span className="block text-xs text-muted">{l.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-sunk px-3 py-2.5 text-sm text-muted">
            <Icon n="calendar" className="mt-0.5 h-4 w-4 shrink-0" />
            {started
              ? `Começou em ${fmtShort(s.startAt!)}${s.plannedEnd ? ` · termina em ${fmtShort(s.plannedEnd)}` : ' · sem prazo'}. Quando o prazo vence, você recebe um aviso; quem encerra é você.`
              : `Começa quando você apertar "Iniciar sprint"${f.length ? ` e dura ${lengthLabel}` : ', sem prazo'}.`}
          </p>
          {started && dirty && (
            <Button className="w-full" variant="line" disabled={update.isPending} onClick={() => update.mutateAsync(f).then(() => toast('Sprint atualizada'))}>
              Salvar alterações
            </Button>
          )}
        </Card>

        {!started && (
          <div className="space-y-2">
            {todo === 0 && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800">
                Para iniciar, puxe pelo menos uma tarefa do{' '}
                <Link href="/backlog" className="font-semibold underline">
                  backlog
                </Link>{' '}
                para A Fazer.
              </p>
            )}
            {done > 0 && (
              <p className="rounded-xl bg-sunk px-3 py-2.5 text-sm text-muted">
                {done === 1 ? '1 tarefa concluída' : `${done} tarefas concluídas`} sem sprint vai sair do quadro ao iniciar (sem XP).
              </p>
            )}
            <Button className="w-full" disabled={todo === 0 || start.isPending} onClick={begin}>
              <Icon n="flag" className="h-4 w-4" />
              Iniciar sprint
            </Button>
          </div>
        )}

        {started &&
          (!confirm ? (
            <Button className="w-full" variant="line" onClick={() => setConfirm(true)}>
              Encerrar sprint
            </Button>
          ) : (
            <Card className="space-y-3 p-4 text-sm leading-relaxed">
              <p>
                As tarefas prontas saem do quadro e vão para os relatórios. As em aberto voltam para o backlog.
                {full ? ' Sprint completa: todas as tarefas prontas.' : ''}
              </p>
              <p className="rounded-xl bg-primary/5 px-3 py-2.5 font-medium text-primary">
                A <strong>Sprint {s.number + 1}</strong> fica em planejamento: você monta e inicia quando quiser.
              </p>
              <div className="flex gap-2">
                <Button variant="line" className="flex-1" onClick={() => setConfirm(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" disabled={close.isPending} onClick={finish}>
                  Confirmar encerramento
                </Button>
              </div>
            </Card>
          ))}

        <Link href="/necrologio" className="block w-full rounded-2xl border border-accent/20 bg-accent/5 p-4 text-left">
          <p className="font-semibold text-accent">{started ? 'Para lembrar o porquê' : 'Antes de começar'}</p>
          <p className="mt-0.5 text-sm text-muted">Releia o seu necrológio e veja se o backlog ainda conversa com ele.</p>
        </Link>

        <div>
          <h2 className="mb-2 font-semibold">Sprints anteriores</h2>
          <Card className="divide-y divide-line">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{sprintName(h)}</span>
                <span className="text-muted">
                  {h.startAt && fmtShort(h.startAt)}
                  {(h.closedAt ?? h.plannedEnd) && ` a ${fmtShort(h.closedAt ?? h.plannedEnd!)}`}
                </span>
                <span className="w-10 text-right tabular-nums">
                  {h.doneCount}/{h.totalCount}
                </span>
              </div>
            ))}
            {!history.length && <p className="px-4 py-3 text-sm text-muted">Esta é a sua primeira sprint.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
