import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

// Uma imagem PNG mínima (1x1 pixel).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

type Group = { author: { handle: string }; mine: boolean; allSeen: boolean; stories: { id: string; seen: boolean; liked: boolean; likes: number | null; views: number | null }[] };

describe('Stories', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let ana: Awaited<ReturnType<typeof loginAs>>;
  let bia: Awaited<ReturnType<typeof loginAs>>;
  let caio: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    ana = await loginAs(api, 'ana');
    bia = await loginAs(api, 'bia');
    caio = await loginAs(api, 'caio');
    await ana.c.request('POST', '/friends/requests', { who: 'bia' });
    await bia.c.request('POST', '/friends/requests', { who: 'ana' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const photo = async (who: typeof ana) => {
    const u = (await who.c.request('POST', '/uploads', { purpose: 'story', mime: 'image/png', size: PNG.length, name: 'story.png' })).body;
    await fetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: new Uint8Array(PNG) });
    await who.c.request('POST', `/uploads/${u.fileId}/confirm`);
    return u.fileId as string;
  };
  const list = async (who: typeof ana) => (await who.c.request('GET', '/stories')).body as Group[];

  test('precisa de pelo menos 1 área (sem criar nada aqui)', async () => {
    assert.equal((await ana.c.request('POST', '/stories', { fileId: await photo(ana), areas: [] })).status, 400);
    assert.equal((await ana.c.request('POST', '/stories', { fileId: await photo(ana), areas: ['nada'] })).status, 400);
  });

  test('primeiro story do dia rende +10 XP; aceita várias áreas; aparece para quem pode ver', async () => {
    // Sem limite de áreas (antes eram no máximo 3): quatro áreas são aceitas.
    const r1 = await ana.c.request('POST', '/stories', { fileId: await photo(ana), areas: ['saude', 'lazer', 'amor', 'familia'], caption: 'Corrida de hoje' });
    assert.equal(r1.status, 201);
    assert.equal(r1.body.xp.gained, 10);
    const r2 = await ana.c.request('POST', '/stories', { fileId: await photo(ana), areas: ['familia'], visibility: 'amigos' });
    assert.equal(r2.body.xp.gained, 0);

    const mine = await list(ana);
    assert.equal(mine[0]!.mine, true);
    assert.equal(mine[0]!.stories.length, 2);
    assert.equal(mine[0]!.stories[0]!.views, 0);

    assert.equal((await list(bia))[0]!.stories.length, 2);
    assert.equal((await list(caio))[0]!.stories.length, 1, 'quem não é amigo não vê o story "Somente amigos"');
  });

  test('ver, curtir e "Visto por" (só o autor)', async () => {
    const id = (await list(bia))[0]!.stories[0]!.id;
    assert.equal((await list(bia))[0]!.allSeen, false);
    assert.equal((await bia.c.request('POST', `/stories/${id}/view`)).status, 204);
    assert.equal((await caio.c.request('POST', `/stories/${id}/view`)).status, 204);
    assert.equal((await bia.c.request('PUT', `/stories/${id}/like`)).status, 204);
    assert.equal((await caio.c.request('PUT', `/stories/${id}/like`)).status, 204);
    const s = (await list(bia))[0]!.stories[0]!;
    assert.equal(s.seen, true);
    assert.equal(s.liked, true);
    assert.equal(s.likes, null, 'contagem só para o autor');

    const v = (await ana.c.request('GET', `/stories/${id}/viewers`)).body;
    assert.equal(v.length, 2);
    assert.ok(v.every((x: { liked: boolean }) => x.liked));
    assert.equal((await bia.c.request('GET', `/stories/${id}/viewers`)).status, 404);
    assert.equal((await list(ana))[0]!.stories[0]!.likes, 2);

    const notes = ((await ana.c.request('GET', '/notifications')).body as { type: string; title: string }[]).filter(n => n.type === 'curtida_story');
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.title, 'caio e mais 1 pessoa reagiram ao seu story');
  });

  test('não dá para ver story "Somente amigos" de quem não é amigo', async () => {
    const id = (await list(ana))[0]!.stories[1]!.id;
    assert.equal((await caio.c.request('POST', `/stories/${id}/view`)).status, 404);
    assert.equal((await caio.c.request('PUT', `/stories/${id}/like`)).status, 404);
  });

  test('apagar: só o autor; vencidos somem e a limpeza apaga a foto', async () => {
    const [first, second] = (await list(ana))[0]!.stories;
    assert.equal((await bia.c.request('DELETE', `/stories/${second!.id}`)).status, 404);
    assert.equal((await ana.c.request('DELETE', `/stories/${second!.id}`)).status, 204);
    assert.equal((await list(ana))[0]!.stories.length, 1);

    const story = await api.prisma.story.update({ where: { id: first!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await list(ana)).length, 0, 'vencido não aparece');
    const { StoriesService } = require('../src/stories/stories.service') as typeof import('../src/stories/stories.service');
    assert.equal(await api.app.get(StoriesService).cleanup(), 1);
    assert.equal(await api.prisma.file.count({ where: { id: story.fileId } }), 0);
  });
});
