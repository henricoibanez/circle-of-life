import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

type StoryGroup = { stories: { id: string; myReaction: string | null; reactions: Record<string, number> | null }[] };

/** Reações (curtir, não curtir, coração) em comentários e stories. */
describe('Reações', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('comentário: reagir, trocar a reação e tirar', async () => {
    const ana = await loginAs(api, 'reana');
    const bia = await loginAs(api, 'rebia');
    const post = (await ana.c.request('POST', '/posts', { text: 'Corri 5 km!' })).body.post;
    const c = (await ana.c.request('POST', `/posts/${post.id}/comments`, { text: 'Boa!' })).body.comments[0];
    const url = `/posts/${post.id}/comments/${c.id}/reaction`;

    let r = await bia.c.request('PUT', url, { kind: 'heart' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body[0].reactions, { like: 0, dislike: 0, heart: 1 });
    assert.equal(r.body[0].myReaction, 'heart');
    await ana.c.request('PUT', url, { kind: 'like' });
    r = await bia.c.request('PUT', url, { kind: 'dislike' });
    assert.deepEqual(r.body[0].reactions, { like: 1, dislike: 1, heart: 0 }, 'trocar substitui');
    r = await bia.c.request('DELETE', url);
    assert.deepEqual(r.body[0].reactions, { like: 1, dislike: 0, heart: 0 });
    assert.equal(r.body[0].myReaction, null);
    assert.equal((await bia.c.request('PUT', url, { kind: 'raiva' })).status, 400);
  });

  test('story: reagir com coração; o autor vê quantas de cada e quem reagiu', async () => {
    const ana = await loginAs(api, 'stana');
    const bia = await loginAs(api, 'stbia');
    const file = await api.prisma.file.create({
      data: { userId: ana.user.id, key: `teste/${Date.now()}.jpg`, name: 'f.jpg', purpose: 'story', mime: 'image/jpeg', size: 10, status: 'ready' },
    });
    const story = await api.prisma.story.create({ data: { authorId: ana.user.id, fileId: file.id, areas: ['lazer'], visibility: 'publico', expiresAt: new Date(Date.now() + 86_400_000) } });
    assert.equal((await bia.c.request('PUT', `/stories/${story.id}/like`, { kind: 'heart' })).status, 204);
    const find = async (who: typeof ana) => ((await who.c.request('GET', '/stories')).body as StoryGroup[]).flatMap(g => g.stories).find(s => s.id === story.id)!;
    const seen = await find(bia);
    assert.equal(seen.myReaction, 'heart');
    assert.equal(seen.reactions, null, 'só o autor vê as contagens');
    assert.deepEqual((await find(ana)).reactions, { like: 0, dislike: 0, heart: 1 });
    await bia.c.request('POST', `/stories/${story.id}/view`);
    const viewers = (await ana.c.request('GET', `/stories/${story.id}/viewers`)).body;
    assert.equal(viewers[0].reaction, 'heart');
    await bia.c.request('PUT', `/stories/${story.id}/like`);
    assert.equal((await api.prisma.storyLike.findFirstOrThrow({ where: { storyId: story.id } })).kind, 'like', 'sem tipo = curtir');
  });
});
