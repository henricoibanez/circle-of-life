import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Loja de trilhas', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let author: Awaited<ReturnType<typeof loginAs>>;
  let buyer: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    admin = await loginAs(api, 'adm', { role: 'admin' });
    author = await loginAs(api, 'autora');
    buyer = await loginAs(api, 'compradora');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const makeInitiative = async (c = author.c, title = 'Correr 5 km') => {
    const ini = (await c.request('POST', '/initiatives', { title, areas: ['saude'] })).body;
    const ep = (await c.request('POST', '/epics', { initiativeId: ini.id, title: 'Treinos', area: 'saude' })).body;
    await c.request('POST', '/tasks', { epicId: ep.id, title: 'Semana 1' });
    await c.request('POST', '/tasks', { epicId: ep.id, title: 'Semana 2' });
    return ini.id as string;
  };
  const publish = async (iniId: string, priceXp = 0) =>
    author.c.request('POST', `/initiatives/${iniId}/publish`, { description: 'Do sofá aos 5 km em seis semanas.', category: 'saude', priceXp });

  test('iniciativa sem épicos com tarefas não pode ser publicada', async () => {
    const ini = (await author.c.request('POST', '/initiatives', { title: 'Vazia' })).body;
    const r = await author.c.request('POST', `/initiatives/${ini.id}/publish`, { description: 'Uma descrição qualquer', category: 'saude', priceXp: 0 });
    assert.equal(r.status, 400);
  });

  test('publicar deixa pendente: só o autor e os admins veem; admin é avisado', async () => {
    const r = await publish(await makeInitiative());
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'pendente');
    assert.equal(r.body.tasksCount, 2);
    assert.equal(r.body.epics[0].tasks[1], 'Semana 2');
    const id = r.body.id;
    assert.ok((await author.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id));
    assert.ok((await admin.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id));
    assert.equal((await buyer.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id), false);
    assert.equal((await buyer.c.request('GET', `/trilhas/${id}`)).status, 404);
    assert.equal((await buyer.c.request('POST', `/trilhas/${id}/import`)).status, 404);
    const notes = (await admin.c.request('GET', '/notifications')).body;
    assert.ok(notes.some((n: { type: string }) => n.type === 'trilha_pendente'));
  });

  test('só admin aprova; aprovada aparece para todos e o autor é avisado', async () => {
    const id = (await publish(await makeInitiative())).body.id;
    assert.equal((await author.c.request('POST', `/trilhas/${id}/approve`)).status, 403);
    const r = await admin.c.request('POST', `/trilhas/${id}/approve`);
    assert.equal(r.body.status, 'aprovada');
    assert.ok((await buyer.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id));
    assert.ok((await author.c.request('GET', '/notifications')).body.some((n: { type: string }) => n.type === 'trilha_aprovada'));
  });

  test('recusar com motivo: autor vê o motivo e é avisado', async () => {
    const id = (await publish(await makeInitiative())).body.id;
    assert.equal((await admin.c.request('POST', `/trilhas/${id}/reject`, { reason: 'Descreva melhor as tarefas.' })).status, 204);
    const mine = (await author.c.request('GET', `/trilhas/${id}`)).body;
    assert.equal(mine.status, 'recusada');
    assert.equal(mine.rejectionReason, 'Descreva melhor as tarefas.');
    const n = (await author.c.request('GET', '/notifications')).body.find((x: { type: string }) => x.type === 'trilha_recusada');
    assert.match(n.body, /Descreva melhor/);
  });

  test('importar grátis: copia para o backlog e dá +10 XP ao autor (uma vez por pessoa)', async () => {
    const id = (await publish(await makeInitiative())).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const before = (await author.c.request('GET', '/me')).body.xp.total;
    const r = await buyer.c.request('POST', `/trilhas/${id}/import`);
    assert.equal(r.status, 201);
    assert.equal(r.body.paid, 0);
    const tasks = await api.prisma.task.findMany({ where: { userId: buyer.user.id, epic: { initiativeId: r.body.initiativeId } } });
    assert.deepEqual(tasks.map(t => t.title).sort(), ['Semana 1', 'Semana 2']);
    assert.ok(tasks.every(t => t.status === 'backlog'));
    assert.equal((await author.c.request('GET', '/me')).body.xp.total, before + 10);
    await buyer.c.request('POST', `/trilhas/${id}/import`);
    assert.equal((await author.c.request('GET', '/me')).body.xp.total, before + 10, 'importar de novo não dá XP de novo');
    const listed = (await buyer.c.request('GET', `/trilhas/${id}`)).body;
    assert.equal(listed.acquired, true);
    assert.equal(listed.downloads, 1);
  });

  test('trilha paga: recusa sem saldo; com saldo debita só o disponível do comprador; o preço não vai para o autor', async () => {
    const id = (await publish(await makeInitiative(), 50)).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const poor = await loginAs(api, 'semxp');
    const r1 = await poor.c.request('POST', `/trilhas/${id}/import`);
    assert.equal(r1.status, 400);
    assert.match(r1.body.message, /XP disponível insuficiente/);

    await api.prisma.user.update({ where: { id: buyer.user.id }, data: { xpTotal: 200 } });
    const authorBefore = (await author.c.request('GET', '/me')).body.xp.total;
    const r2 = await buyer.c.request('POST', `/trilhas/${id}/import`);
    assert.equal(r2.body.paid, 50);
    const me = (await buyer.c.request('GET', '/me')).body.xp;
    assert.deepEqual(me, { total: 200, disponivel: 150 }, 'gastar não mexe no XP total');
    assert.equal((await author.c.request('GET', '/me')).body.xp.total, authorBefore + 10);

    await buyer.c.request('POST', `/trilhas/${id}/import`);
    assert.equal((await buyer.c.request('GET', '/me')).body.xp.disponivel, 150, 'importar de novo não cobra de novo');
  });

  test('o autor importa a própria trilha sem pagar nem ganhar XP', async () => {
    const id = (await publish(await makeInitiative(), 30)).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const before = (await author.c.request('GET', '/me')).body.xp;
    const r = await author.c.request('POST', `/trilhas/${id}/import`);
    assert.equal(r.body.paid, 0);
    assert.deepEqual((await author.c.request('GET', '/me')).body.xp, before);
  });

  test('nova versão fica pendente e a aprovada segue na loja até a nova ser aprovada', async () => {
    const iniId = await makeInitiative(author.c, 'Ler mais');
    const v1 = (await publish(iniId)).body.id;
    await admin.c.request('POST', `/trilhas/${v1}/approve`);
    const v2 = (await publish(iniId)).body.id;
    let visible = (await buyer.c.request('GET', '/trilhas')).body.map((t: { id: string }) => t.id);
    assert.ok(visible.includes(v1) && !visible.includes(v2));
    await admin.c.request('POST', `/trilhas/${v2}/approve`);
    visible = (await buyer.c.request('GET', '/trilhas')).body.map((t: { id: string }) => t.id);
    assert.ok(!visible.includes(v1) && visible.includes(v2));
  });

  test('favoritar e tirar da loja', async () => {
    const id = (await publish(await makeInitiative())).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    await buyer.c.request('PUT', `/trilhas/${id}/favorite`);
    assert.equal((await buyer.c.request('GET', `/trilhas/${id}`)).body.favorite, true);
    assert.equal((await buyer.c.request('POST', `/trilhas/${id}/unpublish`)).status, 403);
    await author.c.request('POST', `/trilhas/${id}/unpublish`);
    assert.equal((await buyer.c.request('GET', `/trilhas/${id}`)).status, 404);
  });
});
