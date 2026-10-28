import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { hashPassword } from '../src/auth/password';
import { client, mailpitMessages, startApi } from './helpers';

/** Código mandado por e-mail (o assunto começa com ele). Espera o Mailpit receber. */
async function codeFor(email: string, n = 1) {
  for (let i = 0; i < 40; i++) {
    const msgs = await mailpitMessages(email);
    if (msgs.length >= n) return msgs[0]!.Subject.slice(0, 6);
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`nenhum e-mail para ${email}`);
}

describe('Login com e-mail e senha', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let adminId: string;
  const run = Date.now();
  const mail = (who: string) => `${who}-${run}@teste.local`;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ADMIN_EMAILS: mail('dona') });
    adminId = (await api.prisma.user.create({ data: { email: mail('admin'), name: 'Admin', handle: `admin${run}`, role: 'admin' } })).id;
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const signup = (c: ReturnType<typeof client>, email: string, extra: object = {}) =>
    c.request('POST', '/auth/signup', { name: 'Maria Souza', email, password: 'segredo123', acceptTerms: true, ...extra });

  test('a tela de login sabe que dá para usar senha', async () => {
    const r = await client(api.url).request('GET', '/auth/providers');
    assert.equal(r.body.senha, true);
  });

  test('sem convite não cria conta; validações dos campos', async () => {
    const c = client(api.url);
    const r = await signup(c, mail('estranho'));
    assert.equal(r.status, 403);
    assert.match(r.body.message, /só por convite/);
    assert.equal((await signup(c, mail('x'), { password: 'curta' })).status, 400);
    assert.equal((await signup(c, mail('x'), { acceptTerms: false })).status, 400);
    assert.equal((await signup(c, 'nao-e-email')).status, 400);
  });

  test('com convite: código no e-mail, conta criada só depois de confirmar, convite aceito', async () => {
    const email = mail('maria');
    await api.prisma.invite.create({ data: { email, tokenHash: `t${run}`, invitedById: adminId, expiresAt: new Date(Date.now() + 86_400_000) } });
    const c = client(api.url);
    assert.equal((await signup(c, email.toUpperCase())).status, 204);
    assert.equal(await api.prisma.user.findUnique({ where: { email } }), null, 'ainda não existe');
    assert.equal((await signup(c, email)).status, 429, 'outro código só depois de 1 minuto');

    const code = await codeFor(email);
    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await c.request('POST', '/auth/signup/verify', { email, code: wrong });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /incorreto/);

    assert.equal((await c.request('POST', '/auth/signup/verify', { email, code })).status, 204);
    const me = await c.request('GET', '/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.name, 'Maria Souza');
    const user = await api.prisma.user.findUniqueOrThrow({ where: { email } });
    assert.ok(user.passwordHash?.startsWith('scrypt$') && !user.passwordHash.includes('segredo123'));
    assert.ok(user.termsAcceptedAt);
    assert.ok((await api.prisma.invite.findFirstOrThrow({ where: { email } })).acceptedAt);
    // O código já foi usado.
    assert.equal((await client(api.url).request('POST', '/auth/signup/verify', { email, code })).status, 400);
    // Cadastrar de novo o mesmo e-mail: já existe.
    assert.equal((await signup(client(api.url), email)).status, 409);
  });

  test('entrar: senha certa abre a sessão; errada não diz se o e-mail existe', async () => {
    const email = mail('maria');
    const c = client(api.url);
    const bad = await c.request('POST', '/auth/login', { email, password: 'errada123' });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.message, 'E-mail ou senha incorretos.');
    assert.equal((await c.request('POST', '/auth/login', { email: mail('ninguem'), password: 'errada123' })).body.message, 'E-mail ou senha incorretos.');
    assert.equal((await c.request('POST', '/auth/login', { email: email.toUpperCase(), password: 'segredo123' })).status, 204);
    assert.equal((await c.request('GET', '/me')).status, 200);
  });

  test('e-mail de ADMIN_EMAILS cria conta sem convite e vira admin', async () => {
    const email = mail('dona');
    const c = client(api.url);
    assert.equal((await signup(c, email)).status, 204);
    assert.equal((await c.request('POST', '/auth/signup/verify', { email, code: await codeFor(email) })).status, 204);
    assert.equal((await c.request('GET', '/me')).body.role, 'admin');
  });

  test('esqueci minha senha: código, senha nova, a antiga para de valer', async () => {
    const email = mail('maria');
    const c = client(api.url);
    assert.equal((await c.request('POST', '/auth/password/forgot', { email: mail('ninguem') })).status, 204, 'não revela quem tem conta');
    assert.equal((await c.request('POST', '/auth/password/forgot', { email })).status, 204);
    const code = await codeFor(email, 2);
    assert.equal((await c.request('POST', '/auth/password/reset', { email, code, password: 'curta' })).status, 400);
    assert.equal((await c.request('POST', '/auth/password/reset', { email, code, password: 'novasenha1' })).status, 204);
    assert.equal((await c.request('GET', '/me')).status, 200, 'já entra logado');
    assert.equal((await client(api.url).request('POST', '/auth/login', { email, password: 'segredo123' })).status, 401);
    assert.equal((await client(api.url).request('POST', '/auth/login', { email, password: 'novasenha1' })).status, 204);
  });

  test('conta só do Google: o login com senha explica como criar uma', async () => {
    const r = await client(api.url).request('POST', '/auth/login', { email: mail('admin'), password: 'qualquer1' });
    assert.equal(r.status, 401);
    assert.match(r.body.message, /Esqueci minha senha/);
  });

  test('5 tentativas erradas invalidam o código', async () => {
    const email = mail('admin');
    const c = client(api.url);
    await c.request('POST', '/auth/password/forgot', { email });
    const code = await codeFor(email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await c.request('POST', '/auth/password/reset', { email, code: wrong, password: 'novasenha1' });
    const r = await c.request('POST', '/auth/password/reset', { email, code, password: 'novasenha1' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Muitas tentativas/);
  });

  test('login trava após 10 tentativas erradas (força bruta)', async () => {
    const email = mail('forca');
    await api.prisma.user.create({ data: { email, name: 'Força', handle: `forca${run}`, passwordHash: await hashPassword('senhacerta1') } });
    const c = client(api.url);
    for (let i = 0; i < 10; i++) {
      assert.equal((await c.request('POST', '/auth/login', { email, password: 'errada' })).status, 401);
    }
    // 11ª tentativa: bloqueada, mesmo com a senha certa
    const blocked = await c.request('POST', '/auth/login', { email, password: 'senhacerta1' });
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /Muitas tentativas/);
  });

  test('login que dá certo zera o contador de tentativas', async () => {
    const email = mail('zera');
    await api.prisma.user.create({ data: { email, name: 'Zera', handle: `zera${run}`, passwordHash: await hashPassword('senhacerta1') } });
    const c = client(api.url);
    for (let i = 0; i < 9; i++) await c.request('POST', '/auth/login', { email, password: 'errada' });
    assert.equal((await c.request('POST', '/auth/login', { email, password: 'senhacerta1' })).status, 204);
    // Depois de zerar, dá para tentar de novo sem bloquear na hora.
    assert.equal((await c.request('POST', '/auth/login', { email, password: 'errada' })).status, 401);
  });

  test('envio de código tem teto diário por e-mail', async () => {
    const email = mail('teto');
    await api.prisma.invite.create({ data: { email, tokenHash: `teto${run}`, invitedById: adminId, expiresAt: new Date(Date.now() + 86_400_000) } });
    // Simula que o teto do dia já foi atingido.
    await api.prisma.rateLimit.create({ data: { key: `code:${email}`, count: 10, windowStart: new Date() } });
    const r = await signup(client(api.url), email);
    assert.equal(r.status, 429);
    assert.match(r.body.message, /Muitas tentativas/);
  });
});
