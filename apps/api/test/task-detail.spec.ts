import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

// Uma imagem PNG mínima (1x1 pixel).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Detalhe da tarefa, checklist e anexos (storage S3)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let me: Awaited<ReturnType<typeof loginAs>>;
  let taskId: string;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    me = await loginAs(api, 'ivo');
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'familia' })).body;
    taskId = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Com anexos' })).body.id;
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const upload = async (bytes: Buffer, mime = 'image/png') => {
    const created = await me.c.request('POST', '/uploads', { purpose: 'task', mime, size: bytes.length, name: 'foto.png' });
    assert.equal(created.status, 201);
    const put = await fetch(created.body.uploadUrl, { method: 'PUT', headers: created.body.headers, body: new Uint8Array(bytes) });
    assert.equal(put.status, 200, 'o navegador consegue enviar direto ao storage');
    return created.body.fileId as string;
  };

  test('recusa arquivo que não é imagem e imagem grande demais', async () => {
    const pdf = await me.c.request('POST', '/uploads', { purpose: 'task', mime: 'application/pdf', size: 10 });
    assert.equal(pdf.status, 400);
    const big = await me.c.request('POST', '/uploads', { purpose: 'avatar', mime: 'image/png', size: 3 * 1024 * 1024 });
    assert.equal(big.status, 400);
    assert.match(big.body.message, /até 2 MB/);
  });

  test('envio direto ao storage, confirmação e leitura pela URL temporária', async () => {
    const id = await upload(PNG);
    const ok = await me.c.request('POST', `/uploads/${id}/confirm`);
    assert.equal(ok.status, 201);
    const img = await fetch(ok.body.url);
    assert.equal(img.status, 200);
    assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG);
    const file = await api.prisma.file.findUnique({ where: { id } });
    assert.equal(file!.status, 'ready');
  });

  test('confirmar sem ter enviado dá erro claro', async () => {
    const created = await me.c.request('POST', '/uploads', { purpose: 'task', mime: 'image/png', size: 10 });
    const r = await me.c.request('POST', `/uploads/${created.body.fileId}/confirm`);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /não chegou/);
  });

  test('anexar, ver no detalhe e remover (apaga do storage)', async () => {
    const id = await upload(PNG);
    await me.c.request('POST', `/uploads/${id}/confirm`);
    const att = await me.c.request('POST', `/tasks/${taskId}/attachments`, { fileId: id });
    assert.equal(att.status, 201);

    const detail = (await me.c.request('GET', `/tasks/${taskId}`)).body;
    assert.equal(detail.attachments.length, 1);
    assert.equal(detail.attachments[0].name, 'foto.png');
    assert.equal(detail.logs[0].text, 'Anexou foto.png');
    const url = detail.attachments[0].url;
    assert.equal((await fetch(url)).status, 200);

    assert.equal((await me.c.request('DELETE', `/tasks/${taskId}/attachments/${att.body.id}`)).status, 204);
    assert.equal((await fetch(url)).status, 404, 'arquivo some do storage');
    assert.equal(await api.prisma.file.count({ where: { id } }), 0);
  });

  test('ninguém anexa arquivo de outra pessoa nem vê a tarefa dela', async () => {
    const id = await upload(PNG);
    await me.c.request('POST', `/uploads/${id}/confirm`);
    const other = await loginAs(api, 'jade');
    assert.equal((await other.c.request('GET', `/tasks/${taskId}`)).status, 404);
    const ini = (await other.c.request('POST', '/initiatives', { title: 'X' })).body;
    const ep = (await other.c.request('POST', '/epics', { initiativeId: ini.id, title: 'X', area: 'lazer' })).body;
    const t = (await other.c.request('POST', '/tasks', { epicId: ep.id, title: 'X' })).body;
    assert.equal((await other.c.request('POST', `/tasks/${t.id}/attachments`, { fileId: id })).status, 400);
  });

  test('checklist: marcar dá +2 XP e entra no histórico; desmarcar e excluir tiram', async () => {
    const item = (await me.c.request('POST', `/tasks/${taskId}/checklist`, { text: 'Ligar para a Ana' })).body;
    const on = await me.c.request('PATCH', `/tasks/${taskId}/checklist/${item.id}`, { done: true });
    assert.equal(on.body.xp.gained, 2);
    assert.equal(on.body.item.done, true);
    const off = await me.c.request('PATCH', `/tasks/${taskId}/checklist/${item.id}`, { done: false });
    assert.equal(off.body.xp.gained, -2);
    await me.c.request('PATCH', `/tasks/${taskId}/checklist/${item.id}`, { done: true });
    const del = await me.c.request('DELETE', `/tasks/${taskId}/checklist/${item.id}`);
    assert.equal(del.body.xp.gained, -2);
    const detail = (await me.c.request('GET', `/tasks/${taskId}`)).body;
    assert.ok(detail.logs.some((l: { text: string }) => l.text === 'Concluiu “Ligar para a Ana”'));
    assert.ok(detail.logs.some((l: { text: string }) => l.text === 'Reabriu “Ligar para a Ana”'));
  });

  test('excluir a tarefa apaga as imagens dela do storage', async () => {
    const id = await upload(PNG);
    const url = (await me.c.request('POST', `/uploads/${id}/confirm`)).body.url;
    const ini = (await me.c.request('POST', '/initiatives', { title: 'Y' })).body;
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Y', area: 'lazer' })).body;
    const t = (await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Y' })).body;
    await me.c.request('POST', `/tasks/${t.id}/attachments`, { fileId: id });
    await me.c.request('DELETE', `/tasks/${t.id}`);
    assert.equal((await fetch(url)).status, 404);
  });
});
