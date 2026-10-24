import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
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

  test('tarefa com prazo vencido gera um aviso só, a partir das 8h; prazo de hoje não', async () => {
    const me = await loginAs(api, 'not3');
    const ini = (await me.c.request('POST', '/initiatives', { title: 'I' })).body;
    const ep = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'lazer' })).body;
    const now = new Date();
    const day = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(now.getTime() + offset * 86400000));
    await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Venceu ontem', dueDate: day(-1) });
    await me.c.request('POST', '/tasks', { epicId: ep.id, title: 'Vence hoje', dueDate: day(0) });

    const svc = api.app.get(NotificationsService);
    const at = (h: number) => {
      const d = new Date(`${day(0)}T${String(h).padStart(2, '0')}:30:00-03:00`);
      return d;
    };
    assert.equal(await svc.checkOverdue(at(6)), 0, 'antes das 8h não avisa');
    assert.ok((await svc.checkOverdue(at(9))) >= 1);
    assert.equal(await svc.checkOverdue(at(10)), 0, 'não repete o aviso');
    const mine = (await me.c.request('GET', '/notifications')).body;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].type, 'tarefa_atrasada');
    assert.match(mine[0].body, /Venceu ontem/);
  });

  test('sem chaves VAPID, o push fica desligado', async () => {
    const { c } = await loginAs(api, 'not4');
    assert.deepEqual((await c.request('GET', '/push/public-key')).body, { key: null });
  });
});
