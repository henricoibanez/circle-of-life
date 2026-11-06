import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

type Client = Awaited<ReturnType<typeof loginAs>>['c'];

/** Cria uma iniciativa com um épico de duas tarefas e devolve o id do épico. */
const makeEpic = async (c: Client, title = 'Treinos') => {
  const ini = (await c.request('POST', '/initiatives', { title: 'Correr 5 km', areas: ['saude'] })).body;
  const ep = (await c.request('POST', '/epics', { initiativeId: ini.id, title, area: 'saude' })).body;
  await c.request('POST', '/tasks', { epicId: ep.id, title: 'Semana 1' });
  await c.request('POST', '/tasks', { epicId: ep.id, title: 'Semana 2' });
  return ep.id as string;
};
const NEW = { newInitiative: 'Correr mais' };

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

  const publish = async (epicId: string, priceGems = 0) =>
    author.c.request('POST', `/epics/${epicId}/publish`, { description: 'Do sofá aos 5 km em seis semanas.', category: 'saude', priceGems });

  test('épico sem tarefas não pode ser publicado; iniciativa não é mais publicada', async () => {
    const ini = (await author.c.request('POST', '/initiatives', { title: 'Vazia' })).body;
    const ep = (await author.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Sem tarefas', area: 'lazer' })).body;
    assert.equal((await author.c.request('POST', `/epics/${ep.id}/publish`, { description: 'Uma descrição qualquer', category: 'saude', priceGems: 0 })).status, 400);
    assert.equal((await author.c.request('POST', `/initiatives/${ini.id}/publish`, { description: 'Uma descrição qualquer', category: 'saude', priceGems: 0 })).status, 404);
  });

  test('publicar deixa pendente: só o autor e os admins veem; admin é avisado', async () => {
    const r = await publish(await makeEpic(author.c));
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'pendente');
    assert.equal(r.body.area, 'saude');
    assert.equal(r.body.title, 'Treinos');
    assert.equal(r.body.tasksCount, 2);
    assert.deepEqual(r.body.tasks, ['Semana 1', 'Semana 2']);
    assert.equal(r.body.groupId, null);
    const id = r.body.id;
    assert.ok((await author.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id));
    assert.ok((await admin.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id));
    assert.equal((await admin.c.request('GET', `/trilhas/${id}`)).body.canReview, true);
    assert.equal((await buyer.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id), false);
    assert.equal((await buyer.c.request('GET', `/trilhas/${id}`)).status, 404);
    assert.equal((await buyer.c.request('POST', `/trilhas/${id}/import`, NEW)).status, 404);
    const notes = (await admin.c.request('GET', '/notifications')).body;
    assert.ok(notes.some((n: { type: string }) => n.type === 'trilha_pendente'));
  });

  test('só admin aprova; aprovada aparece para todos e o autor é avisado', async () => {
    const id = (await publish(await makeEpic(author.c))).body.id;
    assert.equal((await author.c.request('POST', `/trilhas/${id}/approve`)).status, 403);
    const r = await admin.c.request('POST', `/trilhas/${id}/approve`);
    assert.equal(r.body.status, 'aprovada');
    assert.ok((await buyer.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id));
    assert.ok((await author.c.request('GET', '/notifications')).body.some((n: { type: string }) => n.type === 'trilha_aprovada'));
  });

  test('o admin aprova a própria trilha (pode ser o único admin)', async () => {
    const id = (await admin.c.request('POST', `/epics/${await makeEpic(admin.c)}/publish`, { description: 'Trilha publicada pelo próprio admin.', category: 'saude', priceGems: 0 })).body.id;
    assert.equal((await admin.c.request('GET', `/trilhas/${id}`)).body.canReview, true);
    assert.equal((await admin.c.request('POST', `/trilhas/${id}/approve`)).body.status, 'aprovada');
  });

  test('recusar com motivo: autor vê o motivo e é avisado', async () => {
    const id = (await publish(await makeEpic(author.c))).body.id;
    assert.equal((await admin.c.request('POST', `/trilhas/${id}/reject`, { reason: 'Descreva melhor as tarefas.' })).status, 204);
    const mine = (await author.c.request('GET', `/trilhas/${id}`)).body;
    assert.equal(mine.status, 'recusada');
    assert.equal(mine.rejectionReason, 'Descreva melhor as tarefas.');
    const n = (await author.c.request('GET', '/notifications')).body.find((x: { type: string }) => x.type === 'trilha_recusada');
    assert.match(n.body, /Descreva melhor/);
  });

  test('importar: o épico entra numa iniciativa nova ou numa que a pessoa escolhe', async () => {
    const id = (await publish(await makeEpic(author.c))).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    assert.equal((await buyer.c.request('POST', `/trilhas/${id}/import`, {})).status, 400, 'precisa dizer onde');

    const r = await buyer.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(r.status, 201);
    const ini = await api.prisma.initiative.findUniqueOrThrow({ where: { id: r.body.initiativeId }, include: { epics: { include: { tasks: true } } } });
    assert.equal(ini.title, 'Correr mais');
    assert.deepEqual(ini.areas, ['saude']);
    assert.equal(ini.epics[0]!.title, 'Treinos');
    assert.deepEqual(ini.epics[0]!.tasks.map(t => t.title).sort(), ['Semana 1', 'Semana 2']);
    assert.ok(ini.epics[0]!.tasks.every(t => t.status === 'backlog'));

    const mine = (await buyer.c.request('POST', '/initiatives', { title: 'Vida saudável', areas: ['emocional'] })).body;
    const r2 = await buyer.c.request('POST', `/trilhas/${id}/import`, { initiativeId: mine.id });
    assert.equal(r2.body.initiativeId, mine.id);
    const again = await api.prisma.initiative.findUniqueOrThrow({ where: { id: mine.id }, include: { epics: true } });
    assert.equal(again.epics.length, 1);
    assert.deepEqual(again.areas, ['emocional', 'saude'], 'a área do épico entra na iniciativa');

    const other = (await author.c.request('POST', '/initiatives', { title: 'De outra pessoa' })).body;
    assert.equal((await buyer.c.request('POST', `/trilhas/${id}/import`, { initiativeId: other.id })).status, 404);
  });

  test('importar trilha grande (80 tarefas) traz tudo, na ordem, com descrição, áreas e histórico', async () => {
    const ini = (await author.c.request('POST', '/initiatives', { title: 'Artes liberais' })).body;
    const ep = (await author.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Mitologia', area: 'intelectual' })).body;
    const t0 = (await author.c.request('POST', '/tasks', { epicId: ep.id, title: 'Episódio 1' })).body;
    await author.c.request('PATCH', `/tasks/${t0.id}`, { description: 'Ouvir e anotar', areas: ['intelectual', 'espiritualidade'] });
    const rest = Array.from({ length: 79 }, (_, i) => ({ epicId: ep.id, title: `Episódio ${i + 2}` }));
    await api.prisma.task.createMany({ data: rest.map((t, i) => ({ ...t, userId: author.user.id, position: i + 1 })) });
    const id = (await publish(ep.id)).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const r = await buyer.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(r.status, 201);
    const tasks = await api.prisma.task.findMany({ where: { epicId: r.body.epicId }, orderBy: { position: 'asc' }, include: { logs: true } });
    assert.equal(tasks.length, 80);
    assert.equal(tasks[0]!.title, 'Episódio 1');
    assert.equal(tasks[0]!.description, 'Ouvir e anotar');
    assert.deepEqual(tasks[0]!.areas, ['intelectual', 'espiritualidade']);
    assert.equal(tasks[79]!.title, 'Episódio 80');
    assert.ok(tasks.every(t => t.userId === buyer.user.id && t.status === 'backlog' && t.logs.length === 1 && t.logs[0]!.text.startsWith('Importada da trilha')));
  });

  test('importar grátis dá +10 XP ao autor (uma vez por pessoa)', async () => {
    const id = (await publish(await makeEpic(author.c))).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const before = (await author.c.request('GET', '/me')).body.xp.total;
    const r = await buyer.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(r.body.paid, 0);
    assert.equal((await author.c.request('GET', '/me')).body.xp.total, before + 10);
    await buyer.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal((await author.c.request('GET', '/me')).body.xp.total, before + 10, 'importar de novo não dá XP de novo');
    const listed = (await buyer.c.request('GET', `/trilhas/${id}`)).body;
    assert.equal(listed.acquired, true);
    assert.equal(listed.downloads, 1);
  });

  test('trilha paga: recusa sem saldo; com saldo debita só o disponível do comprador; o preço não vai para o autor', async () => {
    const id = (await publish(await makeEpic(author.c), 50)).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const poor = await loginAs(api, 'semxp');
    const r1 = await poor.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(r1.status, 400);
    assert.match(r1.body.message, /Círculos insuficientes/);

    await api.prisma.user.update({ where: { id: buyer.user.id }, data: { xpTotal: 200, gems: 200 } });
    const authorBefore = (await author.c.request('GET', '/me')).body.xp.total;
    const r2 = await buyer.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(r2.body.paid, 50);
    const me = (await buyer.c.request('GET', '/me')).body.xp;
    assert.deepEqual(me, { total: 200, gems: 150 }, 'paga em gemas; o XP não muda');
    const extrato = (await buyer.c.request('GET', '/me/gems')).body;
    assert.equal(extrato[0].reason, 'trilha_compra');
    assert.equal(extrato[0].amount, -50);
    assert.equal((await author.c.request('GET', '/me')).body.xp.total, authorBefore + 10);

    await buyer.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal((await buyer.c.request('GET', '/me')).body.xp.gems, 150, 'importar de novo não cobra de novo');
  });

  test('o autor importa a própria trilha sem pagar nem ganhar XP', async () => {
    const id = (await publish(await makeEpic(author.c), 30)).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    const before = (await author.c.request('GET', '/me')).body.xp;
    const r = await author.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(r.body.paid, 0);
    assert.deepEqual((await author.c.request('GET', '/me')).body.xp, before);
  });

  test('nova versão do mesmo épico fica pendente e a aprovada segue na loja até a nova ser aprovada', async () => {
    const epicId = await makeEpic(author.c, 'Ler mais');
    const v1 = (await publish(epicId)).body.id;
    await admin.c.request('POST', `/trilhas/${v1}/approve`);
    const v2 = (await publish(epicId)).body.id;
    let visible = (await buyer.c.request('GET', '/trilhas')).body.map((t: { id: string }) => t.id);
    assert.ok(visible.includes(v1) && !visible.includes(v2));
    await admin.c.request('POST', `/trilhas/${v2}/approve`);
    visible = (await buyer.c.request('GET', '/trilhas')).body.map((t: { id: string }) => t.id);
    assert.ok(!visible.includes(v1) && visible.includes(v2));
  });

  test('favoritar e tirar da loja', async () => {
    const id = (await publish(await makeEpic(author.c))).body.id;
    await admin.c.request('POST', `/trilhas/${id}/approve`);
    await buyer.c.request('PUT', `/trilhas/${id}/favorite`);
    assert.equal((await buyer.c.request('GET', `/trilhas/${id}`)).body.favorite, true);
    assert.equal((await buyer.c.request('POST', `/trilhas/${id}/unpublish`)).status, 403);
    await author.c.request('POST', `/trilhas/${id}/unpublish`);
    assert.equal((await buyer.c.request('GET', `/trilhas/${id}`)).status, 404);
  });
});

