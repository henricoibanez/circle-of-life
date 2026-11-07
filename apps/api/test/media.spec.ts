import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { acceptedLabel, MEDIA_RULES, mediaLimit, validClip } from '@circle/shared';
import { loginAs, startApi } from './helpers';

const MB = 1024 * 1024;
/** Conteúdo pequeno qualquer: o storage não confere se o arquivo é mesmo um vídeo ou PDF (só o tipo e o tamanho declarados). */
const BYTES = new Uint8Array([1, 2, 3, 4]);

describe('Vídeos e documentos (tipos e limites por lugar do app)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let me: Awaited<ReturnType<typeof loginAs>>;

  /** Envia um arquivo e devolve o id (já confirmado). */
  const send = async (purpose: string, mime: string, name: string) => {
    const u = (await me.c.request('POST', '/uploads', { purpose, mime, size: BYTES.length, name })).body;
    await fetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: BYTES });
    const r = await me.c.request('POST', `/uploads/${u.fileId}/confirm`);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body as { id: string; kind: string; name: string };
  };

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    me = await loginAs(api, 'midia');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('as regras: o que cada lugar aceita e o trecho do vídeo', () => {
    assert.deepEqual(mediaLimit('story', 'video/mp4'), { maxMb: 30, maxSeconds: 30 });
    assert.deepEqual(mediaLimit('post', 'video/quicktime'), { maxMb: 50, maxSeconds: 60 });
    assert.deepEqual(mediaLimit('task', 'application/pdf'), { maxMb: 10 });
    assert.equal(mediaLimit('post', 'application/pdf'), null, 'post não aceita documento');
    assert.equal(mediaLimit('dream', 'video/mp4'), null, 'sonho só aceita imagem');
    assert.equal(acceptedLabel('story'), 'imagem ou vídeo');
    assert.equal(validClip('story', 0, 30), true);
    assert.equal(validClip('story', 10, 41), false, 'trecho de 31 s no story');
    assert.equal(validClip('post', 5, 65), true);
    assert.equal(validClip('post', 5, 4), false, 'fim antes do início');
    assert.equal(validClip('task', 0, 10), false, 'anexo não tem trecho');
  });

  test('tipo e tamanho são conferidos ao pedir o envio', async () => {
    const ask = (purpose: string, mime: string, size: number) => me.c.request('POST', '/uploads', { purpose, mime, size, name: 'x' });
    assert.equal((await ask('story', 'video/mp4', 30 * MB)).status, 201);
    const big = await ask('story', 'video/mp4', 30 * MB + 1);
    assert.equal(big.status, 400);
    assert.match(big.body.message, /vídeo pode ter até 30 MB/);
    assert.equal((await ask('post', 'video/mp4', 50 * MB)).status, 201);
    assert.equal((await ask('task', 'application/pdf', 10 * MB + 1)).status, 400);
    const doc = await ask('post', 'application/pdf', 100);
    assert.equal(doc.status, 400);
    assert.match(doc.body.message, /Envie imagem ou vídeo/);
    assert.equal((await ask('dream', 'video/mp4', 100)).status, 400);
    assert.equal((await ask('task', 'application/zip', 100)).status, 400, 'tipo fora da lista');
  });

  test('anexo da tarefa aceita vídeo e documento e devolve o tipo', async () => {
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const task = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'T' })).body;
    const pdf = await send('task', 'application/pdf', 'contrato.pdf');
    assert.equal(pdf.kind, 'doc');
    const video = await send('task', 'video/mp4', 'passo.mp4');
    await me.c.request('POST', `/tasks/${task.id}/attachments`, { fileId: pdf.id });
    await me.c.request('POST', `/tasks/${task.id}/attachments`, { fileId: video.id });
    const detail = (await me.c.request('GET', `/tasks/${task.id}`)).body;
    assert.deepEqual(
      detail.attachments.map((a: { name: string; kind: string }) => [a.name, a.kind]),
      [['contrato.pdf', 'doc'], ['passo.mp4', 'video']],
    );
  });

  test('story com vídeo exige o trecho de até 30 s', async () => {
    const max = MEDIA_RULES.story.video!.maxSeconds!;
    const v1 = await send('story', 'video/mp4', 'a.mp4');
    assert.equal((await me.c.request('POST', '/stories', { fileId: v1.id, areas: ['lazer'] })).status, 400, 'sem trecho');
    const long = await me.c.request('POST', '/stories', { fileId: v1.id, areas: ['lazer'], clipStart: 5, clipEnd: 5 + max + 2 });
    assert.equal(long.status, 400);
    assert.match(long.body.message, /até 30 segundos/);
    assert.equal((await me.c.request('POST', '/stories', { fileId: v1.id, areas: ['lazer'], clipStart: 5, clipEnd: 35 })).status, 201);

    const photo = await send('story', 'image/png', 'f.png');
    assert.equal((await me.c.request('POST', '/stories', { fileId: photo.id, areas: ['lazer'], clipStart: 0, clipEnd: 999 })).status, 201, 'foto ignora trecho');

    const list = (await me.c.request('GET', '/stories')).body;
    const mine = list.find((g: { mine: boolean }) => g.mine).stories;
    assert.deepEqual(
      mine.map((s: { kind: string; clip: unknown }) => [s.kind, s.clip]),
      [
        ['video', { start: 5, end: 35 }],
        ['image', null],
      ],
    );
  });

  test('post: até 1 vídeo, com trecho de até 60 s; ao editar, o vídeo mantém o trecho', async () => {
    const photo = await send('post', 'image/png', 'f.png');
    const v1 = await send('post', 'video/mp4', 'a.mp4');
    const v2 = await send('post', 'video/mp4', 'b.mp4');
    const post = (body: object) => me.c.request('POST', '/posts', { text: 'Olha só', ...body });

    assert.equal((await post({ mediaIds: [photo.id, v1.id] })).status, 400, 'vídeo sem trecho');
    assert.equal((await post({ mediaIds: [v1.id], clipStart: 0, clipEnd: 61 })).status, 400, 'trecho de 61 s');
    const two = await post({ mediaIds: [v1.id, v2.id], clipStart: 0, clipEnd: 10 });
    assert.equal(two.status, 400);
    assert.match(two.body.message, /até 1 vídeo/);

    const ok = await post({ mediaIds: [photo.id, v1.id], clipStart: 2, clipEnd: 62 });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const p = ok.body.post;
    assert.deepEqual(
      p.media.map((m: { kind: string; clip: unknown }) => [m.kind, m.clip]),
      [
        ['image', null],
        ['video', { start: 2, end: 62 }],
      ],
    );

    // Editar só a ordem: o vídeo continua com o trecho escolhido.
    const edited = (await me.c.request('PATCH', `/posts/${p.id}`, { mediaIds: [v1.id, photo.id] })).body;
    assert.deepEqual(edited.media[0].clip, { start: 2, end: 62 });
  });
});
