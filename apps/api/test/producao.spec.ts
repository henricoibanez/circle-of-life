import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { client, startApi } from './helpers';

// Cada arquivo de teste roda num processo separado, então aqui a API
// sobe "como em produção", sem o login de desenvolvimento.
describe('Em produção', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({
      NODE_ENV: 'production',
      JWT_SECRET: 'um-segredo-de-producao-bem-longo-para-o-teste-0123456789',
      S3_CREATE_BUCKET: 'false',
    });
  });

  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('as rotas do login de teste não existem', async () => {
    const c = client(api.url);
    assert.equal((await c.request('GET', '/auth/dev/users')).status, 404);
    assert.equal((await c.request('POST', '/auth/dev/login', { userId: 'x' })).status, 404);
  });

  test('providers informa que não há login de teste', async () => {
    const res = await client(api.url).request('GET', '/auth/providers');
    assert.equal(res.body.dev, false);
  });
});

describe('Validação das variáveis de ambiente', () => {
  test('em produção, o segredo de exemplo é recusado', async () => {
    const { validateEnv } = await import('../src/config/env.js');
    assert.throws(
      () => validateEnv({ ...process.env, NODE_ENV: 'production', JWT_SECRET: 'troque-este-segredo-local-por-um-texto-bem-longo-123' }),
      /JWT_SECRET: em produção, troque o valor de exemplo/,
    );
  });

  test('falta de variável gera mensagem clara', async () => {
    const { validateEnv } = await import('../src/config/env.js');
    const { DATABASE_URL: _, ...rest } = process.env;
    assert.throws(() => validateEnv(rest), /DATABASE_URL/);
  });
});
