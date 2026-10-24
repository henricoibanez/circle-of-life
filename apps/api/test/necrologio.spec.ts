import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Necrológio', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('começa vazio e salva o texto com a formatação do editor', async () => {
    const { c } = await loginAs(api, 'nec1');
    assert.deepEqual((await c.request('GET', '/necrologio')).body, { html: '', updatedAt: null });
    const html = '<h1>Meu legado</h1><p style="text-align:center">Viveu <b>bem</b>, <i>amou</i> e <u>ajudou</u>.</p><ul><li>Honestidade</li></ul><p><font color="#7c4dde">roxo</font></p>';
    const r = await c.request('PUT', '/necrologio', { html });
    assert.equal(r.status, 200);
    assert.equal(r.body.html, html);
    assert.equal((await c.request('GET', '/necrologio')).body.html, html);
  });

  test('remove scripts, links e atributos perigosos antes de salvar', async () => {
    const { c } = await loginAs(api, 'nec2');
    const r = await c.request('PUT', '/necrologio', {
      html: '<p onclick="alert(1)">Oi<script>alert(2)</script><a href="javascript:x">link</a><img src=x onerror=alert(3)></p>',
    });
    assert.equal(r.body.html, '<p>Oilink</p>');
  });
});
