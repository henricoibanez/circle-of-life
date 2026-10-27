import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

type P = { id: string; title: string; text: string };
type Note = { type: string; title: string; readAt: string | null };

describe('Feed', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let ana: Awaited<ReturnType<typeof loginAs>>;
  let bia: Awaited<ReturnType<typeof loginAs>>;
  let caio: Awaited<ReturnType<typeof loginAs>>;
  let duda: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    ana = await loginAs(api, 'ana');
    bia = await loginAs(api, 'bia');
    caio = await loginAs(api, 'caio');
    duda = await loginAs(api, 'duda');
    // ana e bia são amigas; caio não é amigo de ninguém
    await ana.c.request('POST', '/friends/requests', { who: 'bia' });
    await bia.c.request('POST', '/friends/requests', { who: 'ana' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const feed = async (c: typeof ana.c, q = '') => (await c.request('GET', `/feed${q}`)).body.posts.map((p: P) => p.text) as string[];

  test('primeiro post do dia rende +10 XP; o segundo não', async () => {
    const r1 = await ana.c.request('POST', '/posts', { text: 'Primeiro post', tags: ['#sprint', 'sprint', 'leitura'] });
    assert.equal(r1.status, 201);
    assert.equal(r1.body.xp.gained, 10);
    assert.deepEqual(r1.body.post.tags, ['sprint', 'leitura']);
    assert.equal(r1.body.post.visibility, 'publico');
    const r2 = await ana.c.request('POST', '/posts', { text: 'Segundo post' });
    assert.equal(r2.body.xp.gained, 0);
  });

  test('post precisa de texto ou de conquista', async () => {
    assert.equal((await ana.c.request('POST', '/posts', { text: '  ' })).status, 400);
    const r = await ana.c.request('POST', '/posts', { title: 'Só a conquista' });
    assert.equal(r.status, 201);
    assert.equal(r.body.post.text, '');
  });

  test('visibilidade: todo mundo, só amigos e privado', async () => {
    await ana.c.request('POST', '/posts', { text: 'Só amigos', visibility: 'amigos' });
    await ana.c.request('POST', '/posts', { text: 'Privado', visibility: 'privado' });
    assert.ok((await feed(ana.c)).includes('Privado'));
    const bf = await feed(bia.c);
    assert.ok(bf.includes('Só amigos') && bf.includes('Primeiro post') && !bf.includes('Privado'));
    const cf = await feed(caio.c);
    assert.ok(cf.includes('Primeiro post') && !cf.includes('Só amigos') && !cf.includes('Privado'));
  });

  test('padrão de visibilidade vem das preferências', async () => {
    await caio.c.request('PATCH', '/me/preferences', { defaultPostVisibility: 'amigos' });
    const r = await caio.c.request('POST', '/posts', { text: 'Post do Caio' });
    assert.equal(r.body.post.visibility, 'amigos');
    assert.equal((await feed(ana.c)).includes('Post do Caio'), false);
  });

  test('post de grupo: só membros veem; só membro posta', async () => {
    const g = (await bia.c.request('POST', '/groups', { name: 'Leitores', description: '', area: 'intelectual' })).body;
    assert.equal((await caio.c.request('POST', '/posts', { text: 'Intruso', groupId: g.id })).status, 403);
    await bia.c.request('POST', '/posts', { text: 'No grupo', groupId: g.id });
    assert.ok((await feed(bia.c, '?filter=grupos')).includes('No grupo'));
    assert.equal((await feed(ana.c)).includes('No grupo'), false);
    await ana.c.request('POST', `/groups/${g.id}/join`);
    assert.ok((await feed(ana.c, '?filter=grupos')).includes('No grupo'));
    assert.ok((await feed(ana.c, '?filter=seguindo')).includes('No grupo'));
    assert.deepEqual(await feed(ana.c, `?group=${g.id}`), ['No grupo']);
  });

  test('filtros amigos e área', async () => {
    await bia.c.request('POST', '/posts', { text: 'Treino feito', area: 'saude' });
    const amigos = await feed(ana.c, '?filter=amigos');
    assert.ok(amigos.includes('Treino feito'));
    assert.ok(!amigos.includes('Primeiro post'));
    assert.deepEqual(await feed(ana.c, '?area=saude'), ['Treino feito']);
  });

  test('curtidas: contagem, "curtido por" e aviso agrupado', async () => {
    const id = (await ana.c.request('POST', '/posts', { text: 'Curta isso' })).body.post.id;
    for (const u of [bia, caio, duda]) assert.equal((await u.c.request('PUT', `/posts/${id}/like`)).status, 204);
    await bia.c.request('PUT', `/posts/${id}/like`); // repetir não conta de novo
    const p = (await ana.c.request('GET', `/posts/${id}`)).body;
    assert.equal(p.likes, 3);
    assert.equal(p.likers.length, 3);
    const notes = ((await ana.c.request('GET', '/notifications')).body as Note[]).filter(n => n.type === 'curtida');
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.title, 'duda e mais 2 pessoas curtiram seu post');
    await caio.c.request('DELETE', `/posts/${id}/like`);
    assert.equal((await ana.c.request('GET', `/posts/${id}`)).body.likes, 2);
  });

  test('não dá para curtir ou comentar post que não pode ver', async () => {
    const id = (await ana.c.request('POST', '/posts', { text: 'Secreto', visibility: 'privado' })).body.post.id;
    assert.equal((await caio.c.request('PUT', `/posts/${id}/like`)).status, 404);
    assert.equal((await caio.c.request('POST', `/posts/${id}/comments`, { text: 'oi' })).status, 404);
    assert.equal((await caio.c.request('GET', `/posts/${id}`)).status, 404);
  });

  test('comentários: +5 XP no primeiro do dia, aviso ao autor, apagar', async () => {
    const id = (await ana.c.request('POST', '/posts', { text: 'Comente aqui' })).body.post.id;
    const r1 = await bia.c.request('POST', `/posts/${id}/comments`, { text: 'Muito bom!' });
    assert.equal(r1.status, 201);
    assert.equal(r1.body.xp.gained, 5);
    const r2 = await bia.c.request('POST', `/posts/${id}/comments`, { text: 'De novo' });
    assert.equal(r2.body.xp.gained, 0);
    assert.equal(r2.body.comments.length, 2);
    assert.ok(((await ana.c.request('GET', '/notifications')).body as Note[]).some(n => n.type === 'comentario'));
    const cid = r2.body.comments[1].id;
    assert.equal((await caio.c.request('DELETE', `/posts/${id}/comments/${cid}`)).status, 404);
    assert.equal((await ana.c.request('DELETE', `/posts/${id}/comments/${cid}`)).status, 204);
    assert.equal((await bia.c.request('GET', `/posts/${id}`)).body.comments, 1);
  });

  test('salvos aparecem no filtro "salvos"', async () => {
    const id = (await ana.c.request('POST', '/posts', { text: 'Para guardar' })).body.post.id;
    await bia.c.request('PUT', `/posts/${id}/save`);
    assert.deepEqual(await feed(bia.c, '?filter=salvos'), ['Para guardar']);
    assert.equal((await bia.c.request('GET', `/posts/${id}`)).body.saved, true);
    await bia.c.request('DELETE', `/posts/${id}/save`);
    assert.deepEqual(await feed(bia.c, '?filter=salvos'), []);
  });

  test('compartilhar conclusão de tarefa mostra o XP ganho com ela', async () => {
    const ini = (await duda.c.request('POST', '/initiatives', { title: 'Ler mais' })).body;
    const ep = (await duda.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Livros', area: 'intelectual' })).body;
    const t = (await duda.c.request('POST', '/tasks', { epicId: ep.id, title: 'Ler Sêneca' })).body;
    await duda.c.request('POST', `/tasks/${t.id}/move`, { status: 'done' });
    const r = await duda.c.request('POST', '/posts', { title: 'Ler Sêneca', text: 'Terminei!', area: 'intelectual', refType: 'task', refId: t.id });
    assert.equal(r.body.post.xpShown, 10);
    assert.equal(r.body.post.title, 'Ler Sêneca');
    // refId de outra pessoa não mostra XP
    const r2 = await caio.c.request('POST', '/posts', { text: 'Espertinho', refType: 'task', refId: t.id });
    assert.equal(r2.body.post.xpShown, null);
  });

  test('editar e excluir: só o autor', async () => {
    const id = (await ana.c.request('POST', '/posts', { text: 'Rascunho' })).body.post.id;
    assert.equal((await bia.c.request('PATCH', `/posts/${id}`, { text: 'Hackeado' })).status, 404);
    const r = await ana.c.request('PATCH', `/posts/${id}`, { text: 'Versão final', visibility: 'amigos' });
    assert.equal(r.body.text, 'Versão final');
    assert.equal(r.body.visibility, 'amigos');
    assert.equal((await bia.c.request('DELETE', `/posts/${id}`)).status, 404);
    assert.equal((await ana.c.request('DELETE', `/posts/${id}`)).status, 204);
    assert.equal((await ana.c.request('GET', `/posts/${id}`)).status, 404);
  });

  test('editar: troca texto, área, hashtags e imagens (as que saem são apagadas)', async () => {
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const photo = async () => {
      const u = (await ana.c.request('POST', '/uploads', { purpose: 'post', mime: 'image/png', size: PNG.length, name: 'f.png' })).body;
      await fetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: new Uint8Array(PNG) });
      await ana.c.request('POST', `/uploads/${u.fileId}/confirm`);
      return u.fileId as string;
    };
    const [a, b] = [await photo(), await photo()];
    const id = (await ana.c.request('POST', '/posts', { text: 'Com fotos', mediaIds: [a] })).body.post.id;
    const r = await ana.c.request('PATCH', `/posts/${id}`, { text: 'Com outra foto', area: 'lazer', tags: ['viagem'], mediaIds: [b] });
    assert.equal(r.status, 200);
    assert.equal(r.body.text, 'Com outra foto');
    assert.equal(r.body.area, 'lazer');
    assert.deepEqual(r.body.tags, ['viagem']);
    assert.deepEqual(r.body.media.map((m: { id: string }) => m.id), [b]);
    assert.equal(await api.prisma.file.count({ where: { id: a } }), 0, 'a foto que saiu foi apagada');
  });

  test('paginação com cursor', async () => {
    for (let i = 0; i < 22; i++) await duda.c.request('POST', '/posts', { text: `Lote ${i}` });
    const p1 = (await duda.c.request('GET', `/feed?author=${duda.user.id}`)).body;
    assert.equal(p1.posts.length, 20);
    assert.ok(p1.nextCursor);
    const p2 = (await duda.c.request('GET', `/feed?author=${duda.user.id}&cursor=${p1.nextCursor}`)).body;
    assert.equal(p2.posts.length, 3);
    assert.equal(p2.nextCursor, null);
  });
});
