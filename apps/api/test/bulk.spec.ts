import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Backlog: ações em massa', () => {
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
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E' })).body;
    const task = async (title: string) => (await me.c.request('POST', '/tasks', { epicId: ep.id, title })).body.id as string;
    return { me, ids: [await task('A'), await task('B'), await task('C')] };
  };
  const statuses = async (ids: string[]) => (await api.prisma.task.findMany({ where: { id: { in: ids } }, orderBy: { title: 'asc' } })).map(t => t.status);

  test('enviar para a sprint: as do backlog vão para A Fazer; as que já estão no quadro ficam', async () => {
    const { me, ids } = await setup('massa1');
    await me.c.request('POST', `/tasks/${ids[0]}/move`, { status: 'doing' });
    const r = await me.c.request('POST', '/tasks/bulk', { ids, action: 'sprint' });
    assert.equal(r.status, 201);
    assert.equal(r.body.count, 2);
    assert.deepEqual(await statuses(ids), ['doing', 'todo', 'todo']);
  });

  test('concluir: todas viram Pronto e rendem o XP de cada uma', async () => {
    const { me, ids } = await setup('massa2');
    const r = await me.c.request('POST', '/tasks/bulk', { ids, action: 'done' });
    assert.equal(r.body.count, 3);
    assert.equal(r.body.xp.gained, 30);
    assert.deepEqual(await statuses(ids), ['done', 'done', 'done']);
  });

  test('excluir: apaga as selecionadas e tira o XP que rendiam', async () => {
    const { me, ids } = await setup('massa3');
    await me.c.request('POST', `/tasks/${ids[0]}/move`, { status: 'done' });
    const r = await me.c.request('POST', '/tasks/bulk', { ids: ids.slice(0, 2), action: 'delete' });
    assert.equal(r.body.count, 2);
    assert.equal(r.body.xp.gained, -10);
    assert.equal(await api.prisma.task.count({ where: { id: { in: ids } } }), 1);
  });

  test('não mexe em tarefas de outra pessoa; ação inválida é recusada', async () => {
    const a = await setup('massa4');
    const b = await setup('massa5');
    assert.equal((await b.me.c.request('POST', '/tasks/bulk', { ids: a.ids, action: 'delete' })).status, 404);
    assert.equal(await api.prisma.task.count({ where: { id: { in: a.ids } } }), 3);
    assert.equal((await a.me.c.request('POST', '/tasks/bulk', { ids: a.ids, action: 'arquivar' })).status, 400);
    assert.equal((await a.me.c.request('POST', '/tasks/bulk', { ids: [], action: 'done' })).status, 400);
  });
});
