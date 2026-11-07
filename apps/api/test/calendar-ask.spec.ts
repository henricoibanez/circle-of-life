import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { CALENDAR_ASK_AGAIN_DAYS, calendarAskDue } from '@circle/shared';
import { loginAs, startApi } from './helpers';

describe('Sugestão de conectar a Google Agenda ("Agora não" por 7 dias)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    // Com credenciais (falsas) do Google: a agenda fica "disponível".
    api = await startApi({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: 'teste', GOOGLE_CLIENT_SECRET: 'teste' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('a regra dos 7 dias', () => {
    const now = new Date('2026-11-07T12:00:00Z');
    assert.equal(CALENDAR_ASK_AGAIN_DAYS, 7);
    assert.equal(calendarAskDue(null, now), true, 'nunca disse "Agora não"');
    assert.equal(calendarAskDue(new Date('2026-11-01T12:00:00Z'), now), false, '6 dias depois ainda não');
    assert.equal(calendarAskDue(new Date('2026-10-31T12:00:00Z'), now), true, '7 dias depois volta');
  });

  test('sem agenda conectada sugere; "Agora não" pausa; depois de 7 dias volta; conectada não sugere', async () => {
    const me = await loginAs(api, 'calask');
    const ask = async () => (await me.c.request('GET', '/me')).body.googleCalendar.askConnect;
    assert.equal(await ask(), true);

    assert.equal((await me.c.request('POST', '/calendar/ask/dismiss')).status, 204);
    assert.equal(await ask(), false, 'logo depois do "Agora não", não sugere');

    await api.prisma.user.update({ where: { id: me.user.id }, data: { calendarAskedAt: new Date(Date.now() - 8 * 86_400_000) } });
    assert.equal(await ask(), true, 'passados os 7 dias, sugere de novo');

    await api.prisma.user.update({ where: { id: me.user.id }, data: { googleCalendarToken: 'token-de-teste' } });
    const m = (await me.c.request('GET', '/me')).body.googleCalendar;
    assert.deepEqual(m, { available: true, connected: true, askConnect: false }, 'conectada: o app pergunta em toda tarefa, sem sugerir conectar');
  });
});
