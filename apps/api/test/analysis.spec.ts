import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loginAs, startApi } from './helpers';

describe('Análise inteligente (IA simulada)', () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let ana: Awaited<ReturnType<typeof loginAs>>;
  let bia: Awaited<ReturnType<typeof loginAs>>;

  before(async () => {
    api = await startApi({ NODE_ENV: 'development', AI_MODE: 'mock', AI_MIN_MINUTES: '5' });
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

  test('sem relatório, mostra o exemplo e as fontes com dados', async () => {
    const r = (await ana.c.request('GET', '/analysis/latest')).body;
    assert.equal(r.report.example, true);
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
  test('gera relatório só com as fontes escolhidas', async () => {
    const r = await ana.c.request('POST', '/analysis', { sources: ['roda', 'tarefas', 'maslow'] });
    assert.equal(r.status, 201);
    reportId = r.body.id;
    assert.deepEqual(r.body.sources, ['roda', 'tarefas'], 'pirâmide sem dados fica de fora');
    assert.ok(r.body.geral >= 0 && r.body.geral <= 100);
    assert.equal(r.body.areas.length, 6);
    assert.equal(r.body.insights.length, 3);
    assert.ok(r.body.suggestions.length >= 1 && r.body.suggestions.length <= 3);
    assert.ok(r.body.areas.some((a: { area: string; texto: string }) => a.area === 'saude' && a.texto.includes('3/10')));
    const latest = (await ana.c.request('GET', '/analysis/latest')).body;
    assert.equal(latest.report.id, reportId);
    assert.ok(latest.nextAllowedAt);
  });

  test('limite: um relatório a cada 5 minutos', async () => {
    const r = await ana.c.request('POST', '/analysis', { sources: ['roda'] });
    assert.equal(r.status, 429);
    assert.match(r.body.message, /minutos/);
  });

  test('importa a sugestão com os itens marcados', async () => {
    const report = (await ana.c.request('GET', '/analysis/latest')).body.report;
    const s = report.suggestions[0];
    const r = await ana.c.request('POST', `/analysis/${reportId}/suggestions/0/import`, { epicos: [{ index: 0, tarefas: [0, 2] }] });
    assert.equal(r.status, 201);
    assert.equal(r.body.epics, 1);
    assert.equal(r.body.tasks, 2);
    const backlog = (await ana.c.request('GET', '/backlog')).body;
    const ini = backlog.initiatives.find((i: { id: string }) => i.id === r.body.initiativeId);
    assert.equal(ini.title, s.iniciativa.titulo);
    const titles = backlog.tasks.filter((t: { epicId: string }) => backlog.epics.find((e: { id: string; initiativeId: string }) => e.id === t.epicId)?.initiativeId === ini.id).map((t: { title: string }) => t.title);
    assert.deepEqual(titles.sort(), [s.epicos[0].tarefas[0], s.epicos[0].tarefas[2]].sort());
    assert.deepEqual((await ana.c.request('GET', '/analysis/latest')).body.report.imported, [0]);

    assert.equal((await ana.c.request('POST', `/analysis/${reportId}/suggestions/0/import`, { epicos: [] })).status, 400);
    assert.equal((await ana.c.request('POST', `/analysis/${reportId}/suggestions/9/import`, { epicos: [{ index: 0, tarefas: [] }] })).status, 404);
    assert.equal((await bia.c.request('POST', `/analysis/${reportId}/suggestions/0/import`, { epicos: [{ index: 0, tarefas: [] }] })).status, 404);
  });
});

describe('Configuração da IA', () => {
  test('AI_MODE=anthropic exige a chave', () => {
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
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_FROM: 'x@y.z',
      JWT_SECRET: 'x'.repeat(40),
    };
    assert.throws(() => validateEnv({ ...base, AI_MODE: 'anthropic' }), /ANTHROPIC_API_KEY/);
    assert.equal(validateEnv({ ...base, AI_MODE: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }).AI_MODEL, 'claude-opus-5-5');
  });
});
