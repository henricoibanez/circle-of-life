import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { AREA_IDS, MASLOW_ITEM_KEYS, STARTER_TRILHA_ID } from '@circle/shared';
import { loginAs, startApi } from './helpers';

type Client = Awaited<ReturnType<typeof loginAs>>;

describe('Jornada de primeiro acesso', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const novato = async (handle: string) => {
    const me = await loginAs(api, handle, { sprint: 'planejamento' });
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journey: true } });
    return me;
  };
  const journey = async (me: Client) => (await me.c.request('GET', '/journey')).body;
  const done = async (me: Client) => ((await journey(me)).phases as { id: string; done: boolean }[]).filter(p => p.done).map(p => p.id);
  const xp = async (me: Client) => (await me.c.request('GET', '/me')).body.xp;

  const roda = (me: Client) => me.c.request('PUT', '/roda/scores', { scores: Object.fromEntries(AREA_IDS.map(a => [a, 7])) });
  const maslow = (me: Client) => me.c.request('PUT', `/maslow/checks/${MASLOW_ITEM_KEYS[0]}`, { checked: true });
  const quadro = (me: Client) => me.c.request('POST', '/dreams', { text: 'Conhecer o Japão', area: 'lazer' });
  const necro = (me: Client) => me.c.request('PUT', '/necrologio', { html: `<p>${'Quem eu fui. '.repeat(10)}</p>` });
  const backlog = async (me: Client) => {
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E' })).body;
    return (await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'T' })).body.id as string;
  };
  /** Pessoa na Jornada com as 6 primeiras fases feitas (sprint iniciada). */
  const ateASprint = async (handle: string) => {
    const me = await novato(handle);
    await roda(me);
    await maslow(me);
    await quadro(me);
    await necro(me);
    const t = await backlog(me);
    await me.c.request('POST', `/tasks/${t}/move`, { status: 'todo' });
    assert.equal((await me.c.request('POST', '/sprints/current/start', {})).status, 201);
    return { me, task: t };
  };

  test('quem já usa o app (sem Jornada) não tem trava e ganha XP normalmente', async () => {
    const me = await loginAs(api, 'antiga');
    const j = await journey(me);
    assert.equal(j.active, false);
    assert.equal(j.social.open, true);
    const t = await backlog(me);
    assert.equal((await me.c.request('POST', `/tasks/${t}/move`, { status: 'done' })).body.xp.gained, 10);
  });

  test('as fases contam em ordem: a seguinte só vale depois da anterior', async () => {
    const me = await novato('ordem');
    // Maslow e quadro feitos antes da Roda não contam ainda.
    await maslow(me);
    await quadro(me);
    assert.deepEqual(await done(me), []);
    // Roda: precisa das 10 áreas com nota.
    await me.c.request('PUT', '/roda/scores', { scores: { lazer: 5, saude: 6 } });
    assert.equal((await journey(me)).detail.rodaAreas, 2);
    assert.deepEqual(await done(me), []);
    await roda(me);
    assert.deepEqual(await done(me), ['roda', 'maslow', 'quadro']);
    assert.equal((await journey(me)).current, 'necrologio');
  });

  test('Minha vida incompleta: backlog livre, quadro e sprint trancados; completa, destranca', async () => {
    const me = await novato('trava');
    const t = await backlog(me);
    const puxar = await me.c.request('POST', `/tasks/${t}/move`, { status: 'todo' });
    assert.equal(puxar.status, 403);
    assert.match(puxar.body.message, /Minha vida/);
    assert.equal((await me.c.request('POST', '/sprints/current/start', {})).status, 403);

    await roda(me);
    await maslow(me);
    await quadro(me);
    await me.c.request('PUT', '/necrologio', { html: `<h1>${'a'.repeat(60)}</h1>` });
    assert.equal((await journey(me)).detail.necroChars, 60);
    await necro(me);
    // A fase do backlog só conta com 1 tarefa enviada para a sprint.
    assert.equal((await journey(me)).current, 'backlog');
    assert.equal((await me.c.request('POST', `/tasks/${t}/move`, { status: 'todo' })).status, 201);
    assert.equal((await journey(me)).current, 'sprint');
    assert.equal((await me.c.request('POST', '/sprints/current/start', {})).status, 201);
    assert.equal((await journey(me)).current, 'concluir');
  });

  test('durante a Jornada nada rende XP (roda, sonho, tarefa)', async () => {
    const { me, task } = await ateASprint('semxp');
    await me.c.request('POST', '/roda/snapshots');
    const dream = (await me.c.request('GET', '/dreams')).body[0];
    assert.equal((await me.c.request('POST', `/dreams/${dream.id}/realize`)).body.xp.gained, 0);
    assert.equal((await me.c.request('POST', `/tasks/${task}/move`, { status: 'done' })).body.xp.gained, 0);
    assert.equal((await xp(me)).total, 0);
  });

  test('pop-ups de parabéns: guarda até qual fase já apareceu', async () => {
    const me = await novato('parabens');
    assert.equal((await journey(me)).phaseSeen, 0);
    assert.equal((await me.c.request('POST', '/journey/seen', { phase: 2 })).status, 204);
    await me.c.request('POST', '/journey/seen', { phase: 1 });
    assert.equal((await journey(me)).phaseSeen, 2, 'não volta para trás');
    assert.equal((await me.c.request('POST', '/journey/seen', { phase: 99 })).status, 400);
  });

  test('"Concluir minha jornada": prêmio de 1.000 XP uma vez; depois o XP volta ao normal', async () => {
    const early = await novato('cedo');
    assert.equal((await early.c.request('POST', '/journey/finish')).status, 400, 'sem as etapas anteriores, não conclui');

    const { me } = await ateASprint('concluiu');
    const r = await me.c.request('POST', '/journey/finish');
    assert.equal(r.status, 201);
    assert.equal(r.body.xp.gained, 1000);
    assert.equal(r.body.xp.total, 1000);
    assert.ok(r.body.social.freeAt, 'começou a contar os 7 dias');
    assert.equal(r.body.social.open, false);
    assert.equal((await me.c.request('POST', '/journey/finish')).status, 400, 'uma vez só');
    assert.equal((await me.c.request('GET', '/me')).body.journeyFinished, true);

    // A pontuação normal volta: uma tarefa nova concluída rende +10.
    const ep = (await me.c.request('GET', '/backlog')).body.epics[0];
    const t = (await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Nova', status: 'todo' })).body.id;
    assert.equal((await me.c.request('POST', `/tasks/${t}/move`, { status: 'done' })).body.xp.gained, 10);
  });

  test('rede social: trancada até liberar por 500 XP; troféu e conquista em todas as áreas', async () => {
    const { me } = await ateASprint('pagou');
    assert.equal((await me.c.request('GET', '/feed')).status, 403);
    assert.equal((await me.c.request('GET', '/groups')).status, 403);
    assert.equal((await me.c.request('POST', '/journey/social/unlock')).status, 400, 'antes de concluir a Jornada não dá');
    await me.c.request('POST', '/journey/finish');
    assert.equal((await me.c.request('GET', '/feed')).status, 403, 'concluir não abre a rede sozinho');

    const r = await me.c.request('POST', '/journey/social/unlock');
    assert.equal(r.status, 201);
    assert.equal(r.body.paid, 500);
    assert.equal(r.body.xp.disponivel, 500);
    assert.equal(r.body.xp.total, 1000, 'gastar não tira do total');
    assert.equal((await me.c.request('GET', '/feed')).status, 200);
    assert.equal((await me.c.request('POST', '/journey/social/unlock')).status, 400, 'já liberado');

    const conq = (await me.c.request('GET', '/conquistas')).body;
    assert.ok(conq.journeyDoneAt);
    assert.equal(conq.areas.every((a: { journey: number }) => a.journey === 1), true);
    assert.equal((await me.c.request('GET', '/me')).body.journeyCelebrated, false);
    assert.equal((await me.c.request('POST', '/journey/celebrated')).status, 204);
    assert.equal((await me.c.request('GET', '/me')).body.journeyCelebrated, true);
  });

  test('depois de 7 dias, libera de graça e mantém os 1.000 XP', async () => {
    const { me } = await ateASprint('esperou');
    await me.c.request('POST', '/journey/finish');
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journeyFinishedAt: new Date(Date.now() - 8 * 86_400_000) } });
    const r = await me.c.request('POST', '/journey/social/unlock');
    assert.equal(r.status, 201);
    assert.equal(r.body.paid, 0);
    assert.equal(r.body.xp.disponivel, 1000);
    assert.equal((await me.c.request('GET', '/feed')).status, 200);
  });

  test('loja na Jornada: só a "Primeiros passos" abre; as outras liberam com a Jornada', async () => {
    const autor = await loginAs(api, 'autora');
    const other = await api.prisma.trilha.create({
      data: { rootId: 'tmp', authorId: autor.user.id, title: 'Outra', description: '', category: 'pessoal', area: 'lazer', areas: ['lazer'], status: 'aprovada', tasks: { create: [{ title: 'X', position: 0 }] } },
    });
    await api.prisma.trilha.update({ where: { id: other.id }, data: { rootId: other.id } });

    const { me } = await ateASprint('lojista');
    await me.c.request('POST', '/journey/finish');
    assert.equal((await me.c.request('GET', `/trilhas/${STARTER_TRILHA_ID}`)).status, 200);
    const fechada = await me.c.request('GET', `/trilhas/${other.id}`);
    assert.equal(fechada.status, 403);
    assert.match(fechada.body.message, /Jornada/);
    assert.equal((await me.c.request('POST', `/trilhas/${other.id}/import`, { newInitiative: 'X' })).status, 403);
    assert.ok(((await me.c.request('GET', '/trilhas')).body as { id: string }[]).some(t => t.id === other.id), 'aparece na lista (borrada na tela)');

    await me.c.request('POST', '/journey/social/unlock');
    assert.equal((await me.c.request('GET', `/trilhas/${other.id}`)).status, 200);
  });

  test('trilha recomendada "Primeiros passos": uma tarefa por área, com descrição', async () => {
    const me = await novato('trilheira');
    const t = (await me.c.request('GET', `/trilhas/${STARTER_TRILHA_ID}`)).body;
    assert.equal(t.title, 'Primeiros passos');
    assert.equal(t.tasks.length, 10);
    assert.equal((await me.c.request('POST', `/trilhas/${STARTER_TRILHA_ID}/import`, { newInitiative: 'Começar bem' })).status, 201);
    const b = (await me.c.request('GET', '/backlog')).body;
    assert.equal(b.tasks.length, 10);
    const dinheiro = b.tasks.find((x: { title: string }) => x.title.startsWith('Criar uma caixinha'));
    assert.deepEqual(dinheiro.areas, ['financas']);
    assert.match(dinheiro.description, /Quadro de visualização/);
    assert.deepEqual((await journey(me)).detail.backlog, { initiative: true, epic: true, task: true, inSprint: false });
  });

  test('boas-vindas: marca como vista', async () => {
    const me = await novato('boasvindas');
    assert.equal((await journey(me)).welcomed, false);
    assert.equal((await me.c.request('POST', '/journey/welcome')).status, 204);
    assert.equal((await journey(me)).welcomed, true);
  });
});
