import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Sprints de 14 dias', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const setup = async (handle: string) => {
    const me = await loginAs(api, handle);
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const task = async (title: string, status?: string) => {
      const t = (await me.c.request('POST', '/tasks', { epicId: epic.id, title })).body;
      if (status) await me.c.request('POST', `/tasks/${t.id}/move`, { status });
      return t.id as string;
    };
    return { me, task };
  };

  test('sem sprint ainda: a visão geral cria a Sprint 1', async () => {
    const { me } = await setup('carla');
    const r = await me.c.request('GET', '/sprints');
    assert.equal(r.body.current.number, 1);
    assert.deepEqual(r.body.history, []);
  });

  test('duração da sprint: padrão 14 dias; a nova duração vale na próxima sprint; indeterminada fica sem prazo', async () => {
    const { me } = await setup('duracao');
    const dias = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;

    // Padrão: 14 dias.
    const s1 = (await me.c.request('GET', '/sprints')).body.current;
    assert.equal(dias(s1.startAt, s1.plannedEnd), 14);

    // Troca para semanal (7). A sprint atual não muda.
    assert.equal((await me.c.request('PATCH', '/me/preferences', { sprintLength: 7 })).body.preferences.sprintLength, 7);
    const atual = (await me.c.request('GET', '/sprints')).body.current;
    assert.equal(dias(atual.startAt, atual.plannedEnd), 14, 'a sprint atual continua 14');

    // Ao encerrar, a próxima usa 7 dias.
    const prox = (await me.c.request('POST', '/sprints/current/close')).body.next;
    assert.equal(dias(prox.startAt, prox.plannedEnd), 7);

    // Indeterminada (0): a próxima sprint nasce sem prazo.
    await me.c.request('PATCH', '/me/preferences', { sprintLength: 0 });
    const semPrazo = (await me.c.request('POST', '/sprints/current/close')).body.next;
    assert.equal(semPrazo.plannedEnd, null);

    // Valor inválido é recusado.
    assert.equal((await me.c.request('PATCH', '/me/preferences', { sprintLength: 3 })).status, 400);
  });

  test('encerrar: prontas arquivadas, abertas voltam ao backlog com histórico, próxima sprint aberta', async () => {
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

    const tasks = Object.fromEntries((await api.prisma.task.findMany({ where: { id: { in: [done, doing, todo, backlog] } } })).map(t => [t.id, t]));
    assert.ok(tasks[done]!.archivedAt, 'pronta sai do quadro');
    assert.equal(tasks[done]!.status, 'done');
    assert.equal(tasks[doing]!.status, 'backlog');
    assert.equal(tasks[todo]!.status, 'backlog');
    assert.equal(tasks[doing]!.sprintId, null);
    assert.equal(tasks[backlog]!.status, 'backlog');

    const log = await api.prisma.taskLog.findFirst({ where: { taskId: doing }, orderBy: { createdAt: 'desc' } });
    assert.equal(log!.text, 'Voltou ao backlog no fim da sprint 1');

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
