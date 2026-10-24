import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Quadro de visualização e Minhas conquistas', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('criar, editar, realizar (+30 XP) e excluir sonho', async () => {
    const { c } = await loginAs(api, 'son1');
    const d = (await c.request('POST', '/dreams', { text: 'Ver a aurora boreal', area: 'amor' })).body;
    assert.equal(d.doneAt, null);
    const e = (await c.request('PATCH', `/dreams/${d.id}`, { area: 'lazer' })).body;
    assert.equal(e.area, 'lazer');
    const r = await c.request('POST', `/dreams/${d.id}/realize`);
    assert.ok(r.body.dream.doneAt);
    assert.equal(r.body.xp.gained, 30);
    assert.equal((await c.request('POST', `/dreams/${d.id}/realize`)).status, 400);
    assert.equal((await c.request('DELETE', `/dreams/${d.id}`)).status, 204);
    assert.equal((await c.request('GET', '/me')).body.xp.total, 0, 'excluir sonho realizado tira o XP');
  });

  test('no máximo 10 sonhos abertos (realizados não contam)', async () => {
    const { c } = await loginAs(api, 'son2');
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await c.request('POST', '/dreams', { text: `Sonho ${i}`, area: 'lazer' })).body.id);
    const extra = await c.request('POST', '/dreams', { text: 'Onze', area: 'lazer' });
    assert.equal(extra.status, 409);
    await c.request('POST', `/dreams/${ids[0]}/realize`);
    assert.equal((await c.request('POST', '/dreams', { text: 'Agora cabe', area: 'lazer' })).status, 201);
  });

  test('conquistas contam épicos encerrados e iniciativas concluídas por área', async () => {
    const { c } = await loginAs(api, 'son3');
    const ini = (await c.request('POST', '/initiatives', { title: 'Saúde', areas: ['saude', 'emocional'] })).body;
    const ep = (await c.request('POST', '/epics', { initiativeId: ini.id, title: 'Correr', area: 'saude' })).body;
    const t = (await c.request('POST', '/tasks', { epicId: ep.id, title: 'Treinar' })).body;
    await c.request('POST', `/tasks/${t.id}/move`, { status: 'done' });
    await c.request('POST', `/epics/${ep.id}/close`);
    await c.request('POST', `/initiatives/${ini.id}/complete`);
    const all = (await c.request('GET', '/conquistas')).body;
    const saude = all.areas.find((a: { area: string }) => a.area === 'saude');
    const emocional = all.areas.find((a: { area: string }) => a.area === 'emocional');
    assert.deepEqual(saude, { area: 'saude', epics: 1, initiatives: 1 });
    assert.deepEqual(emocional, { area: 'emocional', epics: 0, initiatives: 1 });
    const detail = (await c.request('GET', '/conquistas/saude')).body;
    assert.equal(detail.epics[0].title, 'Correr');
    assert.equal(detail.initiatives[0].title, 'Saúde');
  });
});
