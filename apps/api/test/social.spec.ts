import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, mailpitMessages, startApi } from './helpers';

type Note = { type: string };

describe('Amigos e grupos', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let ana: Awaited<ReturnType<typeof loginAs>>;
  let bia: Awaited<ReturnType<typeof loginAs>>;
  let caio: Awaited<ReturnType<typeof loginAs>>;
  let adm: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    ana = await loginAs(api, 'ana');
    bia = await loginAs(api, 'bia');
    caio = await loginAs(api, 'caio');
    adm = await loginAs(api, 'adm', { role: 'admin' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('pedido por @ID: aparece nas duas pontas, avisa e manda e-mail', async () => {
    const r = await ana.c.request('POST', '/friends/requests', { who: '@bia' });
    assert.equal(r.status, 201);
    const mine = (await ana.c.request('GET', '/friends')).body;
    assert.equal(mine.sent.length, 1);
    assert.equal(mine.sent[0].person.handle, 'bia');
    const theirs = (await bia.c.request('GET', '/friends')).body;
    assert.equal(theirs.received[0].person.handle, 'ana');
    assert.ok((await bia.c.request('GET', '/notifications')).body.some((n: Note) => n.type === 'amizade_pedido'));
    assert.ok((await mailpitMessages('bia@teste.local')).some(m => m.Subject.includes('quer ser seu amigo')));
  });

  test('pedido repetido, para si mesmo ou para quem não existe é recusado', async () => {
    assert.equal((await ana.c.request('POST', '/friends/requests', { who: 'bia' })).status, 409);
    assert.equal((await ana.c.request('POST', '/friends/requests', { who: 'ana@teste.local' })).status, 400);
    assert.equal((await ana.c.request('POST', '/friends/requests', { who: 'ninguem@teste.local' })).status, 404);
  });

  test('aceitar vira amizade e avisa quem pediu; só quem recebeu pode aceitar', async () => {
    const id = (await bia.c.request('GET', '/friends')).body.received[0].id;
    assert.equal((await ana.c.request('POST', `/friends/requests/${id}/accept`)).status, 404);
    assert.equal((await bia.c.request('POST', `/friends/requests/${id}/accept`)).status, 201);
    assert.deepEqual((await ana.c.request('GET', '/friends')).body.friends.map((p: { handle: string }) => p.handle), ['bia']);
    assert.ok((await ana.c.request('GET', '/notifications')).body.some((n: Note) => n.type === 'amizade_aceita'));
    assert.equal((await ana.c.request('POST', '/friends/requests', { who: 'bia' })).status, 409);
  });

  test('pedido cruzado vira amizade na hora; recusar e remover funcionam', async () => {
    await caio.c.request('POST', '/friends/requests', { who: 'ana' });
    const r = await ana.c.request('POST', '/friends/requests', { who: 'caio' });
    assert.equal(r.body.status, 'amigos');
    assert.equal((await ana.c.request('GET', '/friends')).body.friends.length, 2);

    assert.equal((await ana.c.request('DELETE', `/friends/${caio.user.id}`)).status, 204);
    assert.equal((await ana.c.request('GET', '/friends')).body.friends.length, 1);

    await caio.c.request('POST', '/friends/requests', { who: 'bia' });
    const id = (await bia.c.request('GET', '/friends')).body.received[0].id;
    assert.equal((await bia.c.request('DELETE', `/friends/requests/${id}`)).status, 204);
    assert.equal((await caio.c.request('GET', '/friends')).body.sent.length, 0);
  });

  test('criar grupo: quem cria é administrador; outros veem como sugerido', async () => {
    const r = await ana.c.request('POST', '/groups', { name: 'Corredores', description: 'Treinos de rua', area: 'saude' });
    assert.equal(r.status, 201);
    assert.equal(r.body.admin, true);
    assert.equal(r.body.members, 1);
    assert.equal(r.body.icon, 'dumbbell');
    const list = (await bia.c.request('GET', '/groups')).body;
    assert.ok(list.suggested.some((g: { id: string }) => g.id === r.body.id));
    assert.equal(list.mine.length, 0);
    assert.equal((await ana.c.request('POST', '/groups', { name: 'X', description: '', area: 'saude' })).status, 400);
  });

  test('entrar avisa o administrador; só o administrador edita, coloca trilhas e exclui', async () => {
    const g = (await ana.c.request('POST', '/groups', { name: 'Leitores', description: 'Livros', area: 'intelectual' })).body;
    const joined = (await bia.c.request('POST', `/groups/${g.id}/join`)).body;
    assert.equal(joined.member, true);
    assert.equal(joined.admin, false);
    assert.equal(joined.memberList.length, 2);
    assert.ok((await ana.c.request('GET', '/notifications')).body.some((n: Note) => n.type === 'grupo_entrada'));

    assert.equal((await bia.c.request('PATCH', `/groups/${g.id}`, { name: 'Outro nome' })).status, 403);
    assert.equal((await ana.c.request('PATCH', `/groups/${g.id}`, { name: 'Leitores de Homero' })).body.name, 'Leitores de Homero');

    // trilha aprovada da loja
    const ini = (await adm.c.request('POST', '/initiatives', { title: 'Clássicos' })).body;
    const ep = (await adm.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Odisseia', area: 'intelectual' })).body;
    await adm.c.request('POST', '/tasks', { epicId: ep.id, title: 'Canto 1' });
    const t = (await adm.c.request('POST', `/initiatives/${ini.id}/publish`, { description: 'Leitura dos clássicos gregos.', category: 'saude', priceXp: 0 })).body;
    assert.equal((await ana.c.request('POST', `/groups/${g.id}/trilhas`, { trilhaId: t.id })).status, 400);
    await adm.c.request('POST', `/trilhas/${t.id}/approve`);
    assert.equal((await bia.c.request('POST', `/groups/${g.id}/trilhas`, { trilhaId: t.id })).status, 403);
    const withT = (await ana.c.request('POST', `/groups/${g.id}/trilhas`, { trilhaId: t.id })).body;
    assert.equal(withT.trilhaList[0].title, 'Clássicos');
    assert.equal(withT.trilhas, 1);
    assert.ok((await bia.c.request('GET', '/notifications')).body.some((n: Note) => n.type === 'grupo_trilha'));
    assert.equal((await ana.c.request('DELETE', `/groups/${g.id}/trilhas/${t.id}`)).body.trilhas, 0);

    assert.equal((await bia.c.request('DELETE', `/groups/${g.id}`)).status, 403);
    assert.equal((await ana.c.request('DELETE', `/groups/${g.id}`)).status, 204);
    assert.equal((await bia.c.request('GET', `/groups/${g.id}`)).status, 404);
  });

  test('se o único administrador sai, o membro mais antigo assume', async () => {
    const g = (await ana.c.request('POST', '/groups', { name: 'Gratidão', description: '', area: 'emocional' })).body;
    await bia.c.request('POST', `/groups/${g.id}/join`);
    await caio.c.request('POST', `/groups/${g.id}/join`);
    assert.equal((await ana.c.request('DELETE', `/groups/${g.id}/membership`)).status, 204);
    const d = (await bia.c.request('GET', `/groups/${g.id}`)).body;
    assert.equal(d.admin, true);
    assert.equal(d.members, 2);
  });
});
