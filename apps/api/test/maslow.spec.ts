import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Pirâmide de Maslow', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('marcar e desmarcar itens; item inexistente é recusado', async () => {
    const { c } = await loginAs(api, 'mas1');
    let r = await c.request('PUT', '/maslow/checks/fis-0', { checked: true });
    assert.deepEqual(r.body.checks, ['fis-0']);
    await c.request('PUT', '/maslow/checks/fis-0', { checked: true });
    r = await c.request('PUT', '/maslow/checks/seg-1', { checked: true });
    assert.equal(r.body.checks.length, 2, 'marcar de novo não duplica');
    r = await c.request('PUT', '/maslow/checks/fis-0', { checked: false });
    assert.deepEqual(r.body.checks, ['seg-1']);
    assert.equal((await c.request('PUT', '/maslow/checks/fis-99', { checked: true })).status, 400);
  });

  test('reflexões por nível: criar, listar e apagar (só as próprias)', async () => {
    const me = await loginAs(api, 'mas2');
    const other = await loginAs(api, 'mas3');
    const r = await me.c.request('POST', '/maslow/notes', { level: 'seg', text: 'Montar a reserva' });
    assert.equal(r.body.notes[0].text, 'Montar a reserva');
    assert.equal((await me.c.request('POST', '/maslow/notes', { level: 'xyz', text: 'a' })).status, 400);
    const id = r.body.notes[0].id;
    assert.equal((await other.c.request('DELETE', `/maslow/notes/${id}`)).status, 404);
    assert.equal((await me.c.request('DELETE', `/maslow/notes/${id}`)).status, 204);
  });
});
