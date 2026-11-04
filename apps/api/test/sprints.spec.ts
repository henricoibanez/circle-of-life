import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { NotificationsService } from '../src/notifications/notifications.service';
import { loginAs, startApi } from './helpers';

describe('Sprints manuais', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', OVERDUE_HOUR: '8' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const setup = async (handle: string, sprint: 'iniciada' | 'planejamento' = 'iniciada') => {
    const me = await loginAs(api, handle, { sprint });
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const task = async (title: string, status?: string) => {
      const t = (await me.c.request('POST', '/tasks', { epicId: epic.id, title })).body;
      if (status) await me.c.request('POST', `/tasks/${t.id}/move`, { status });
      return t.id as string;
    };
    return { me, task };
  };
  const dias = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;

  test('pessoa nova: a Sprint 1 nasce em planejamento (sem data de início)', async () => {
    const { me } = await setup('carla', 'planejamento');
    const r = (await me.c.request('GET', '/sprints')).body;
    assert.equal(r.current.number, 1);
    assert.equal(r.current.startAt, null);
    assert.equal(r.current.plannedEnd, null);
    assert.equal(r.current.length, 14);
    assert.deepEqual(r.history, []);
    assert.equal((await me.c.request('POST', '/sprints/current/close')).status, 400, 'não encerra sprint que nem começou');
  });

  test('iniciar: precisa de 1 tarefa em A Fazer; leva nome, descrição e duração; avisa no sino', async () => {
    const { me, task } = await setup('iris', 'planejamento');
    const vazia = await me.c.request('POST', '/sprints/current/start', {});
    assert.equal(vazia.status, 400);
    assert.match(vazia.body.message, /A Fazer/);

    await task('Primeira', 'todo');
    assert.equal((await me.c.request('PATCH', '/sprints/current', { name: 'Sprint da saúde', description: 'Voltar a correr' })).status, 200);
    const r = await me.c.request('POST', '/sprints/current/start', { length: 7 });
    assert.equal(r.status, 201);
    assert.equal(r.body.sprint.name, 'Sprint da saúde');
    assert.equal(r.body.sprint.description, 'Voltar a correr');
    assert.ok(r.body.sprint.startAt);
    assert.equal(dias(r.body.sprint.startAt, r.body.sprint.plannedEnd), 7);
    assert.equal((await me.c.request('POST', '/sprints/current/start', {})).status, 400, 'não inicia duas vezes');

    const notes = (await me.c.request('GET', '/notifications')).body as { type: string; title: string }[];
    assert.equal(notes[0]!.type, 'sprint_iniciada');
    assert.equal(notes[0]!.title, 'Sprint da saúde começou');

    // Durante a sprint: trocar a duração recalcula o fim; sem prazo = sem fim.
    const semPrazo = (await me.c.request('PATCH', '/sprints/current', { length: 0 })).body;
    assert.equal(semPrazo.plannedEnd, null);
    assert.equal((await me.c.request('PATCH', '/sprints/current', { length: 3 })).status, 400, 'duração inválida');

    // Ao encerrar, a próxima fica em planejamento e herda a duração.
    const close = (await me.c.request('POST', '/sprints/current/close')).body;
    assert.equal(close.next.number, 2);
    assert.equal(close.next.startAt, null);
    assert.equal(close.next.length, 0);
  });

  test('concluir sem sprint iniciada: sem XP, aviso só na 1ª vez; ao iniciar, as prontas soltas saem do quadro', async () => {
    const { me, task } = await setup('joana', 'planejamento');
    const a = await task('A');
    const b = await task('B');
    const c = await task('C', 'todo');

    const r1 = (await me.c.request('POST', `/tasks/${a}/move`, { status: 'done' })).body;
    assert.equal(r1.xp.gained, 0);
    assert.equal(r1.offSprint, true);
    assert.equal(r1.warn, true);
    const r2 = (await me.c.request('POST', `/tasks/${b}/move`, { status: 'done' })).body;
    assert.equal(r2.offSprint, true);
    assert.equal(r2.warn, false, 'o aviso não se repete no mesmo intervalo');
    assert.equal((await me.c.request('GET', '/me')).body.xp.total, 0);

    await me.c.request('POST', '/sprints/current/start', {});
    const tasks = Object.fromEntries((await api.prisma.task.findMany({ where: { id: { in: [a, b, c] } } })).map(t => [t.id, t]));
    assert.ok(tasks[a]!.archivedAt, 'pronta sem sprint sai do quadro');
    assert.equal(tasks[a]!.status, 'done', 'e continua concluída');
    assert.equal(tasks[a]!.sprintId, null);
    assert.equal(tasks[c]!.archivedAt, null);

    // Com a sprint iniciada, concluir rende XP.
    const r3 = (await me.c.request('POST', `/tasks/${c}/move`, { status: 'done' })).body;
    assert.equal(r3.xp.gained, 10);
    assert.equal(r3.offSprint, false);

    // Novo intervalo entre sprints: o aviso volta a aparecer uma vez.
    await me.c.request('POST', '/sprints/current/close');
    const d = await task('D');
    assert.equal((await me.c.request('POST', `/tasks/${d}/move`, { status: 'done' })).body.warn, true);
  });

  test('prazo vencido: avisa uma vez, a partir das 8h, e não encerra a sprint', async () => {
    const { me } = await setup('kaio');
    const s = await api.prisma.sprint.findFirstOrThrow({ where: { userId: me.user.id } });
    const day = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + offset * 86400000));
    await api.prisma.sprint.update({ where: { id: s.id }, data: { plannedEnd: new Date(`${day(-1)}T10:00:00-03:00`) } });

    const svc = api.app.get(NotificationsService);
    const at = (h: number) => new Date(`${day(0)}T${String(h).padStart(2, '0')}:30:00-03:00`);
    assert.equal(await svc.checkSprintDeadlines(at(6)), 0, 'antes das 8h não avisa');
    assert.ok((await svc.checkSprintDeadlines(at(9))) >= 1);
    assert.equal(await svc.checkSprintDeadlines(at(10)), 0, 'não repete');
    const notes = (await me.c.request('GET', '/notifications')).body as { type: string }[];
    assert.equal(notes.filter(n => n.type === 'sprint_prazo').length, 1);
    assert.equal((await api.prisma.sprint.findUniqueOrThrow({ where: { id: s.id } })).closedAt, null);
  });

  test('encerrar: prontas arquivadas, abertas voltam ao backlog com histórico, próxima em planejamento', async () => {
    const { me, task } = await setup('davi');
    const done = await task('Pronta', 'done');
    const doing = await task('Fazendo', 'doing');
    const todo = await task('A fazer', 'todo');
    const backlog = await task('No backlog');

    const r = await me.c.request('POST', '/sprints/current/close');
    assert.equal(r.status, 201);
    assert.equal(r.body.done, 1);
    assert.equal(r.body.open, 2);
    assert.equal(r.body.full, false);
    assert.equal(r.body.closed.number, 1);
    assert.equal(r.body.closed.doneCount, 1);
    assert.equal(r.body.closed.totalCount, 3);
    assert.equal(r.body.next.number, 2);
    assert.equal(r.body.next.startAt, null);

    const tasks = Object.fromEntries((await api.prisma.task.findMany({ where: { id: { in: [done, doing, todo, backlog] } } })).map(t => [t.id, t]));
    assert.ok(tasks[done]!.archivedAt, 'pronta sai do quadro');
    assert.equal(tasks[done]!.status, 'done');
    assert.equal(tasks[doing]!.status, 'backlog');
    assert.equal(tasks[todo]!.status, 'backlog');
    assert.equal(tasks[doing]!.sprintId, null);
    assert.equal(tasks[backlog]!.status, 'backlog');

    const log = await api.prisma.taskLog.findFirst({ where: { taskId: doing }, orderBy: { createdAt: 'desc' } });
    assert.equal(log!.text, 'Voltou ao backlog no fim da Sprint 1');

    const overview = (await me.c.request('GET', '/sprints')).body;
    assert.equal(overview.current.number, 2);
    assert.equal(overview.history[0].number, 1);
  });

  test('sprint com todas as tarefas prontas é marcada como completa', async () => {
    const { me, task } = await setup('eva');
    await task('A', 'done');
    await task('B', 'done');
    const r = await me.c.request('POST', '/sprints/current/close');
    assert.equal(r.body.full, true);
  });

  test('sprint vazia não conta como completa', async () => {
    const { me } = await setup('fabio');
    const r = await me.c.request('POST', '/sprints/current/close');
    assert.equal(r.body.full, false);
    assert.equal(r.body.closed.totalCount, 0);
  });

  test('a sprint de uma pessoa não mexe nas tarefas de outra', async () => {
    const a = await setup('gabi');
    const b = await setup('hugo');
    const theirs = await b.task('Da outra pessoa', 'doing');
    await a.me.c.request('POST', '/sprints/current/close');
    const t = await api.prisma.task.findUnique({ where: { id: theirs } });
    assert.equal(t!.status, 'doing');
  });
});
