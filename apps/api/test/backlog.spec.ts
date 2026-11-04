import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Backlog: iniciativas, épicos e tarefas', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let me: Awaited<ReturnType<typeof loginAs>>;
  let other: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    me = await loginAs(api, 'ana');
    other = await loginAs(api, 'bruno');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  const create = async () => {
    const ini = (await me.c.request('POST', '/initiatives', { title: 'Vida longa', areas: ['saude', 'amor'], isMaster: true })).body;
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Hidratação', area: 'saude' })).body;
    const t1 = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Beber 2 litros', priority: 'alta', dueDate: '2026-12-01' })).body;
    const t2 = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Comprar garrafa', status: 'todo' })).body;
    return { ini, epic, t1, t2 };
  };

  test('cria e lista iniciativa, épico e tarefas', async () => {
    const { ini, epic, t1, t2 } = await create();
    assert.equal(ini.isMaster, true);
    assert.deepEqual(ini.areas, ['saude', 'amor']);
    assert.equal(epic.area, 'saude');
    assert.equal(t1.status, 'backlog');
    assert.equal(t1.dueDate, '2026-12-01');
    assert.equal(t1.priority, 'alta');
    assert.equal(t2.status, 'todo', '"Sprint atual" coloca em A Fazer');
    assert.ok(t2.sprintId, 'tarefa na sprint fica ligada à sprint atual');

    const all = (await me.c.request('GET', '/backlog')).body;
    assert.ok(all.initiatives.some((i: { id: string }) => i.id === ini.id));
    assert.equal(all.tasks.filter((t: { epicId: string }) => t.epicId === epic.id).length, 2);
  });

  test('áreas: épico herda da iniciativa, tarefa herda do épico, sem limite', async () => {
    const ini = (await me.c.request('POST', '/initiatives', { title: 'Áreas', areas: ['saude', 'emocional'] })).body;

    // Épico novo, sem escolher, herda as áreas da iniciativa; a principal é a primeira.
    const epic = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E' })).body;
    assert.deepEqual(epic.areas, ['saude', 'emocional']);
    assert.equal(epic.area, 'saude');

    // Tarefa nova, sem escolher, herda as áreas do épico.
    const t1 = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Padrão' })).body;
    assert.deepEqual(t1.areas, ['saude', 'emocional']);

    // Dá para escolher quantas quiser (até as 10 áreas).
    const todas = ['lazer', 'amor', 'financas', 'familia', 'intelectual', 'espiritualidade', 'sociedade', 'saude', 'emocional', 'profissional'];
    const t2 = (await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Multi', areas: todas })).body;
    assert.deepEqual(t2.areas, todas);

    // Editar troca as áreas; área inválida é recusada.
    const up = (await me.c.request('PATCH', `/tasks/${t1.id}`, { areas: ['emocional', 'familia'] })).body;
    assert.deepEqual(up.areas, ['emocional', 'familia']);
    assert.equal((await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Inválida', areas: ['outros'] })).status, 400);

    // O épico também aceita várias áreas próprias.
    const epic2 = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E2', areas: ['amor', 'lazer', 'financas'] })).body;
    assert.deepEqual(epic2.areas, ['amor', 'lazer', 'financas']);
    assert.equal(epic2.area, 'amor');

    // Duplicar leva as áreas junto.
    const dup = (await me.c.request('POST', `/tasks/${t2.id}/duplicate`)).body;
    assert.deepEqual(dup.areas, todas);
  });

  test('tarefas puxadas para a sprint entram na Sprint 1 (não cria outra)', async () => {
    const sprints = await api.prisma.sprint.findMany({ where: { userId: me.user.id }, include: { tasks: true } });
    assert.equal(sprints.length, 1);
    assert.equal(sprints[0]!.number, 1);
    assert.ok(sprints[0]!.tasks.length > 0);
  });

  test('ninguém vê nem altera o backlog de outra pessoa', async () => {
    const { ini, epic, t1 } = await create();
    const theirs = (await other.c.request('GET', '/backlog')).body;
    assert.equal(theirs.initiatives.length, 0);
    assert.equal((await other.c.request('PATCH', `/initiatives/${ini.id}`, { title: 'x' })).status, 404);
    assert.equal((await other.c.request('DELETE', `/epics/${epic.id}`)).status, 404);
    assert.equal((await other.c.request('POST', `/tasks/${t1.id}/move`, { status: 'done' })).status, 404);
    assert.equal((await other.c.request('POST', '/epics', { initiativeId: ini.id, title: 'invasão', area: 'lazer' })).status, 404);
  });

  test('validação: título vazio e área inválida são recusados', async () => {
    const r1 = await me.c.request('POST', '/initiatives', { title: '' });
    assert.equal(r1.status, 400);
    assert.match(r1.body.message, /nome precisa ter/);
    const ini = (await me.c.request('POST', '/initiatives', { title: 'Ok' })).body;
    const r2 = await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'E', area: 'outros' });
    assert.equal(r2.status, 400);
    assert.match(r2.body.message, /área da vida inválida/);
  });

  test('mover tarefa: histórico, data de conclusão e saída da sprint', async () => {
    const { t1 } = await create();
    let r = (await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'doing' })).body;
    assert.equal(r.task.status, 'doing');
    assert.ok(r.task.sprintId);
    r = (await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'done' })).body;
    assert.ok(r.task.doneAt);
    r = (await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'backlog' })).body;
    assert.equal(r.task.doneAt, null);
    assert.equal(r.task.sprintId, null);
    const logs = await api.prisma.taskLog.findMany({ where: { taskId: t1.id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(
      logs.map(l => l.text),
      ['Tarefa criada', 'Movida de Backlog para Fazendo', 'Movida de Fazendo para Pronto', 'Movida de Pronto para Backlog'],
    );
  });

  test('encerrar épico exige todas as tarefas prontas; reabrir tarefa reabre o épico', async () => {
    const { epic, t1, t2 } = await create();
    const early = await me.c.request('POST', `/epics/${epic.id}/close`);
    assert.equal(early.status, 400);
    assert.match(early.body.message, /todas as tarefas/);

    await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'done' });
    await me.c.request('POST', `/tasks/${t2.id}/move`, { status: 'done' });
    const closed = await me.c.request('POST', `/epics/${epic.id}/close`);
    assert.equal(closed.status, 201);
    assert.ok(closed.body.epic.closedAt);
    assert.equal(closed.body.doneTasks, 2);

    const blocked = await me.c.request('POST', '/tasks', { epicId: epic.id, title: 'Nova' });
    assert.equal(blocked.status, 400, 'não dá para criar tarefa em épico encerrado');

    await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'doing' });
    const e = await api.prisma.epic.findUnique({ where: { id: epic.id } });
    assert.equal(e!.closedAt, null, 'tarefa reaberta reabre o épico');
  });

  test('concluir iniciativa exige todos os épicos encerrados', async () => {
    const { ini, epic, t1, t2 } = await create();
    assert.equal((await me.c.request('POST', `/initiatives/${ini.id}/complete`)).status, 400);
    await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'done' });
    await me.c.request('POST', `/tasks/${t2.id}/move`, { status: 'done' });
    await me.c.request('POST', `/epics/${epic.id}/close`);
    const done = await me.c.request('POST', `/initiatives/${ini.id}/complete`);
    assert.equal(done.status, 201);
    assert.ok(done.body.initiative.completedAt);
    assert.equal(done.body.doneTasks, 2);

    // Um épico novo tira a iniciativa de "concluída".
    await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Mais um', area: 'amor' });
    const i = await api.prisma.initiative.findUnique({ where: { id: ini.id } });
    assert.equal(i!.completedAt, null);
  });

  test('duplicar iniciativa copia épicos e tarefas, tudo de volta ao backlog e com checklist desmarcado', async () => {
    const { ini, t1 } = await create();
    await api.prisma.checklistItem.create({ data: { taskId: t1.id, text: 'item', done: true } });
    await me.c.request('POST', `/tasks/${t1.id}/move`, { status: 'done' });

    const copy = (await me.c.request('POST', `/initiatives/${ini.id}/duplicate`)).body;
    assert.equal(copy.title, 'Vida longa (cópia)');
    assert.equal(copy.source, 'duplicada');
    const tasks = await api.prisma.task.findMany({ where: { epic: { initiativeId: copy.id } }, include: { checklist: true } });
    assert.equal(tasks.length, 2);
    assert.ok(tasks.every(t => t.status === 'backlog' && t.doneAt === null));
    assert.ok(tasks.flatMap(t => t.checklist).every(c => !c.done));
  });

  test('duplicar tarefa e épico', async () => {
    const { epic, t1 } = await create();
    const tc = (await me.c.request('POST', `/tasks/${t1.id}/duplicate`)).body;
    assert.equal(tc.title, 'Beber 2 litros (cópia)');
    assert.equal(tc.epicId, epic.id);
    const ec = (await me.c.request('POST', `/epics/${epic.id}/duplicate`)).body;
    assert.equal(ec.title, 'Hidratação (cópia)');
    assert.equal(await api.prisma.task.count({ where: { epicId: ec.id } }), 3);
  });

  test('excluir iniciativa apaga épicos e tarefas', async () => {
    const { ini, epic, t1 } = await create();
    assert.equal((await me.c.request('DELETE', `/initiatives/${ini.id}`)).status, 204);
    assert.equal(await api.prisma.epic.count({ where: { id: epic.id } }), 0);
    assert.equal(await api.prisma.task.count({ where: { id: t1.id } }), 0);
  });

  test('editar tarefa e trocar de épico', async () => {
    const { ini, t1 } = await create();
    const other = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Outro', area: 'amor' })).body;
    const r = await me.c.request('PATCH', `/tasks/${t1.id}`, { title: 'Beber água', epicId: other.id, dueDate: null, priority: 'baixa' });
    assert.equal(r.status, 200);
    assert.equal(r.body.epicId, other.id);
    assert.equal(r.body.dueDate, null);
    assert.equal(r.body.priority, 'baixa');
  });

  test('reordenar salva a ordem (position) e o reset volta pra zero', async () => {
    const ini = (await me.c.request('POST', '/initiatives', { title: 'Ordenar', areas: ['saude'] })).body;
    const a = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Alfa', area: 'saude' })).body;
    const b = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Beta', area: 'saude' })).body;
    const c = (await me.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Gama', area: 'saude' })).body;
    // Começa tudo em position 0 (o site mostra em ordem alfabética).
    assert.equal(a.position, 0);

    // Nova ordem: c, a, b → position 1, 2, 3.
    const r = await me.c.request('PUT', '/backlog/order', { type: 'epic', ids: [c.id, a.id, b.id] });
    assert.equal(r.status, 200);
    const pos = (id: string) => r.body.epics.find((e: { id: string }) => e.id === id).position;
    assert.equal(pos(c.id), 1);
    assert.equal(pos(a.id), 2);
    assert.equal(pos(b.id), 3);

    // Não reordena itens de outra pessoa.
    assert.equal((await other.c.request('PUT', '/backlog/order', { type: 'epic', ids: [a.id] })).status, 404);

    // Reset volta tudo pra 0.
    const back = await me.c.request('PUT', '/backlog/order', { type: 'epic', ids: [a.id, b.id, c.id], reset: true });
    assert.equal(back.body.epics.find((e: { id: string }) => e.id === c.id).position, 0);
  });
});
