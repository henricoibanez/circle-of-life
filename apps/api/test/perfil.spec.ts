import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Perfil e configurações', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('editar nome, ID e bio; ID repetido ou inválido é recusado', async () => {
    const { c } = await loginAs(api, 'perf1');
    await loginAs(api, 'perf2');
    const r = await c.request('PATCH', '/me', { name: 'Nome Novo', handle: 'nome.novo', bio: 'Oi' });
    assert.equal(r.status, 200);
    assert.equal(r.body.handle, 'nome.novo');
    assert.equal((await c.request('PATCH', '/me', { handle: 'perf2' })).status, 409);
    assert.equal((await c.request('PATCH', '/me', { handle: 'Com Espaço' })).status, 400);
  });

  test('foto do perfil enviada ao storage e trocada (a antiga é apagada)', async () => {
    const { c } = await loginAs(api, 'perf3');
    const send = async () => {
      const u = (await c.request('POST', '/uploads', { purpose: 'avatar', mime: 'image/png', size: PNG.length })).body;
      await fetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: new Uint8Array(PNG) });
      await c.request('POST', `/uploads/${u.fileId}/confirm`);
      return u.fileId as string;
    };
    const first = await send();
    const r1 = await c.request('PATCH', '/me', { photoFileId: first });
    assert.ok(r1.body.photoUrl);
    const second = await send();
    await c.request('PATCH', '/me', { photoFileId: second });
    assert.equal(await api.prisma.file.count({ where: { id: first } }), 0);
    assert.equal((await fetch(r1.body.photoUrl)).status, 404);
  });

  test('preferências de tema e visibilidade padrão dos posts', async () => {
    const { c } = await loginAs(api, 'perf4');
    const r = await c.request('PATCH', '/me/preferences', { palette: 'serenity', randomTheme: true, themeMode: 'dark', defaultPostVisibility: 'amigos' });
    assert.deepEqual(r.body.preferences, { palette: 'serenity', randomTheme: true, themeMode: 'dark', defaultPostVisibility: 'amigos' });
    assert.equal((await c.request('PATCH', '/me/preferences', { palette: 'rosa' })).status, 400);
  });

  test('uso das ferramentas começa em zero e reage aos exercícios', async () => {
    const { c } = await loginAs(api, 'perf5');
    assert.deepEqual((await c.request('GET', '/me/usage')).body, { maslow: 0, roda: 0, necrologio: 0, quadro: 0, backlog: 0 });
    await c.request('PUT', '/roda/scores', { scores: { lazer: 10, amor: 10 } });
    await c.request('PUT', '/maslow/checks/fis-0', { checked: true });
    const u = (await c.request('GET', '/me/usage')).body;
    assert.equal(u.roda, 0.2);
    assert.equal(u.maslow, 1 / 32);
  });

  test('excluir a conta apaga tudo e encerra a sessão', async () => {
    const { c, user } = await loginAs(api, 'perf6');
    await c.request('POST', '/initiatives', { title: 'Algo' });
    // Sem digitar DELETAR, não exclui.
    assert.equal((await c.request('DELETE', '/me')).status, 400);
    assert.equal((await c.request('DELETE', '/me', { confirm: 'apagar' })).status, 400);
    assert.equal(await api.prisma.user.count({ where: { id: user.id } }), 1);
    const r = await c.request('DELETE', '/me', { confirm: 'DELETAR' });
    assert.equal(r.status, 204);
    assert.equal(await api.prisma.user.count({ where: { id: user.id } }), 0);
    assert.equal(await api.prisma.initiative.count({ where: { userId: user.id } }), 0);
    assert.equal((await c.request('GET', '/me')).status, 401);
  });

  test('excluir a conta apaga o convite dela, e o admin pode convidar de novo', async () => {
    const admin = await loginAs(api, 'perfadm', { role: 'admin' });
    const pessoa = await loginAs(api, 'perf7');
    const email = pessoa.user.email;
    await api.prisma.invite.create({
      data: { email, tokenHash: `teste-${Date.now()}`, invitedById: admin.user.id, expiresAt: new Date(Date.now() + 86_400_000), acceptedAt: new Date(), acceptedUserId: pessoa.user.id },
    });
    await api.prisma.emailCode.create({ data: { email, purpose: 'senha', codeHash: 'x', expiresAt: new Date(Date.now() + 600_000) } });
    assert.equal((await pessoa.c.request('DELETE', '/me', { confirm: 'DELETAR' })).status, 204);
    assert.equal(await api.prisma.invite.count({ where: { email } }), 0, 'convite apagado');
    assert.equal(await api.prisma.emailCode.count({ where: { email } }), 0, 'códigos apagados');
    const list = (await admin.c.request('GET', '/invites')).body as { email: string }[];
    assert.ok(!list.some(i => i.email === email), 'não aparece mais como aceito');
    const again = await admin.c.request('POST', '/invites', { email });
    assert.equal(again.status, 201, 'pode convidar de novo, como se fosse do zero');
  });
});
