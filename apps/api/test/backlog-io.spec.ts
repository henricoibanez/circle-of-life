import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

const row = (o: Partial<Record<string, string>>) => ({
  area: '',
  iniciativa: '',
  iniciativaDescricao: '',
  epico: '',
  epicoDescricao: '',
  tarefa: '',
  tarefaDescricao: '',
  previsao: '',
  status: '',
  prioridade: '',
  master: '',
  ...o,
});

// Igual ao que o app antigo exporta: iniciativas, depois épicos, depois tarefas.
const OLD = [
  row({ area: 'intelecto', iniciativa: 'Estudo das Artes Liberais', iniciativaDescricao: 'Ser um homem eloquente' }),
  row({ area: '["saude_fisica","emocional"]', iniciativa: 'Corpo Forte, mente forte', iniciativaDescricao: 'Cuidar do corpo' }),
  row({ area: '["sociedade"]', iniciativa: 'Doação e Caridade', iniciativaDescricao: 'Ajudar' }),
  row({ area: 'intelecto', iniciativa: 'Estudo das Artes Liberais', epico: 'Homero - Ilíada', epicoDescricao: 'Livro Físico' }),
  row({ area: '["sociedade"]', iniciativa: 'Doação e Caridade', epico: 'Doar sangue', epicoDescricao: '' }),
  row({ area: 'intelecto', iniciativa: 'Estudo das Artes Liberais', epico: 'Homero - Ilíada', tarefa: 'Canto 1', tarefaDescricao: 'Ler', previsao: '01/02/2026' }),
  row({ area: 'intelecto', iniciativa: 'Estudo das Artes Liberais', epico: 'Homero - Ilíada', tarefa: 'Canto 2', previsao: '31/02/2026' }),
  row({ area: 'zodiaco', iniciativa: 'Estudo das Artes Liberais', epico: 'Homero - Ilíada', tarefa: 'Canto 3' }),
  row({ area: 'intelecto', iniciativa: 'Estudo das Artes Liberais', epico: '', tarefa: 'Sem épico' }),
];

describe('Exportar e importar tarefas em planilha', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let me: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development' });
    me = await loginAs(api, 'planilha');
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('prévia: mostra o que vai entrar, o que falta e os problemas, sem gravar', async () => {
    const r = await me.c.request('POST', '/backlog/import', { rows: OLD, apply: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.applied, false);
    assert.deepEqual(r.body.iniciativas, { novas: 3, existentes: 0 });
    assert.equal(r.body.epicos.novos, 2);
    assert.equal(r.body.tarefas.novas, 3);
    assert.equal(r.body.faltando.tarefasSemStatus, 3);
    assert.equal(r.body.faltando.tarefasSemPrioridade, 3);
    assert.equal(r.body.faltando.semObjetivoMaster, true);
    assert.deepEqual(r.body.faltando.iniciativasSemEpico, ['Corpo Forte, mente forte']);
    assert.deepEqual(r.body.faltando.epicosSemTarefa, ['Doar sangue']);
    const motivos = r.body.problemas.map((p: { linha: number; motivo: string }) => `${p.linha}: ${p.motivo}`).join('\n');
    assert.match(motivos, /^8: Data inválida/m);
    assert.match(motivos, /^9: Área não reconhecida: zodiaco/m);
    assert.match(motivos, /^10: A tarefa “Sem épico” está sem épico/m);
    assert.equal(await api.prisma.initiative.count({ where: { userId: me.user.id } }), 0, 'prévia não grava');
  });

  test('importar: cria a árvore com as áreas do app novo, tudo no backlog', async () => {
    const r = await me.c.request('POST', '/backlog/import', { rows: OLD, apply: true });
    assert.equal(r.body.applied, true);
    const b = (await me.c.request('GET', '/backlog')).body;
    const corpo = b.initiatives.find((i: { title: string }) => i.title === 'Corpo Forte, mente forte');
    assert.deepEqual(corpo.areas, ['saude', 'emocional']);
    const iliada = b.epics.find((e: { title: string }) => e.title === 'Homero - Ilíada');
    assert.equal(iliada.area, 'intelectual');
    const tasks = b.tasks.filter((t: { epicId: string }) => t.epicId === iliada.id);
    assert.deepEqual(tasks.map((t: { title: string }) => t.title), ['Canto 1', 'Canto 2', 'Canto 3']);
    assert.ok(tasks.every((t: { status: string; priority: string }) => t.status === 'backlog' && t.priority === 'media'));
    assert.equal(tasks[0].dueDate, '2026-02-01');
    assert.equal(tasks[1].dueDate, null);
    assert.equal(b.epics.find((e: { title: string }) => e.title === 'Doar sangue').area, 'sociedade');
    const me2 = (await me.c.request('GET', '/me')).body;
    assert.equal(me2.xp.total, 0, 'importar não dá XP');
  });

  test('importar de novo: junta sem duplicar e não muda o que já existe', async () => {
    await me.c.request('PATCH', `/initiatives/${(await me.c.request('GET', '/backlog')).body.initiatives[0].id}`, { description: 'Mudei aqui' });
    const again = [...OLD, row({ area: 'intelecto', iniciativa: 'estudo das artes liberais', iniciativaDescricao: 'Outra descrição', epico: 'Homero - Ilíada', tarefa: 'Canto 4', status: 'Pronto', prioridade: 'Alta' })];
    const r = await me.c.request('POST', '/backlog/import', { rows: again, apply: true });
    assert.deepEqual(r.body.iniciativas, { novas: 0, existentes: 3 });
    assert.equal(r.body.epicos.novos, 0);
    assert.equal(r.body.tarefas.novas, 1);
    const b = (await me.c.request('GET', '/backlog')).body;
    assert.equal(b.initiatives.length, 3);
    assert.equal(b.initiatives[0].description, 'Mudei aqui', 'o que existe fica como está');
    const c4 = b.tasks.find((t: { title: string }) => t.title === 'Canto 4');
    assert.equal(c4.status, 'done');
    assert.equal(c4.priority, 'alta');
    assert.ok(c4.archivedAt, 'concluída entra já entregue, fora do quadro');
  });

  test('exportar: modelo do app antigo + status, prioridade e master; reimportar não duplica', async () => {
    const ex = (await me.c.request('GET', '/backlog/export')).body;
    assert.equal(ex.filter((r: { epico: string }) => !r.epico).length, 3, 'primeiro as iniciativas');
    const canto1 = ex.find((r: { tarefa: string }) => r.tarefa === 'Canto 1');
    assert.equal(canto1.area, 'intelectual');
    assert.equal(canto1.previsao, '01/02/2026');
    assert.equal(canto1.status, 'Backlog');
    assert.equal(canto1.prioridade, 'Média');
    const r = await me.c.request('POST', '/backlog/import', { rows: ex, apply: false });
    assert.equal(r.body.iniciativas.novas + r.body.epicos.novos + r.body.tarefas.novas, 0);
    assert.equal(r.body.problemas.length, 0);
  });
});
