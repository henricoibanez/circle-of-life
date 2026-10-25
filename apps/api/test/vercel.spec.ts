import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { client, loginAs, startApi } from './helpers';

// Como na Vercel: sem servidor de e-mail, sem tarefas de hora em hora,
// com as tarefas diárias chamadas de fora pela rota /cron/daily.
describe('Publicação na Vercel', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', SMTP_HOST: '', CRON_SECRET: 'segredo-do-cron-de-teste' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('sem e-mail, o convite é registrado e avisa que não foi enviado', async () => {
    const adm = await loginAs(api, 'admvercel', { role: 'admin' });
    const r = await adm.c.request('POST', '/invites', { email: 'amiga@gmail.com' });
    assert.equal(r.status, 201);
    assert.equal(r.body.emailSent, false);
    const again = await adm.c.request('POST', `/invites/${r.body.id}/resend`);
    assert.equal(again.body.emailSent, false);
    assert.equal((await adm.c.request('GET', '/invites')).body[0].status, 'pendente');
  });

  test('tarefas diárias: só com o segredo certo', async () => {
    const c = client(api.url);
    assert.equal((await c.request('GET', '/cron/daily')).status, 401);
    const wrong = await fetch(`${api.url}/cron/daily`, { headers: { authorization: 'Bearer outro-segredo-qualquer-xx' } });
    assert.equal(wrong.status, 401);
    const ok = await fetch(`${api.url}/cron/daily`, { headers: { authorization: 'Bearer segredo-do-cron-de-teste' } });
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { ok: boolean }).ok, true);
  });
});
