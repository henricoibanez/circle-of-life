import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { AuthService } from '../src/auth/auth.service';
import { hashInviteToken } from '../src/invites/invite-token';
import { client, mailpitBody, mailpitMessages, startApi } from './helpers';

describe('Login e convites (ambiente de desenvolvimento)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let adminId: string;
  let memberId: string;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ADMIN_EMAILS: 'Dona@Gmail.com, membro@teste.local' });
    const admin = await api.prisma.user.create({
      data: { email: 'admin@teste.local', name: 'Admin Teste', handle: 'adminteste', role: 'admin', isTestUser: true },
    });
    const member = await api.prisma.user.create({
      data: { email: 'membro@teste.local', name: 'Membro Teste', handle: 'membroteste', isTestUser: true },
    });
    adminId = admin.id;
    memberId = member.id;
  });

  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('health check é público', async () => {
    const res = await client(api.url).request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('rotas exigem login', async () => {
    const res = await client(api.url).request('GET', '/me');
    assert.equal(res.status, 401);
    assert.match(res.body.message, /entrar/);
  });

  test('providers informa o que está disponível', async () => {
    const res = await client(api.url).request('GET', '/auth/providers');
    assert.deepEqual(res.body, { google: false, dev: true, convite: true, senha: true });
  });

  test('sem credenciais do Google, o botão volta ao login com aviso', async () => {
    const res = await client(api.url).request('GET', '/auth/google');
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location')!, /\/login\?erro=google-indisponivel$/);
  });

  test('login de teste: lista usuários, entra, vê /me e sai', async () => {
    const c = client(api.url);
    const users = await c.request('GET', '/auth/dev/users');
    assert.equal(users.status, 200);
    assert.ok(users.body.some((u: { id: string }) => u.id === adminId));

    const login = await c.request('POST', '/auth/dev/login', { userId: adminId });
    assert.equal(login.status, 204);
    const setCookie = login.headers.getSetCookie().join(';');
    assert.match(setCookie, /col_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const me = await c.request('GET', '/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.email, 'admin@teste.local');
    assert.equal(me.body.role, 'admin');
    assert.deepEqual(me.body.xp, { total: 0, gems: 0 });

    const out = await c.request('POST', '/auth/logout');
    assert.equal(out.status, 204);
    assert.equal((await c.request('GET', '/me')).status, 401);
  });

  test('login de teste recusa quem não é usuário de teste', async () => {
    const real = await api.prisma.user.create({ data: { email: 'real@x.com', name: 'Real', handle: 'real' } });
    const res = await client(api.url).request('POST', '/auth/dev/login', { userId: real.id });
    assert.equal(res.status, 404);
  });

  test('cookie adulterado não vale', async () => {
    const res = await fetch(`${api.url}/me`, { headers: { cookie: 'col_session=abc.def.ghi' } });
    assert.equal(res.status, 401);
  });

  test('membro comum não gerencia convites', async () => {
    const c = client(api.url);
    await c.request('POST', '/auth/dev/login', { userId: memberId });
    assert.equal((await c.request('GET', '/invites')).status, 403);
    assert.equal((await c.request('POST', '/invites', { email: 'x@y.com' })).status, 403);
  });

  test('admin convida: e-mail chega com o link, a tela do convite funciona, reenviar troca o código', async () => {
    const c = client(api.url);
    await c.request('POST', '/auth/dev/login', { userId: adminId });
    const email = `convite-${Date.now()}@teste.local`;

    const bad = await c.request('POST', '/invites', { email: 'nao-e-email' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /e-mail válido/);

    const created = await c.request('POST', '/invites', { email: email.toUpperCase() });
    assert.equal(created.status, 201);
    assert.equal(created.body.email, email, 'e-mail guardado em minúsculas');

    const dup = await c.request('POST', '/invites', { email });
    assert.equal(dup.status, 409);

    const msgs = await mailpitMessages(email);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]!.Subject, 'Seu convite para o Circle of Life');
    const token = (await mailpitBody(msgs[0]!.ID)).match(/\/convite\/([\w-]+)/)![1]!;

    const check = await client(api.url).request('GET', `/invites/check/${token}`);
    assert.deepEqual(check.body, { email, status: 'pendente' });

    const list = await c.request('GET', '/invites');
    const item = list.body.find((i: { email: string }) => i.email === email);
    assert.equal(item.status, 'pendente');
    assert.equal(item.convidadoPor, 'Admin Teste');

    const resent = await c.request('POST', `/invites/${item.id}/resend`);
    assert.equal(resent.status, 200);
    assert.equal(resent.body.emailSent, true);
    assert.equal((await client(api.url).request('GET', `/invites/check/${token}`)).status, 404, 'código antigo deixa de valer');

    assert.equal((await c.request('DELETE', `/invites/${item.id}`)).status, 204);
    assert.equal((await c.request('GET', '/invites')).body.some((i: { email: string }) => i.email === email), false);
  });

  test('convite para quem já tem conta é recusado', async () => {
    const c = client(api.url);
    await c.request('POST', '/auth/dev/login', { userId: adminId });
    const res = await c.request('POST', '/invites', { email: 'membro@teste.local' });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /já tem conta/);
  });

  describe('regras do login com Google', () => {
    const google = (email: string, extra: Partial<{ googleId: string; emailVerified: boolean; name: string }> = {}) => ({
      googleId: `g-${email}`,
      email,
      emailVerified: true,
      name: 'Maria José da Silva',
      ...extra,
    });

    test('sem convite: acesso recusado', async () => {
      const result = await api.app.get(AuthService).loginWithGoogle(google('sem-convite@gmail.com'));
      assert.deepEqual(result, { error: 'sem-convite' });
    });

    test('e-mail não verificado no Google: recusado', async () => {
      const result = await api.app.get(AuthService).loginWithGoogle(google('x@gmail.com', { emailVerified: false }));
      assert.deepEqual(result, { error: 'email-nao-verificado' });
    });

    test('com convite válido: cria a conta, gera o @ e marca o convite como aceito', async () => {
      await api.prisma.invite.create({
        data: { email: 'maria@gmail.com', tokenHash: hashInviteToken('t-maria'), invitedById: adminId, expiresAt: new Date(Date.now() + 86400000) },
      });
      const result = await api.app.get(AuthService).loginWithGoogle(google('maria@gmail.com'), 't-maria');
      assert.ok('user' in result);
      assert.equal(result.user.handle, 'mariajosedasilva');
      assert.equal(result.user.role, 'member');
      assert.equal(result.user.journey, true, 'conta nova começa pela Jornada');
      const invite = await api.prisma.invite.findUnique({ where: { tokenHash: hashInviteToken('t-maria') } });
      assert.equal(invite!.acceptedUserId, result.user.id);

      // Entrando de novo, é a mesma conta.
      const again = await api.app.get(AuthService).loginWithGoogle(google('maria@gmail.com'));
      assert.ok('user' in again && again.user.id === result.user.id);
    });

    test('mesmo nome gera @ diferente', async () => {
      await api.prisma.invite.create({
        data: { email: 'outra.maria@gmail.com', tokenHash: hashInviteToken('t-maria2'), invitedById: adminId, expiresAt: new Date(Date.now() + 86400000) },
      });
      const result = await api.app.get(AuthService).loginWithGoogle(google('outra.maria@gmail.com'));
      assert.ok('user' in result);
      assert.equal(result.user.handle, 'mariajosedasilva2');
    });

    test('convite expirado não vale', async () => {
      await api.prisma.invite.create({
        data: { email: 'atrasado@gmail.com', tokenHash: hashInviteToken('t-velho'), invitedById: adminId, expiresAt: new Date(Date.now() - 1000) },
      });
      const result = await api.app.get(AuthService).loginWithGoogle(google('atrasado@gmail.com'));
      assert.deepEqual(result, { error: 'sem-convite' });
    });

    test('link de convite aberto com outra conta Google: aviso específico', async () => {
      await api.prisma.invite.create({
        data: { email: 'certo@gmail.com', tokenHash: hashInviteToken('t-certo'), invitedById: adminId, expiresAt: new Date(Date.now() + 86400000) },
      });
      const result = await api.app.get(AuthService).loginWithGoogle(google('errado@gmail.com'), 't-certo');
      assert.deepEqual(result, { error: 'convite-outro-email' });
    });

    test('conta que já existe pelo e-mail é ligada ao Google', async () => {
      const result = await api.app.get(AuthService).loginWithGoogle(google('membro@teste.local', { googleId: 'g-membro' }));
      assert.ok('user' in result && result.user.id === memberId);
      const user = await api.prisma.user.findUnique({ where: { id: memberId } });
      assert.equal(user!.googleId, 'g-membro');
      assert.equal(user!.journey, false, 'quem já tinha conta não entra na Jornada');
    });
    test('ADMIN_EMAILS: entra sem convite e vira administrador', async () => {
      const result = await api.app.get(AuthService).loginWithGoogle(google('dona@gmail.com'));
      assert.ok('user' in result);
      assert.equal(result.user.role, 'admin');
      assert.equal(result.user.journey, true, 'admin novo também passa pela Jornada');
    });

    test('ADMIN_EMAILS: conta que já existia passa a ser administradora', async () => {
      const result = await api.app.get(AuthService).loginWithGoogle(google('membro@teste.local'));
      assert.ok('user' in result);
      assert.equal(result.user.role, 'admin');
    });
  });
});
