import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

/** Ofensiva: acessos por dia (no fuso da pessoa) e gemas pelos dias seguidos na semana. */
describe('Ofensiva e gemas por acesso', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let streak: typeof import('../src/xp/streak.service');

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    streak = require('../src/xp/streak.service') as typeof import('../src/xp/streak.service');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('a semana começa na segunda', () => {
    assert.equal(streak.mondayOf('2026-11-06'), '2026-11-02', 'sexta → segunda');
    assert.equal(streak.mondayOf('2026-11-08'), '2026-11-02', 'domingo é o fim da semana');
    assert.equal(streak.mondayOf('2026-11-09'), '2026-11-09');
    assert.equal(streak.addDays('2026-11-30', 1), '2026-12-01');
  });

  test('1º acesso do dia rende gemas; o 2º no mesmo dia não', async () => {
    const me = await loginAs(api, 'ofen1');
    const r = await me.c.request('POST', '/me/checkin');
    assert.equal(r.status, 201);
    assert.equal(r.body.gemsGained, 10);
    assert.equal(r.body.semana, 1);
    assert.equal((await me.c.request('POST', '/me/checkin')).body.gemsGained, 0);
    assert.equal((await me.c.request('GET', '/me')).body.xp.gems, 10);
    const s = (await me.c.request('GET', '/me/streak')).body;
    assert.equal(s.ofensiva, 1);
    assert.equal(s.acessosMes, 1);
    assert.equal(s.diasSemana.filter(Boolean).length, 1);
  });

  test('dias seguidos na semana: 10, 15, 20…; pular um dia volta para 10; segunda recomeça', async () => {
    const me = await loginAs(api, 'ofen2');
    const service = api.app.get(streak.StreakService);
    const user = await api.prisma.user.findUniqueOrThrow({ where: { id: me.user.id } });
    // Ao meio-dia em São Paulo (15h UTC), para o dia não virar por causa do fuso.
    const at = (day: string) => new Date(`${day}T15:00:00Z`);
    const gems = async (day: string) => (await service.checkin(user, at(day))).gemsGained;
    assert.equal(await gems('2026-11-02'), 10, 'segunda');
    assert.equal(await gems('2026-11-03'), 15);
    assert.equal(await gems('2026-11-04'), 20);
    assert.equal(await gems('2026-11-06'), 10, 'pulou a quinta: volta para 10');
    assert.equal(await gems('2026-11-07'), 15);
    assert.equal(await gems('2026-11-08'), 20, 'domingo');
    assert.equal(await gems('2026-11-09'), 10, 'segunda: semana nova');
    const s = await service.status(user, at('2026-11-09'));
    assert.equal(s.ofensiva, 4, 'a ofensiva não zera na segunda (6, 7, 8 e 9)');
    assert.equal(s.semana, 1);
    assert.equal(s.proximoPremio, 15);
    assert.equal((await api.prisma.user.findUniqueOrThrow({ where: { id: me.user.id } })).gems, 100);
  });

  test('a semana inteira rende até 40 por dia', async () => {
    const me = await loginAs(api, 'ofen3');
    const service = api.app.get(streak.StreakService);
    const user = await api.prisma.user.findUniqueOrThrow({ where: { id: me.user.id } });
    const got: number[] = [];
    for (const d of ['02', '03', '04', '05', '06', '07', '08']) got.push((await service.checkin(user, new Date(`2026-11-${d}T15:00:00Z`))).gemsGained);
    assert.deepEqual(got, [10, 15, 20, 25, 30, 35, 40]);
  });

  test('durante a Jornada o acesso conta, mas não rende gemas', async () => {
    const me = await loginAs(api, 'ofen4');
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journey: true } });
    const r = (await me.c.request('POST', '/me/checkin')).body;
    assert.equal(r.gemsGained, 0);
    assert.equal(r.ofensiva, 1);
  });
});
