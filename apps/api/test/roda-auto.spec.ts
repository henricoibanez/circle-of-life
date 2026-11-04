import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { RodaService } from '../src/exercises/roda.module';
import { loginAs, startApi } from './helpers';

describe('Roda da Vida: avaliação guardada sozinha no fim do dia', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('notas mexidas e não registradas viram registro depois que o dia acaba, sem XP e uma vez só', async () => {
    const me = await loginAs(api, 'rodaauto');
    await me.c.request('PUT', '/roda/scores', { scores: { lazer: 6, saude: 4 } });
    const svc = api.app.get(RodaService);
    const snaps = () => api.prisma.rodaSnapshot.count({ where: { userId: me.user.id } });

    // No mesmo dia ainda não guarda (a pessoa pode registrar ela mesma).
    await svc.autoSnapshots();
    assert.equal(await snaps(), 0);

    // No dia seguinte, guarda com a data da última nota.
    const amanha = new Date(Date.now() + 26 * 3600_000);
    await svc.autoSnapshots(amanha);
    assert.equal(await snaps(), 1);
    const s = await api.prisma.rodaSnapshot.findFirstOrThrow({ where: { userId: me.user.id } });
    assert.equal((s.scores as Record<string, number>).lazer, 6);
    assert.equal((await me.c.request('GET', '/me')).body.xp.total, 0, 'guardar sozinho não rende XP');

    // Não repete.
    await svc.autoSnapshots(amanha);
    assert.equal(await snaps(), 1);
  });

  test('quem registrou depois da última nota não ganha registro extra', async () => {
    const me = await loginAs(api, 'rodareg');
    await me.c.request('PUT', '/roda/scores', { scores: { lazer: 8 } });
    await me.c.request('POST', '/roda/snapshots');
    await api.app.get(RodaService).autoSnapshots(new Date(Date.now() + 26 * 3600_000));
    assert.equal(await api.prisma.rodaSnapshot.count({ where: { userId: me.user.id } }), 1);
  });
});
