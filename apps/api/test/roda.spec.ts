import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Roda da Vida', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('começa em branco, com as 10 áreas em 0', async () => {
    const { c } = await loginAs(api, 'roda1');
    const r = (await c.request('GET', '/roda')).body;
    assert.equal(r.rated, false);
    assert.equal(Object.keys(r.scores).length, 10);
    assert.ok(Object.values(r.scores).every(v => v === 0));
  });

  test('salva notas parciais e recusa nota fora de 0 a 10 ou área inexistente', async () => {
    const { c } = await loginAs(api, 'roda2');
    const r = await c.request('PUT', '/roda/scores', { scores: { saude: 7, amor: 9 } });
    assert.equal(r.status, 200);
    assert.equal(r.body.rated, true);
    assert.equal(r.body.scores.saude, 7);
    assert.equal(r.body.scores.lazer, 0);
    assert.equal((await c.request('PUT', '/roda/scores', { scores: { saude: 11 } })).status, 400);
    assert.equal((await c.request('PUT', '/roda/scores', { scores: { saude: 5.5 } })).status, 400);
    assert.equal((await c.request('PUT', '/roda/scores', { scores: { outros: 5 } })).status, 400);
  });

  test('registrar avaliação guarda o histórico e dá +20 XP só uma vez por dia', async () => {
    const { c } = await loginAs(api, 'roda3');
    assert.equal((await c.request('POST', '/roda/snapshots')).status, 400, 'sem notas não registra');
    await c.request('PUT', '/roda/scores', { scores: { lazer: 6 } });
    const first = await c.request('POST', '/roda/snapshots');
    assert.equal(first.body.xp.gained, 20);
    await c.request('PUT', '/roda/scores', { scores: { lazer: 8 } });
    const second = await c.request('POST', '/roda/snapshots');
    assert.equal(second.body.xp.gained, 0);
    const r = (await c.request('GET', '/roda')).body;
    assert.equal(r.history.length, 2);
    assert.equal(r.history[0].scores.lazer, 8, 'mais recente primeiro');
  });
});