describe('Trilhas dos grupos', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let criadora: Awaited<ReturnType<typeof loginAs>>;
  let membro: Awaited<ReturnType<typeof loginAs>>;
  let outro: Awaited<ReturnType<typeof loginAs>>;
  let fora: Awaited<ReturnType<typeof loginAs>>;
  let groupId: string;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    admin = await loginAs(api, 'adm2', { role: 'admin' });
    criadora = await loginAs(api, 'criadora');
    membro = await loginAs(api, 'membro');
    outro = await loginAs(api, 'outro');
    fora = await loginAs(api, 'fora');
    groupId = (await criadora.c.request('POST', '/groups', { name: 'Corredores', description: 'Treinos de rua', area: 'saude' })).body.id;
    await membro.c.request('POST', `/groups/${groupId}/join`);
    await outro.c.request('POST', `/groups/${groupId}/join`);
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const inGroup = (c: Client, epicId: string) => c.request('POST', `/epics/${epicId}/publish`, { description: 'Plano do grupo para correr junto.', category: 'saude', priceGems: 40, groupId });

  test('gestor publica direto no grupo: grátis, só membros veem, não aparece na loja', async () => {
    const r = await inGroup(criadora.c, await makeEpic(criadora.c));
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'aprovada');
    assert.equal(r.body.priceGems, 0, 'trilha de grupo é sempre grátis');
    assert.equal(r.body.groupId, groupId);
    assert.equal(r.body.canEdit, true);
    const id = r.body.id;
    assert.equal((await fora.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id), false);
    assert.equal((await criadora.c.request('GET', '/trilhas')).body.some((t: { id: string }) => t.id === id), false, 'não vai para a loja');
    assert.equal((await fora.c.request('GET', `/trilhas/${id}`)).status, 404);
    assert.equal((await fora.c.request('POST', `/trilhas/${id}/import`, NEW)).status, 404);
    assert.ok((await membro.c.request('GET', `/groups/${groupId}`)).body.trilhaList.some((t: { id: string }) => t.id === id));
    assert.ok((await membro.c.request('GET', '/notifications')).body.some((n: { type: string }) => n.type === 'grupo_trilha'));
    const imp = await membro.c.request('POST', `/trilhas/${id}/import`, NEW);
    assert.equal(imp.status, 201);
    assert.equal(imp.body.paid, 0);
    assert.equal((await criadora.c.request('GET', '/me')).body.xp.total, 0, 'download no grupo não dá XP');
    assert.equal((await fora.c.request('POST', `/epics/${await makeEpic(fora.c)}/publish`, { description: 'Quero entrar no grupo.', category: 'saude', priceGems: 0, groupId })).status, 403);
  });

  test('membro comum sugere: fica pendente para os gestores, que aprovam ou recusam', async () => {
    const r = await inGroup(membro.c, await makeEpic(membro.c, 'Correr na praia'));
    assert.equal(r.body.status, 'pendente');
    const id = r.body.id;
    let g = (await criadora.c.request('GET', `/groups/${groupId}`)).body;
    assert.ok(g.suggestions.some((t: { id: string }) => t.id === id), 'gestor vê a sugestão');
    assert.ok(!g.trilhaList.some((t: { id: string }) => t.id === id));
    assert.ok((await criadora.c.request('GET', '/notifications')).body.some((n: { type: string }) => n.type === 'grupo_trilha_sugerida'));
    assert.equal((await outro.c.request('GET', `/groups/${groupId}`)).body.suggestions.length, 0, 'outros membros não veem');
    assert.equal((await outro.c.request('GET', `/trilhas/${id}`)).status, 404);
    assert.ok((await membro.c.request('GET', `/groups/${groupId}`)).body.suggestions.some((t: { id: string }) => t.id === id), 'quem sugeriu acompanha');

    assert.equal((await admin.c.request('POST', `/trilhas/${id}/approve`)).status, 403, 'admin do app não aprova trilha de grupo');
    assert.equal((await membro.c.request('POST', `/trilhas/${id}/approve`)).status, 403);
    assert.equal((await criadora.c.request('GET', `/trilhas/${id}`)).body.canReview, true);
    assert.equal((await criadora.c.request('POST', `/trilhas/${id}/approve`)).body.status, 'aprovada');
    g = (await outro.c.request('GET', `/groups/${groupId}`)).body;
    assert.ok(g.trilhaList.some((t: { id: string }) => t.id === id));
    const note = (await membro.c.request('GET', '/notifications')).body.find((n: { type: string }) => n.type === 'trilha_aprovada');
    assert.equal(note.link, `/grupos/${groupId}`);

    const r2 = await inGroup(membro.c, await makeEpic(membro.c, 'Maratona amanhã'));
    await criadora.c.request('POST', `/trilhas/${r2.body.id}/reject`, { reason: 'Muito puxado para iniciantes.' });
    const mine = (await membro.c.request('GET', `/groups/${groupId}`)).body.suggestions.find((t: { id: string }) => t.id === r2.body.id);
    assert.equal(mine.status, 'recusada');
    assert.equal(mine.rejectionReason, 'Muito puxado para iniciantes.');
  });

  test('o criador escolhe os gestores; gestor também aprova', async () => {
    let g = (await criadora.c.request('GET', `/groups/${groupId}`)).body;
    assert.equal(g.canManageGestores, true);
    assert.equal(g.memberList.find((m: { creator: boolean }) => m.creator).id, criadora.user.id);
    assert.equal((await membro.c.request('PUT', `/groups/${groupId}/members/${outro.user.id}/role`, { role: 'admin' })).status, 403);
    g = (await criadora.c.request('PUT', `/groups/${groupId}/members/${membro.user.id}/role`, { role: 'admin' })).body;
    assert.equal(g.memberList.find((m: { id: string }) => m.id === membro.user.id).role, 'admin');
    assert.ok((await membro.c.request('GET', '/notifications')).body.some((n: { type: string }) => n.type === 'grupo_gestor'));
    assert.equal((await membro.c.request('GET', `/groups/${groupId}`)).body.canManageGestores, false, 'gestor não escolhe gestores');
    assert.equal((await criadora.c.request('PUT', `/groups/${groupId}/members/${criadora.user.id}/role`, { role: 'member' })).status, 400, 'criador continua gestor');

    const s = await inGroup(outro.c, await makeEpic(outro.c, 'Correr de manhã'));
    assert.equal((await membro.c.request('POST', `/trilhas/${s.body.id}/approve`)).body.status, 'aprovada');
    await criadora.c.request('PUT', `/groups/${groupId}/members/${membro.user.id}/role`, { role: 'member' });
    assert.equal((await membro.c.request('GET', `/groups/${groupId}`)).body.admin, false);
  });

  test('trazer da loja cria uma cópia do grupo: a da loja não muda e o gestor edita a cópia', async () => {
    const author = await loginAs(api, 'autor-loja');
    const pub = (await author.c.request('POST', `/epics/${await makeEpic(author.c, 'Corrida leve')}/publish`, { description: 'Para quem está começando a correr.', category: 'saude', priceGems: 0 })).body;
    await admin.c.request('POST', `/trilhas/${pub.id}/approve`);

    assert.equal((await membro.c.request('POST', `/groups/${groupId}/trilhas`, { trilhaId: pub.id })).status, 403);
    const g = (await criadora.c.request('POST', `/groups/${groupId}/trilhas`, { trilhaId: pub.id })).body;
    const copy = g.trilhaList.find((t: { copiedFromId: string }) => t.copiedFromId === pub.id);
    assert.ok(copy && copy.id !== pub.id);
    assert.equal((await criadora.c.request('POST', `/groups/${groupId}/trilhas`, { trilhaId: pub.id })).status, 409, 'não duplica');

    assert.equal((await membro.c.request('PATCH', `/trilhas/${copy.id}`, { title: 'Outro' })).status, 403);
    assert.equal((await author.c.request('PATCH', `/trilhas/${pub.id}`, { title: 'Outro' })).status, 404, 'trilha da loja não se edita');
    const ed = (await criadora.c.request('PATCH', `/trilhas/${copy.id}`, { title: 'Corrida leve do grupo', tasks: ['Aquecer', 'Correr 2 km', 'Alongar'] })).body;
    assert.equal(ed.title, 'Corrida leve do grupo');
    assert.deepEqual(ed.tasks, ['Aquecer', 'Correr 2 km', 'Alongar']);
    const orig = (await fora.c.request('GET', `/trilhas/${pub.id}`)).body;
    assert.equal(orig.title, 'Corrida leve');
    assert.deepEqual(orig.tasks, ['Semana 1', 'Semana 2']);

    assert.equal((await criadora.c.request('DELETE', `/groups/${groupId}/trilhas/${copy.id}`)).status, 200);
    assert.equal((await fora.c.request('GET', `/trilhas/${pub.id}`)).status, 200, 'tirar do grupo não mexe na loja');
  });

  test('trilha paga só entra no grupo se o gestor já tem', async () => {
    const author = await loginAs(api, 'autor-pago');
    const pub = (await author.c.request('POST', `/epics/${await makeEpic(author.c)}/publish`, { description: 'Plano pago de corrida.', category: 'saude', priceGems: 20 })).body;
    await admin.c.request('POST', `/trilhas/${pub.id}/approve`);
    const r = await criadora.c.request('POST', `/groups/${groupId}/trilhas`, { trilhaId: pub.id });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /compre na loja/);
  });
});
