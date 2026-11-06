import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

type Note = { type: string; title: string; body: string };
type Person = { id: string; handle: string };

describe('Grupos privados: pedidos e convites', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let gestor: Awaited<ReturnType<typeof loginAs>>;
  let lia: Awaited<ReturnType<typeof loginAs>>;
  let rui: Awaited<ReturnType<typeof loginAs>>;
  let ivo: Awaited<ReturnType<typeof loginAs>>;
  let groupId = '';

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    gestor = await loginAs(api, 'gestora');
    lia = await loginAs(api, 'lia');
    rui = await loginAs(api, 'rui');
    ivo = await loginAs(api, 'ivo');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const notes = async (who: typeof lia) => (await who.c.request('GET', '/notifications')).body as Note[];

  test('grupo privado: quem está de fora vê nome e descrição, mas não os membros', async () => {
    const r = await gestor.c.request('POST', '/groups', { name: 'Clube secreto', description: 'Só convidados', area: 'lazer', private: true });
    assert.equal(r.status, 201);
    assert.equal(r.body.private, true);
    groupId = r.body.id;
    const list = (await lia.c.request('GET', '/groups')).body;
    const g = list.suggested.find((x: { id: string }) => x.id === groupId);
    assert.equal(g.private, true);
    assert.equal(g.pending, null);
    const d = (await lia.c.request('GET', `/groups/${groupId}`)).body;
    assert.equal(d.name, 'Clube secreto');
    assert.deepEqual(d.memberList, []);
    assert.deepEqual(d.requests, [], 'só gestor vê os pedidos');
    assert.equal((await lia.c.request('GET', `/groups/${groupId}/topics`)).status, 403, 'fórum só para membros');
  });

  test('pedir para entrar: fica pendente, avisa o gestor; pode cancelar', async () => {
    const r = await lia.c.request('POST', `/groups/${groupId}/join`);
    assert.equal(r.status, 201);
    assert.equal(r.body.member, false);
    assert.equal(r.body.pending, 'pedido');
    assert.ok((await notes(gestor)).some(n => n.type === 'grupo_pedido' && n.title.includes('lia')));
    const d = (await gestor.c.request('GET', `/groups/${groupId}`)).body;
    assert.deepEqual(d.requests.map((p: Person) => p.handle), ['lia']);
    // Pedir de novo não duplica; cancelar apaga.
    await lia.c.request('POST', `/groups/${groupId}/join`);
    assert.equal(await api.prisma.groupRequest.count({ where: { groupId } }), 1);
    assert.equal((await lia.c.request('DELETE', `/groups/${groupId}/request`)).body.pending, null);
    assert.equal(await api.prisma.groupRequest.count({ where: { groupId } }), 0);
  });

  test('gestor aprova: a pessoa entra e é avisada; membro comum não aprova', async () => {
    await lia.c.request('POST', `/groups/${groupId}/join`);
    await rui.c.request('POST', `/groups/${groupId}/join`);
    assert.equal((await rui.c.request('POST', `/groups/${groupId}/requests/${lia.user.id}/approve`)).status, 403);
    const r = await gestor.c.request('POST', `/groups/${groupId}/requests/${lia.user.id}/approve`);
    assert.equal(r.status, 201);
    assert.ok(r.body.memberList.some((m: Person) => m.handle === 'lia'));
    assert.ok((await notes(lia)).some(n => n.type === 'grupo_aprovado'));
    const d = (await lia.c.request('GET', `/groups/${groupId}`)).body;
    assert.equal(d.member, true);
    assert.equal(d.memberList.length, 2, 'membro vê a lista');
    assert.equal((await lia.c.request('POST', `/groups/${groupId}/requests/${rui.user.id}/approve`)).status, 403, 'membro comum não aprova');
  });

  test('gestor recusa com motivo (ou sem); a pessoa é avisada e pode pedir de novo', async () => {
    const r = await gestor.c.request('POST', `/groups/${groupId}/requests/${rui.user.id}/reject`, { reason: 'Grupo só da família' });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.requests, []);
    const n = (await notes(rui)).find(x => x.type === 'grupo_recusado')!;
    assert.equal(n.body, 'Motivo: Grupo só da família');
    assert.equal((await gestor.c.request('POST', `/groups/${groupId}/requests/${rui.user.id}/reject`, {})).status, 404, 'pedido já respondido');
    assert.equal((await rui.c.request('POST', `/groups/${groupId}/join`)).body.pending, 'pedido');
    await gestor.c.request('POST', `/groups/${groupId}/requests/${rui.user.id}/reject`, {});
    assert.equal((await notes(rui)).filter(x => x.type === 'grupo_recusado').length, 2);
  });

  test('convite: gestor busca e convida; a pessoa vê o convite, aceita e entra', async () => {
    type Found = (Person & { status: string | null })[];
    const find = async (q: string) => (await gestor.c.request('GET', `/groups/${groupId}/invite-search?q=${q}`)).body as Found;
    assert.equal((await find('lia')).find(p => p.handle === 'lia')?.status, 'membro');
    assert.equal((await find('@ivo')).find(p => p.handle === 'ivo')?.status, null);
    assert.equal((await find('rui')).find(p => p.handle === 'rui')?.status, null, 'recusado pode ser convidado');
    assert.equal((await lia.c.request('GET', `/groups/${groupId}/invite-search?q=ivo`)).status, 403, 'só gestor busca para convidar');

    const r = await gestor.c.request('POST', `/groups/${groupId}/invites`, { userId: ivo.user.id });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.invites.map((p: Person) => p.handle), ['ivo']);
    assert.ok((await notes(ivo)).some(n => n.type === 'grupo_convite'));
    const list = (await ivo.c.request('GET', '/groups')).body;
    assert.deepEqual(list.invites.map((g: { id: string }) => g.id), [groupId]);
    assert.ok(!list.suggested.some((g: { id: string }) => g.id === groupId));

    const join = await ivo.c.request('POST', `/groups/${groupId}/join`);
    assert.equal(join.body.member, true, 'aceitar o convite entra na hora');
    assert.ok((await notes(gestor)).some(n => n.type === 'grupo_entrada' && n.title.includes('ivo')));
    assert.equal((await gestor.c.request('POST', `/groups/${groupId}/invites`, { userId: ivo.user.id })).status, 400, 'já está no grupo');
  });

  test('recusar convite, cancelar convite e convidar quem já pediu', async () => {
    const outro = await loginAs(api, 'otto');
    await gestor.c.request('POST', `/groups/${groupId}/invites`, { userId: outro.user.id });
    assert.equal((await outro.c.request('DELETE', `/groups/${groupId}/request`)).body.pending, null, 'recusou o convite');
    await gestor.c.request('POST', `/groups/${groupId}/invites`, { userId: outro.user.id });
    assert.deepEqual((await gestor.c.request('DELETE', `/groups/${groupId}/invites/${outro.user.id}`)).body.invites, []);

    // Rui tinha pedido de novo; convidar quem pediu aprova na hora.
    await rui.c.request('POST', `/groups/${groupId}/join`);
    const r = await gestor.c.request('POST', `/groups/${groupId}/invites`, { userId: rui.user.id });
    assert.ok(r.body.memberList.some((m: Person) => m.handle === 'rui'));
  });

  test('banido não pede nem é convidado; grupo público continua entrando direto', async () => {
    await gestor.c.request('POST', `/groups/${groupId}/members/${rui.user.id}/ban`);
    assert.equal((await rui.c.request('POST', `/groups/${groupId}/join`)).status, 403);
    assert.equal((await gestor.c.request('POST', `/groups/${groupId}/invites`, { userId: rui.user.id })).status, 400);

    const pub = (await gestor.c.request('POST', '/groups', { name: 'Clube aberto', description: 'Todos', area: 'lazer' })).body;
    assert.equal(pub.private, false);
    assert.equal((await rui.c.request('POST', `/groups/${pub.id}/join`)).body.member, true);

    // Tornar público: quem pede entra direto.
    await gestor.c.request('PATCH', `/groups/${groupId}`, { private: false });
    const novo = await loginAs(api, 'nina');
    assert.equal((await novo.c.request('POST', `/groups/${groupId}/join`)).body.member, true);
  });
});
