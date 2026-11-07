import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { inQuietHours } from '@circle/shared';
import { NotificationsService } from '../src/notifications/notifications.service';
import { loginAs, startApi } from './helpers';

describe('Notificações (sino) e aviso de tarefas atrasadas', () => {
  let api: Awaited<ReturnType<typeof startApi>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', OVERDUE_HOUR: '8' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('listar, contar não lidas, marcar como lida/não lida, ler todas, apagar e limpar', async () => {
    const me = await loginAs(api, 'not1');
    const other = await loginAs(api, 'not2');
    const svc = api.app.get(NotificationsService);
    await svc.notify({ userId: me.user.id, type: 'curtida', title: 'Curtiram seu post', link: '/feed', actorId: other.user.id });
    await svc.notify({ userId: me.user.id, type: 'comentario', title: 'Comentaram', link: '/feed', actorId: other.user.id });
    assert.equal(await svc.notify({ userId: me.user.id, type: 'curtida', title: 'Eu mesmo', link: '/feed', actorId: me.user.id }), null, 'não notifica a própria ação');

    let list = (await me.c.request('GET', '/notifications')).body;
    assert.equal(list.length, 2);
    assert.equal(list[0].actorName, 'not2');
    assert.equal((await me.c.request('GET', '/notifications/unread-count')).body.count, 2);

    await me.c.request('POST', `/notifications/${list[0].id}/read`);
    assert.equal((await me.c.request('GET', '/notifications/unread-count')).body.count, 1);
    await me.c.request('POST', `/notifications/${list[0].id}/unread`);
    await me.c.request('POST', '/notifications/read-all');
    assert.equal((await me.c.request('GET', '/notifications/unread-count')).body.count, 0);

    assert.equal((await other.c.request('DELETE', `/notifications/${list[0].id}`)).status, 204);
    assert.equal((await me.c.request('GET', '/notifications')).body.length, 2, 'outra pessoa não apaga as minhas');
    await me.c.request('DELETE', `/notifications/${list[0].id}`);
    list = (await me.c.request('GET', '/notifications')).body;
    assert.equal(list.length, 1);
    await me.c.request('DELETE', '/notifications');
    assert.equal((await me.c.request('GET', '/notifications')).body.length, 0);
  });

  test('tarefas atrasadas viram um resumo por dia, a partir das 8h; prazo de hoje não conta', async () => {
    const me = await loginAs(api, 'not3');
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const now = new Date();
    const day = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(now.getTime() + offset * 86400000));
    const t1 = (await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Venceu ontem', dueDate: day(-1) })).body;
    await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Venceu anteontem', dueDate: day(-2) });
    await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Vence hoje', dueDate: day(0) });

    const svc = api.app.get(NotificationsService);
    const at = (h: number, offset = 0) => new Date(`${day(offset)}T${String(h).padStart(2, '0')}:30:00-03:00`);
    const mine = async () => (await me.c.request('GET', '/notifications')).body;
    assert.equal(await svc.checkOverdue(at(6)), 0, 'antes das 8h não avisa');
    assert.equal(await svc.checkOverdue(at(9)), 1);
    assert.equal(await svc.checkOverdue(at(10)), 0, 'não repete no mesmo dia');
    let list = await mine();
    assert.equal(list.length, 1, 'um aviso só para as duas atrasadas');
    assert.equal(list[0].type, 'tarefas_atrasadas');
    assert.match(list[0].body, /2 tarefas atrasadas/);

    assert.equal(await svc.checkOverdue(at(9, 1)), 1, 'no dia seguinte, a que vencia hoje entra num resumo novo');
    list = await mine();
    assert.match(list[0].body, /3 tarefas atrasadas/);
    assert.equal(await svc.checkOverdue(at(9, 2)), 0, 'sem atrasada nova, não avisa');
    // Mudar o prazo permite um novo resumo.
    await me.c.request('PATCH', `/tasks/${t1.id}`, { dueDate: day(-1) });
    assert.equal(await svc.checkOverdue(at(9, 2)), 1);
    assert.equal((await mine()).length, 3);
  });

  test('preferências: padrão, validação e categoria desligada não chega ao sino', async () => {
    const me = await loginAs(api, 'not5');
    const other = await loginAs(api, 'not6');
    assert.deepEqual((await me.c.request('GET', '/notifications/prefs')).body, { volume: 'normal', quietStart: 22, quietEnd: 8, offBell: [], offPush: [], askPush: true });
    assert.equal((await me.c.request('PUT', '/notifications/prefs', { volume: 'muito' })).status, 400);
    assert.equal((await me.c.request('PUT', '/notifications/prefs', { quietStart: 24 })).status, 400);
    assert.equal((await me.c.request('PUT', '/notifications/prefs', { offBell: ['nada'] })).status, 400);
    const saved = (await me.c.request('PUT', '/notifications/prefs', { offBell: ['atividade'], quietStart: 23 })).body;
    assert.deepEqual(saved, { volume: 'normal', quietStart: 23, quietEnd: 8, offBell: ['atividade'], offPush: [], askPush: true });

    const svc = api.app.get(NotificationsService);
    assert.equal(await svc.notify({ userId: me.user.id, type: 'curtida', title: 'Curtiram', link: '/feed', actorId: other.user.id }), null);
    assert.ok(await svc.notify({ userId: me.user.id, type: 'sprint_iniciada', title: 'Sprint', link: '/board' }), 'alertas continuam ligados');
  });

  test('avisos automáticos: limite por dia e por semana, sem repetir a mesma chave', async () => {
    const me = await loginAs(api, 'not7');
    await me.c.request('PUT', '/notifications/prefs', { volume: 'pouco' }); // 1 por dia, 3 por semana
    const svc = api.app.get(NotificationsService);
    // 09/11/2026 é uma segunda-feira.
    const at = (d: string) => new Date(`${d}T09:00:00-03:00`);
    const send = (key: string, d: string) => svc.notifyScheduled({ userId: me.user.id, type: 'tarefas_atrasadas', title: key, link: '/board', key }, at(d));
    assert.ok(await send('a', '2026-11-09'));
    assert.equal(await send('b', '2026-11-09'), null, 'passou do limite do dia');
    assert.equal(await send('a', '2026-11-10'), null, 'a mesma chave não sai de novo');
    assert.ok(await send('b', '2026-11-10'));
    assert.ok(await send('c', '2026-11-11'));
    assert.equal(await send('d', '2026-11-12'), null, 'passou do limite da semana');
    assert.ok(await send('d', '2026-11-16'), 'na semana seguinte volta');
    await me.c.request('DELETE', '/notifications');
    assert.equal(await send('a', '2026-11-17'), null, 'limpar o sino não libera a repetição');
  });

  test('alertas de épico: vazio e concluído sem próximo passo, um por dia', async () => {
    const me = await loginAs(api, 'not9');
    const svc = api.app.get(NotificationsService);
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const vazio = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Aprender inglês', area: 'intelectual' })).body;
    const feito = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Comprar uma casa', area: 'financas' })).body;
    const recente = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Recém-criado', area: 'lazer' })).body;
    const task = (await me.c.request('POST', '/tasks', { epicId: feito.id, title: 'Visitar imóveis' })).body;
    const ago = (d: number) => new Date(Date.now() - d * 86_400_000);
    await api.prisma.epic.update({ where: { id: vazio.id }, data: { createdAt: ago(10) } });
    await api.prisma.epic.update({ where: { id: feito.id }, data: { createdAt: ago(9) } });
    await api.prisma.task.update({ where: { id: task.id }, data: { status: 'done', createdAt: ago(9), doneAt: ago(4) } });
    // Épico com tarefa em aberto: nunca avisa.
    await me.c.request('POST', '/tasks', { epicId: recente.id, title: 'Em aberto' });

    const day = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + offset * 86_400_000));
    const at = (h: number, offset = 0) => new Date(`${day(offset)}T${String(h).padStart(2, '0')}:30:00-03:00`);
    const mine = async () => (await me.c.request('GET', '/notifications')).body as { type: string; body: string; link: string }[];

    assert.equal(await svc.checkEpics(at(6)), 0, 'antes das 8h não avisa');
    assert.equal(await svc.checkEpics(at(9)), 1);
    assert.equal(await svc.checkEpics(at(10)), 0, 'um alerta de épico por dia');
    let list = await mine();
    assert.equal(list[0]!.type, 'epico_vazio');
    assert.match(list[0]!.body, /Aprender inglês/);
    assert.equal(list[0]!.link, `/backlog?epico=${vazio.id}`);

    assert.equal(await svc.checkEpics(at(9, 1)), 1, 'no dia seguinte, o outro épico');
    list = await mine();
    assert.equal(list[0]!.type, 'epico_sem_proximo');
    assert.match(list[0]!.body, /Comprar uma casa/);
    assert.equal(await svc.checkEpics(at(9, 2)), 0, 'nenhum dos dois se repete');

    // Tarefa nova concluída: só volta a avisar depois de 3 dias parado e 14 desde o último aviso.
    const t2 = (await me.c.request('POST', '/tasks', { epicId: feito.id, title: 'Assinar contrato' })).body;
    await api.prisma.task.update({ where: { id: t2.id }, data: { status: 'done', createdAt: ago(9), doneAt: ago(5) } });
    assert.equal(await svc.checkEpics(at(9, 3)), 0, 'menos de 14 dias desde o último aviso');
    assert.equal(await svc.checkEpics(at(9, 16)), 1);
  });

  test('durante a Jornada não sai aviso automático', async () => {
    const me = await loginAs(api, 'not8');
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journey: true } });
    const svc = api.app.get(NotificationsService);
    assert.equal(await svc.notifyScheduled({ userId: me.user.id, type: 'tarefas_atrasadas', title: 'x', link: '/board', key: 'j1' }), null);
    await api.prisma.user.update({ where: { id: me.user.id }, data: { journeyFinishedAt: new Date() } });
    assert.ok(await svc.notifyScheduled({ userId: me.user.id, type: 'tarefas_atrasadas', title: 'x', link: '/board', key: 'j1' }));
  });

  test('horário de silêncio (das 22h às 8h por padrão)', () => {
    assert.equal(inQuietHours(23, 22, 8), true);
    assert.equal(inQuietHours(7, 22, 8), true);
    assert.equal(inQuietHours(8, 22, 8), false);
    assert.equal(inQuietHours(21, 22, 8), false);
    assert.equal(inQuietHours(13, 12, 14), true);
    assert.equal(inQuietHours(10, 9, 9), false, 'início igual ao fim = sem silêncio');
  });

  test('sem chaves VAPID, o push fica desligado', async () => {
    const { c } = await loginAs(api, 'not4');
    assert.deepEqual((await c.request('GET', '/push/public-key')).body, { key: null });
  });
});
