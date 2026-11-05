import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Me analise (IA simulada)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let ana: Awaited<ReturnType<typeof loginAs>>;
  let bia: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', AI_MODE: 'mock', AI_INTERVAL_DAYS: '30' });
    ana = await loginAs(api, 'ana');
    bia = await loginAs(api, 'bia');
    // Dados da Ana: roda, necrológio, um sonho e um épico de saúde.
    await ana.c.request('PUT', '/roda/scores', { scores: { saude: 3, financas: 4, familia: 9, amor: 8, intelectual: 7 } });
    await ana.c.request('PUT', '/necrologio', { html: '<h1>Ana</h1><p>Leu todos os clássicos e correu maratonas.</p>' });
    await ana.c.request('POST', '/dreams', { text: 'Ter uma reserva de 6 meses', area: 'financas' });
    const ini = (await ana.c.request('POST', '/initiatives', { title: 'Saúde' })).body;
    const ep = (await ana.c.request('POST', '/epics', { initiativeId: ini.id, title: 'Correr', area: 'saude' })).body;
    await ana.c.request('POST', '/tasks', { epicId: ep.id, title: 'Correr 5 km' });
  });
  after(async () => {
    await api.prisma.$disconnect();
    await api.app.close();
  });

  test('sem relatório, mostra o exemplo no formato novo e as fontes com dados', async () => {
    const r = (await ana.c.request('GET', '/analysis/latest')).body;
    assert.equal(r.report.example, true);
    assert.ok(r.report.retrato && r.report.gaps.length && r.report.limitantes.length && r.report.pergunta);
    assert.equal(r.mode, 'mock');
    assert.deepEqual(r.available.sort(), ['necrologio', 'quadro', 'roda', 'tarefas']);
    assert.equal(r.nextAllowedAt, null);
    assert.deepEqual((await bia.c.request('GET', '/analysis/latest')).body.available, []);
  });

  test('precisa de pelo menos uma fonte com dados', async () => {
    assert.equal((await bia.c.request('POST', '/analysis', { sources: ['roda'] })).status, 400);
    assert.equal((await ana.c.request('POST', '/analysis', { sources: [] })).status, 400);
    assert.equal((await ana.c.request('POST', '/analysis', { sources: ['horoscopo'] })).status, 400);
  });

  let reportId = '';
  test('gera a análise só com as fontes escolhidas, no formato novo', async () => {
    const r = await ana.c.request('POST', '/analysis', { sources: ['roda', 'tarefas', 'maslow', 'necrologio'] });
    assert.equal(r.status, 201);
    reportId = r.body.id;
    assert.deepEqual(r.body.sources, ['roda', 'tarefas', 'necrologio'], 'pirâmide sem dados fica de fora');
    assert.ok(r.body.geral >= 0 && r.body.geral <= 100);
    assert.match(r.body.retrato, /^Ana, você/, 'fala com a pessoa pelo primeiro nome');
    assert.equal(r.body.padroes.length, 3);
    assert.ok(r.body.gaps.length >= 1);
    assert.equal(r.body.proximos7dias.length, 3);
    assert.equal(r.body.limitantes.length, 2);
    assert.ok(r.body.pergunta);
    assert.equal(r.body.cuidado, '');
    assert.ok(r.body.sugestoes.length >= 1 && r.body.sugestoes.length <= 4);
    const t = r.body.sugestoes[0].epicos[0].tarefas[0];
    assert.equal(typeof t.titulo, 'string');
    assert.equal(typeof t.descricao, 'string');
    const latest = (await ana.c.request('GET', '/analysis/latest')).body;
    assert.equal(latest.report.id, reportId);
    const days = (new Date(latest.nextAllowedAt).getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 29.9 && days <= 30, 'a próxima só daqui a 30 dias');
  });

  test('limite: uma análise por mês', async () => {
    const r = await ana.c.request('POST', '/analysis', { sources: ['roda'] });
    assert.equal(r.status, 429);
    assert.match(r.body.message, /uma análise por mês/);
    // Passados 30 dias, libera de novo.
    await api.prisma.analysisReport.update({ where: { id: reportId }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    assert.equal((await ana.c.request('GET', '/analysis/latest')).body.nextAllowedAt, null);
    await api.prisma.analysisReport.update({ where: { id: reportId }, data: { createdAt: new Date() } });
  });

  test('administrador não tem limite de análises', async () => {
    const adm = await loginAs(api, 'adm', { role: 'admin' });
    await adm.c.request('PUT', '/roda/scores', { scores: { saude: 5 } });
    assert.equal((await adm.c.request('POST', '/analysis', { sources: ['roda'] })).status, 201);
    assert.equal((await adm.c.request('GET', '/analysis/latest')).body.nextAllowedAt, null);
    assert.equal((await adm.c.request('POST', '/analysis', { sources: ['roda'] })).status, 201);
  });

  test('importa a sugestão tarefa por tarefa, com descrição e o "por que"', async () => {
    const report = (await ana.c.request('GET', '/analysis/latest')).body.report;
    const s = report.sugestoes[0];
    const r = await ana.c.request('POST', `/analysis/${reportId}/suggestions/0/import`, { epicos: [{ index: 0, tarefas: [0, 2] }] });
    assert.equal(r.status, 201);
    assert.equal(r.body.epics, 1);
    assert.equal(r.body.tasks, 2);
    const backlog = (await ana.c.request('GET', '/backlog')).body;
    const ini = backlog.initiatives.find((i: { id: string }) => i.id === r.body.initiativeId);
    assert.equal(ini.title, s.iniciativa.titulo);
    assert.match(ini.description, /Por que é importante:/);
    const epic = backlog.epics.find((e: { initiativeId: string }) => e.initiativeId === ini.id);
    assert.deepEqual(epic.areas, s.epicos[0].areas);
    const titles = backlog.tasks.filter((t: { epicId: string }) => t.epicId === epic.id).map((t: { title: string }) => t.title);
    assert.deepEqual(titles.sort(), [s.epicos[0].tarefas[0].titulo, s.epicos[0].tarefas[2].titulo].sort());
    assert.deepEqual((await ana.c.request('GET', '/analysis/latest')).body.report.imported, [0]);

    assert.equal((await ana.c.request('POST', `/analysis/${reportId}/suggestions/0/import`, { epicos: [] })).status, 400);
    assert.equal((await ana.c.request('POST', `/analysis/${reportId}/suggestions/9/import`, { epicos: [{ index: 0, tarefas: [] }] })).status, 404);
    assert.equal((await bia.c.request('POST', `/analysis/${reportId}/suggestions/0/import`, { epicos: [{ index: 0, tarefas: [] }] })).status, 404);
  });

  test('relatório antigo (antes do formato novo) abre e importa', async () => {
    const old = await api.prisma.analysisReport.create({
      data: {
        userId: bia.user.id,
        mode: 'anthropic',
        sources: ['roda'],
        geral: 61,
        visao: 'Visão geral antiga.',
        areas: [{ area: 'saude', pct: 40, texto: 'x' }],
        insights: [{ icon: 'trend', titulo: 'Insight antigo', texto: 'Texto antigo' }],
        suggestions: [{ iniciativa: { titulo: 'Velha', descricao: 'd', areas: ['saude'] }, epicos: [{ titulo: 'Épico velho', area: 'saude', tarefas: ['Caminhar'] }] }],
      },
    });
    const r = (await bia.c.request('GET', '/analysis/latest')).body.report;
    assert.equal(r.retrato, 'Visão geral antiga.');
    assert.deepEqual(r.padroes, [{ titulo: 'Insight antigo', texto: 'Texto antigo' }]);
    assert.deepEqual(r.gaps, []);
    assert.deepEqual(r.sugestoes[0].epicos[0], { titulo: 'Épico velho', areas: ['saude'], tarefas: [{ titulo: 'Caminhar', descricao: '' }] });
    const imp = await bia.c.request('POST', `/analysis/${old.id}/suggestions/0/import`, { epicos: [{ index: 0, tarefas: [0] }] });
    assert.equal(imp.status, 201);
    assert.equal(imp.body.tasks, 1);
  });
});

describe('Configuração da IA', () => {
  test('AI_MODE=afl exige endereço, chave e agente', () => {
    const { validateEnv } = require('../src/config/env') as typeof import('../src/config/env');
    const base = {
      WEB_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://x',
      S3_ENDPOINT: 'http://localhost:8333',
      S3_PUBLIC_ENDPOINT: 'http://localhost:8333',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 'b',
      S3_CORS_ORIGINS: 'http://localhost:3000',
      JWT_SECRET: 'x'.repeat(40),
    };
    assert.throws(() => validateEnv({ ...base, AI_MODE: 'afl', AFL_API_URL: 'http://x', AFL_API_KEY: 'k' }), /AFL_API_KEY/);
    const ok = validateEnv({ ...base, AI_MODE: 'afl', AFL_API_URL: 'http://x', AFL_API_KEY: 'k', AFL_AGENT_ID: 'a' });
    assert.equal(ok.AI_INTERVAL_DAYS, 30, 'padrão: uma análise por mês');
    assert.throws(() => validateEnv({ ...base, AI_MODE: 'anthropic' }), /AI_MODE/);
  });
});
