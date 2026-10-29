import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Google Agenda', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let me: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    // Sem GOOGLE_CLIENT_ID: a agenda fica "indisponível" (como num ambiente sem credenciais).
    api = await startApi({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    me = await loginAs(api, 'cal');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('/me informa o estado da Google Agenda', async () => {
    const m = (await me.c.request('GET', '/me')).body;
    assert.deepEqual(m.googleCalendar, { available: false, connected: false });
  });

  test('conectar sem Google configurado é recusado; desconectar é inofensivo', async () => {
    assert.equal((await me.c.request('GET', '/calendar/google')).status, 400);
    assert.equal((await me.c.request('DELETE', '/calendar')).status, 204);
  });

  test('vincular uma tarefa sem conexão pede para conectar; a tarefa nasce fora da agenda', async () => {
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const task = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Com data', dueDate: '2026-12-01' })).body;
    assert.equal(task.inCalendar, false);

    const r = await me.c.request('POST', `/tasks/${task.id}/calendar`);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Google Agenda/);
  });
});
