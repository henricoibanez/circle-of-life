import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('XP (regras provisórias)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const setup = async (handle: string, tasks = 1) => {
    const me = await loginAs(api, handle);
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const ids: string[] = [];
    for (let i = 0; i < tasks; i++) ids.push((await me.c.request('POST', '/tasks', { epicId: epic.id, title: `T${i}` })).body.id);
    const xp = async () => (await me.c.request('GET', '/me')).body.xp as { total: number; disponivel: number };
    const move = (id: string, status: string) => me.c.request('POST', `/tasks/${id}/move`, { status });
    return { me, ini, epic, ids, xp, move };
  };

  test('concluir tarefa dá +10; reabrir tira; concluir de novo não acumula', async () => {
    const { ids, xp, move } = await setup('xp1');
    const r = await move(ids[0]!, 'done');
    assert.deepEqual(r.body.xp, { gained: 10, total: 10, disponivel: 10 });
    assert.equal((await move(ids[0]!, 'doing')).body.xp.gained, -10);
    assert.equal((await xp()).total, 0);
    await move(ids[0]!, 'done');
    await move(ids[0]!, 'todo');
    await move(ids[0]!, 'done');
    assert.equal((await xp()).total, 10, 'a mesma tarefa só vale 10 enquanto estiver pronta');
  });

  test('encerrar épico dá +50; reabrir uma tarefa dele tira o XP do épico e da tarefa', async () => {
    const { me, epic, ids, xp, move } = await setup('xp2', 2);
    for (const id of ids) await move(id, 'done');
    const closed = await me.c.request('POST', `/epics/${epic.id}/close`);
    assert.equal(closed.body.xp.gained, 50);
    assert.equal((await xp()).total, 70);
    const r = await move(ids[0]!, 'doing');
    assert.equal(r.body.xp.gained, -60);
    assert.equal((await xp()).total, 10);
  });

  test('iniciativa com 5 tarefas concluídas não dá XP; com 6 dá +100', async () => {
    const five = await setup('xp3', 5);
    for (const id of five.ids) await five.move(id, 'done');
    await five.me.c.request('POST', `/epics/${five.epic.id}/close`);
    const r5 = await five.me.c.request('POST', `/initiatives/${five.ini.id}/complete`);
    assert.equal(r5.body.doneTasks, 5);
    assert.equal(r5.body.xp.gained, 0);

    const six = await setup('xp4', 6);
    for (const id of six.ids) await six.move(id, 'done');
    await six.me.c.request('POST', `/epics/${six.epic.id}/close`);
    const r6 = await six.me.c.request('POST', `/initiatives/${six.ini.id}/complete`);
    assert.equal(r6.body.xp.gained, 100);
    assert.equal((await six.xp()).total, 6 * 10 + 50 + 100);

    const reopened = await six.me.c.request('POST', `/initiatives/${six.ini.id}/reopen`);
    assert.equal(reopened.body.xp.gained, -100);
  });

  test('sprint completa dá +100; incompleta não dá', async () => {
    const full = await setup('xp5', 2);
    for (const id of full.ids) await full.move(id, 'done');
    const r = await full.me.c.request('POST', '/sprints/current/close');
    assert.equal(r.body.full, true);
    assert.equal(r.body.xp.gained, 100);

    const partial = await setup('xp6', 2);
    await partial.move(partial.ids[0]!, 'done');
    await partial.move(partial.ids[1]!, 'doing');
    const r2 = await partial.me.c.request('POST', '/sprints/current/close');
    assert.equal(r2.body.xp.gained, 0);
  });

  test('excluir tarefa pronta tira o XP dela (não dá para "fabricar" XP)', async () => {
    const { me, ids, xp, move } = await setup('xp7');
    await move(ids[0]!, 'done');
    assert.equal((await xp()).total, 10);
    await me.c.request('DELETE', `/tasks/${ids[0]}`);
    assert.equal((await xp()).total, 0);
  });

  test('extrato e atividade recente registram as ações', async () => {
    const { me, ids, move } = await setup('xp8');
    await move(ids[0]!, 'done');
    const extrato = (await me.c.request('GET', '/me/xp')).body;
    assert.equal(extrato[0].reason, 'task');
    assert.equal(extrato[0].amount, 10);
    const activity = (await me.c.request('GET', '/me/activity')).body;
    assert.equal(activity[0].text, 'Você concluiu “T0”');
    assert.equal(activity[0].link, '/board');
  });

  test('XP disponível = total menos o gasto', async () => {
    const { me, ids, move, xp } = await setup('xp9', 3);
    for (const id of ids) await move(id, 'done');
    await api.prisma.user.update({ where: { id: me.user.id }, data: { xpSpent: 25 } });
    assert.deepEqual(await xp(), { total: 30, disponivel: 5 });
  });
});
