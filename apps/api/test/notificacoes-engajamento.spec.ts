import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { GEMS } from '@circle/shared';
import { EngagementService } from '../src/notifications/engagement.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { loginAs, startApi } from './helpers';

const DAY = 86_400_000;
const SP = 'America/Sao_Paulo';
const day = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: SP }).format(new Date(Date.now() + offset * DAY));
/** Hoje (ou outro dia) às 9h30 de Brasília. */
const at = (offset = 0, h = 9) => new Date(`${day(offset)}T${String(h).padStart(2, '0')}:30:00-03:00`);
const ago = (d: number) => new Date(Date.now() - d * DAY);

describe('Notificações: dicas, Jornada, lembranças, novidades e pesquisas', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let eng: EngagementService;
  let svc: NotificationsService;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', OVERDUE_HOUR: '8' });
    eng = api.app.get(EngagementService);
    svc = api.app.get(NotificationsService);
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const person = (id: string) =>
    api.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, timezone: true, journey: true, journeyFinishedAt: true, socialUnlockedAt: true, createdAt: true },
    });
  const bell = async (c: Awaited<ReturnType<typeof loginAs>>['c']) => (await c.request('GET', '/notifications')).body as any[];

  test('Jornada parada: só durante a Jornada, lembra o próximo passo, uma vez por marco', async () => {
    const me = await loginAs(api, 'eng1', { sprint: 'planejamento' });
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journey: true, createdAt: ago(3) } });
    assert.equal(await eng.journeyStall(await person(me.user.id), at()), true);
    assert.equal(await eng.journeyStall(await person(me.user.id), at()), false, 'não repete no mesmo marco');
    const [n] = await bell(me.c);
    assert.equal(n.type, 'jornada_parada');
    assert.match(n.body, /Roda da Vida/);
    assert.equal(n.link, '/jornada');
    // Durante a Jornada, nenhuma dica nem lembrança.
    assert.equal(await eng.comeback(await person(me.user.id), at()), false);
    // Fora da Jornada, o aviso da Jornada não sai.
    const out = await loginAs(api, 'eng1b');
    assert.equal(await svc.notifyScheduled({ userId: out.user.id, type: 'jornada_parada', title: 'x', link: '/jornada', key: 'j' }), null);
  });

  test('volte ao app: 3 dias sem abrir; e só uma dica por dia', async () => {
    const me = await loginAs(api, 'eng2');
    await api.prisma.userLoginDay.create({ data: { userId: me.user.id, day: day(-4) } });
    await api.prisma.user.update({ where: { id: me.user.id }, data: { createdAt: ago(60) } });
    const u = await person(me.user.id);
    assert.equal(await eng.comeback(u, at()), true);
    assert.equal(await eng.comeback(u, at()), false, 'não repete');
    assert.equal(await eng.areaIdle(u, at()), false, 'no máximo uma dica por dia');
    assert.equal((await bell(me.c))[0].type, 'volte_ao_app');
    // No dia seguinte, outra dica pode sair.
    assert.equal(await eng.areaIdle(u, at(1)), true);
  });

  test('área parada: escolhe a área sem atividade de nota mais baixa e leva ao backlog filtrado', async () => {
    const me = await loginAs(api, 'eng3');
    await api.prisma.user.update({ where: { id: me.user.id }, data: { createdAt: ago(60) } });
    await api.prisma.rodaScore.createMany({
      data: [
        { userId: me.user.id, area: 'financas', score: 2 },
        { userId: me.user.id, area: 'saude', score: 1 },
      ],
    });
    // Saúde tem atividade recente: não entra.
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I', areas: ['saude'] })).body;
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'saude' })).body;
    await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Correr' });
    assert.equal(await eng.areaIdle(await person(me.user.id), at()), true);
    const [n] = await bell(me.c);
    assert.equal(n.type, 'area_parada');
    assert.match(n.body, /vida financeira/);
    assert.equal(n.link, '/backlog?area=financas');
    assert.equal(await eng.areaIdle(await person(me.user.id), at(3)), false, 'só volta depois de 14 dias');
  });

  test('grupo sugerido e "algo bom" só com a rede social aberta', async () => {
    const me = await loginAs(api, 'eng4');
    const dono = await loginAs(api, 'eng4dono');
    const g = await api.prisma.group.create({
      data: { name: 'Finanças em dia', description: 'x', area: 'financas', members: { create: { userId: dono.user.id, role: 'admin' } } },
    });
    // Grupo privado nunca é sugerido.
    await api.prisma.group.create({ data: { name: 'Fechado', description: 'x', area: 'financas', private: true } });
    // Rede trancada (concluiu a Jornada, mas ainda não liberou): nada social.
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journey: true, journeyFinishedAt: new Date() } });
    assert.equal(await eng.groupTip(await person(me.user.id), at()), false);
    assert.equal(await eng.goodThing(await person(me.user.id), at()), false);
    await api.prisma.user.update({ where: { id: me.user.id }, data: { socialUnlockedAt: new Date() } });
    assert.equal(await eng.groupTip(await person(me.user.id), at()), true);
    const [n] = await bell(me.c);
    assert.equal(n.type, 'grupo_sugerido');
    assert.equal(n.link, `/grupos/${g.id}`);
    assert.match(n.body, /Finanças em dia/);
    assert.equal(await eng.goodThing(await person(me.user.id), at(1)), true);
    assert.equal((await bell(me.c))[0].link, '/feed?novo=post');
  });

  test('"Lembra disso?": conquista de 30 dias ou mais, uma por semana, só da própria pessoa', async () => {
    const me = await loginAs(api, 'eng5');
    const other = await loginAs(api, 'eng5b');
    const ini = (await me.c.request('POST', '/initiatives', { title: 'Vida longa' })).body;
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Correr', area: 'saude' })).body;
    const t = (await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Correr 5 km' })).body;
    const nova = (await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Recente' })).body;
    await api.prisma.task.update({ where: { id: t.id }, data: { status: 'done', doneAt: ago(95) } });
    await api.prisma.task.update({ where: { id: nova.id }, data: { status: 'done', doneAt: ago(5) } });
    assert.equal(await eng.memory(await person(me.user.id), at()), true);
    assert.equal(await eng.memory(await person(me.user.id), at(2)), false, 'uma por semana');
    const [n] = await bell(me.c);
    assert.equal(n.type, 'lembranca');
    assert.match(n.body, /^Há 3 meses você concluiu “Correr 5 km”\.$/);
    assert.equal(n.link, `/lembranca?tipo=task&id=${t.id}`);
    const m = (await me.c.request('GET', `/memories/task/${t.id}`)).body;
    assert.equal(m.title, 'Correr 5 km');
    assert.equal(m.epic, 'Correr');
    assert.equal(m.initiative, 'Vida longa');
    assert.equal((await other.c.request('GET', `/memories/task/${t.id}`)).status, 404, 'de outra pessoa não abre');
    // A mesma conquista não volta; sem outra antiga, nada sai.
    assert.equal(await eng.memory(await person(me.user.id), at(8)), false);
  });

  test('novidades: só admin publica; vão para quem está fora da Jornada; não contam no limite', async () => {
    const adm = await loginAs(api, 'eng6adm', { role: 'admin' });
    const fora = await loginAs(api, 'eng6fora');
    const jornada = await loginAs(api, 'eng6jornada');
    await api.prisma.user.update({ where: { id: jornada.user.id }, data: { journey: true } });
    const body = { version: '1.4', title: 'Notificações mais inteligentes', body: 'Agora o app avisa menos.\n\n- Resumo das atrasadas\n- Silêncio à noite' };
    assert.equal((await fora.c.request('POST', '/admin/releases', body)).status, 403);
    assert.equal((await adm.c.request('POST', '/admin/releases', { ...body, version: '' })).status, 400);
    const r = (await adm.c.request('POST', '/admin/releases', body)).body;
    assert.equal(r.publishedAt, null);
    assert.equal((await fora.c.request('GET', `/releases/${r.id}`)).status, 404, 'rascunho não aparece');
    const pub = (await adm.c.request('POST', `/admin/releases/${r.id}/publish`)).body;
    assert.ok(pub.notified >= 2);
    assert.equal((await adm.c.request('POST', `/admin/releases/${r.id}/publish`)).status, 400, 'não publica duas vezes');
    assert.equal((await adm.c.request('PATCH', `/admin/releases/${r.id}`, body)).status, 400, 'publicada não muda');
    const [n] = await bell(fora.c);
    assert.equal(n.type, 'novidade');
    assert.equal(n.title, 'Novidades da versão 1.4');
    assert.equal(n.link, `/novidades/${r.id}`);
    assert.equal((await fora.c.request('GET', `/releases/${r.id}`)).body.title, body.title);
    assert.equal((await bell(jornada.c)).length, 0, 'quem está na Jornada não recebe');
    // Não conta no limite: o lembrete do dia ainda sai (volume Pouco = 1 por dia).
    await fora.c.request('PUT', '/notifications/prefs', { volume: 'pouco' });
    assert.ok(await svc.notifyScheduled({ userId: fora.user.id, type: 'tarefas_atrasadas', title: 'x', link: '/board', key: 'k1' }));
  });

  test('pesquisa: responder no sino rende círculos uma vez; uma pesquisa a cada 30 dias por pessoa', async () => {
    const adm = await loginAs(api, 'eng7adm', { role: 'admin' });
    const me = await loginAs(api, 'eng7');
    const s = (await adm.c.request('POST', '/admin/surveys', { question: 'O que está achando do app?' })).body;
    assert.equal((await me.c.request('GET', `/surveys/${s.id}`)).status, 404, 'rascunho');
    const pub = (await adm.c.request('POST', `/admin/surveys/${s.id}/publish`)).body;
    assert.ok(pub.sent >= 1);
    let [n] = await bell(me.c);
    assert.equal(n.type, 'pesquisa');
    assert.deepEqual(n.survey, { id: s.id, question: 'O que está achando do app?', open: true, answer: null });

    assert.equal((await me.c.request('POST', `/surveys/${s.id}/answer`, { score: 6 })).status, 400);
    const gemsBefore = (await api.prisma.user.findUniqueOrThrow({ where: { id: me.user.id } })).gems;
    const r1 = (await me.c.request('POST', `/surveys/${s.id}/answer`, { score: 4 })).body;
    assert.equal(r1.gemsGained, GEMS.pesquisa);
    const r2 = (await me.c.request('POST', `/surveys/${s.id}/answer`, { score: 5, comment: 'Gostei muito' })).body;
    assert.equal(r2.gemsGained, 0, 'círculos só uma vez');
    assert.deepEqual(r2.survey.answer, { score: 5, comment: 'Gostei muito' });
    assert.equal((await api.prisma.user.findUniqueOrThrow({ where: { id: me.user.id } })).gems, gemsBefore + GEMS.pesquisa);
    [n] = await bell(me.c);
    assert.deepEqual(n.survey.answer, { score: 5, comment: 'Gostei muito' });

    // Outra pesquisa logo em seguida não chega para quem recebeu uma nos últimos 30 dias.
    const s2 = (await adm.c.request('POST', '/admin/surveys', { question: 'E a Jornada?' })).body;
    await adm.c.request('POST', `/admin/surveys/${s2.id}/publish`);
    assert.equal((await me.c.request('GET', `/surveys/${s2.id}`)).status, 404, 'não recebeu, não responde');

    await adm.c.request('POST', `/admin/surveys/${s.id}/close`);
    assert.equal((await me.c.request('POST', `/surveys/${s.id}/answer`, { score: 3 })).status, 400, 'encerrada');
    const res = ((await adm.c.request('GET', '/admin/surveys')).body as any[]).find(x => x.id === s.id);
    assert.equal(res.responses, 1);
    assert.equal(res.average, 5);
    assert.deepEqual(res.counts, [0, 0, 0, 0, 1]);
    assert.equal(res.comments[0].comment, 'Gostei muito');
    assert.equal((await me.c.request('GET', '/admin/surveys')).status, 403);
  });

  test('convite para ligar o celular: não aparece na Jornada; "Agora não" esconde', async () => {
    const me = await loginAs(api, 'eng8');
    assert.equal((await me.c.request('GET', '/notifications/prefs')).body.askPush, true);
    assert.equal((await me.c.request('POST', '/notifications/push-ask/dismiss')).status, 204);
    assert.equal((await me.c.request('GET', '/notifications/prefs')).body.askPush, false);
    const j = await loginAs(api, 'eng8j');
    await api.prisma.user.update({ where: { id: j.user.id }, data: { journey: true } });
    assert.equal((await j.c.request('GET', '/notifications/prefs')).body.askPush, false);
  });
});
