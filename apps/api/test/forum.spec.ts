import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

type Note = { type: string; link: string };

describe('Fórum dos grupos e busca de pessoas', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let ana: Awaited<ReturnType<typeof loginAs>>;
  let bia: Awaited<ReturnType<typeof loginAs>>;
  let caio: Awaited<ReturnType<typeof loginAs>>;
  let groupId = '';

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    ana = await loginAs(api, 'ana');
    bia = await loginAs(api, 'bia');
    caio = await loginAs(api, 'caio');
    await api.prisma.user.update({ where: { id: ana.user.id }, data: { name: 'Ana Souza' } });
    groupId = (await ana.c.request('POST', '/groups', { name: 'Leitores', description: '', area: 'intelectual' })).body.id;
    await bia.c.request('POST', `/groups/${groupId}/join`);
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('só membros leem e escrevem no fórum', async () => {
    assert.equal((await caio.c.request('GET', `/groups/${groupId}/topics`)).status, 403);
    assert.equal((await caio.c.request('POST', `/groups/${groupId}/topics`, { title: 'Oi gente' })).status, 403);
  });

  test('tópico novo avisa os membros; resposta avisa o autor', async () => {
    const t = await bia.c.request('POST', `/groups/${groupId}/topics`, { title: 'Canto 1', text: 'O que acharam da ira de Aquiles?' });
    assert.equal(t.status, 201);
    assert.equal(t.body.replyList.length, 0);
    const notesAna = (await ana.c.request('GET', '/notifications')).body as Note[];
    assert.ok(notesAna.some(n => n.type === 'grupo_topico' && n.link.includes(t.body.id)));

    const r = await ana.c.request('POST', `/groups/${groupId}/topics/${t.body.id}/replies`, { text: 'Achei exagerada!' });
    assert.equal(r.status, 201);
    assert.equal(r.body.replyList[0].text, 'Achei exagerada!');
    assert.ok(((await bia.c.request('GET', '/notifications')).body as Note[]).some(n => n.type === 'grupo_resposta'));

    const list = (await bia.c.request('GET', `/groups/${groupId}/topics`)).body;
    assert.equal(list[0].replies, 1);
    assert.equal((await ana.c.request('POST', `/groups/${groupId}/topics`, { title: 'x' })).status, 400);
  });

  test('apagar: o autor ou o administrador do grupo', async () => {
    const t = (await bia.c.request('POST', `/groups/${groupId}/topics`, { title: 'Tópico da Bia' })).body;
    const r = (await bia.c.request('POST', `/groups/${groupId}/topics/${t.id}/replies`, { text: 'Resposta da Bia' })).body.replyList[0];
    const anaReply = (await ana.c.request('POST', `/groups/${groupId}/topics/${t.id}/replies`, { text: 'Resposta da Ana' })).body.replyList[1];
    assert.equal((await bia.c.request('DELETE', `/groups/${groupId}/topics/${t.id}/replies/${anaReply.id}`)).status, 403);
    // Ana é administradora do grupo: pode apagar a resposta e o tópico da Bia.
    assert.equal((await ana.c.request('DELETE', `/groups/${groupId}/topics/${t.id}/replies/${r.id}`)).status, 200);
    assert.equal((await ana.c.request('DELETE', `/groups/${groupId}/topics/${t.id}`)).status, 204);
    assert.equal((await bia.c.request('GET', `/groups/${groupId}/topics/${t.id}`)).status, 404);
  });

  test('busca de pessoas: por nome ou @ID, com a situação de amizade', async () => {
    assert.deepEqual((await bia.c.request('GET', '/friends/search?q=a')).body, [], 'precisa de 2 letras');
    const r1 = (await bia.c.request('GET', '/friends/search?q=souza')).body;
    assert.equal(r1.length, 1);
    assert.equal(r1[0].handle, 'ana');
    assert.equal(r1[0].relation, null);
    assert.equal(r1[0].email, undefined, 'o e-mail não aparece');
    await bia.c.request('POST', '/friends/requests', { who: 'ana' });
    assert.equal((await bia.c.request('GET', '/friends/search?q=@ana')).body[0].relation, 'enviado');
    const seen = (await ana.c.request('GET', '/friends/search?q=bia')).body[0];
    assert.equal(seen.relation, 'recebido');
    assert.ok(seen.requestId);
    assert.equal((await ana.c.request('GET', '/friends/search?q=ana')).body.length, 0, 'não encontra a si mesma');
  });
});
