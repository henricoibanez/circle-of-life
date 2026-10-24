/**
 * pnpm dev
 *
 * Sobe todo o ambiente local, sem Docker:
 *   1. PostgreSQL (pacote embedded-postgres, dados em .local/postgres)
 *   2. SeaweedFS  (storage S3, dados em .local/storage)
 *   3. Mailpit    (e-mails de teste, tela em http://localhost:8025)
 *   4. API        (Nest.js, recompila sozinha ao salvar)
 *   5. Site       (Next.js, recarrega sozinho ao salvar)
 *
 * Tudo é configurado pelo .env da raiz. Ctrl+C desliga tudo.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { join, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';

const ROOT = resolve(import.meta.dirname, '..');
const LOCAL = join(ROOT, '.local');
const BIN = join(LOCAL, 'bin');
const isWindows = process.platform === 'win32';

// ---------- Saída organizada: cada serviço com sua cor ----------
const COLORS = { banco: 34, storage: 36, email: 35, api: 33, site: 32, dev: 37 } as const;
type Name = keyof typeof COLORS;
function log(name: Name, text: string) {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) console.log(`\x1b[${COLORS[name]}m${name.padEnd(7)}│\x1b[0m ${line}`);
  }
}
function fail(message: string): never {
  console.error(`\n\x1b[31m✗ ${message}\x1b[0m\n`);
  process.exit(1);
}

// ---------- Configuração ----------
const envFile = join(ROOT, '.env');
if (!existsSync(envFile)) {
  copyFileSync(join(ROOT, '.env.example'), envFile);
  log('dev', 'Arquivo .env criado a partir do .env.example.');
}
loadEnv({ path: envFile, quiet: true });

function env(name: string): string {
  const value = process.env[name];
  if (!value) fail(`Falta a variável ${name} no arquivo .env (modelo em .env.example).`);
  return value;
}
const portOf = (url: string) => Number(new URL(url).port);

const db = new URL(env('DATABASE_URL'));
const dbName = db.pathname.slice(1);
const s3Port = portOf(env('S3_ENDPOINT'));
const webPort = Number(env('WEB_PORT'));
const apiPort = Number(env('API_PORT'));
const smtpPort = Number(env('SMTP_PORT'));
const mailUiPort = Number(env('MAILPIT_UI_PORT'));

for (const exe of ['weed', 'mailpit']) {
  if (!existsSync(join(BIN, `${exe}${isWindows ? '.exe' : ''}`))) {
    fail(`Programas locais não encontrados. Rode primeiro: pnpm setup:local`);
  }
}

// ---------- Utilidades ----------
function portBusy(port: number): Promise<boolean> {
  return new Promise(done => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => (socket.destroy(), done(true)));
    socket.once('error', () => done(false));
  });
}
async function waitForPort(port: number, what: string, seconds = 60) {
  for (let i = 0; i < seconds * 4; i++) {
    if (await portBusy(port)) return;
    await new Promise(r => setTimeout(r, 250));
  }
  fail(`${what} não respondeu na porta ${port} em ${seconds} segundos.`);
}

const children: ChildProcess[] = [];
/** Linhas que não ajudam no dia a dia (ex.: avisos informativos do SeaweedFS, que começam com "I"). */
// Também escondemos dois avisos do SeaweedFS sobre recursos que não usamos
// (criptografia SSE-S3 e o serviço STS); o acesso por chave segue funcionando.
const NOISE: Partial<Record<Name, RegExp>> = {
  storage: /^I\d{4} |SSE-S3 KeyManager: neither|no signing key found for STS service/,
};

function run(name: Name, command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const options = { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '1', ...extraEnv }, windowsHide: true };
  // No Windows o pnpm é um script .cmd, que só roda pelo terminal (shell).
  const child =
    command === 'pnpm' && isWindows
      ? spawn(['pnpm', ...args].join(' '), { ...options, shell: true })
      : spawn(command, args, options);
  const print = (d: Buffer) => {
    const lines = String(d).split(/\r?\n/).filter(l => !NOISE[name]?.test(l));
    if (lines.length) log(name, lines.join('\n'));
  };
  child.stdout?.on('data', print);
  child.stderr?.on('data', print);
  child.on('exit', code => {
    if (!stopping) log(name, `parou (código ${code}). Os outros serviços continuam; Ctrl+C para sair.`);
  });
  children.push(child);
  return child;
}

let stopping = false;
let postgres: EmbeddedPostgres | null = null;
async function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  log('dev', 'Desligando tudo…');
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      // No Windows, "kill" não derruba os processos filhos; o taskkill /T derruba a árvore toda.
      if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
  }
  await postgres?.stop().catch(() => undefined);
  log('dev', 'Pronto. Até a próxima!');
  process.exit(exitCode);
}
process.on('SIGINT', () => stopAll());
process.on('SIGTERM', () => stopAll());

// ---------- Serviços ----------
async function startPostgres() {
  const dir = join(LOCAL, 'postgres');
  const firstTime = !existsSync(join(dir, 'PG_VERSION'));
  postgres = new EmbeddedPostgres({
    databaseDir: dir,
    port: Number(db.port || 5432),
    user: decodeURIComponent(db.username),
    password: decodeURIComponent(db.password),
    authMethod: 'scram-sha-256',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => undefined,
    onError: e => log('banco', String(e instanceof Error ? e.message : e)),
  });
  if (firstTime) {
    log('banco', 'Primeira vez: criando o banco local (leva alguns segundos)…');
    await postgres.initialise();
  }
  await postgres.start();
  if (firstTime) await postgres.createDatabase(dbName);
  log('banco', `PostgreSQL no ar na porta ${db.port || 5432} (banco "${dbName}")`);
}

async function startStorage() {
  const dir = join(LOCAL, 'storage');
  mkdirSync(dir, { recursive: true });
  // Arquivo de acesso do SeaweedFS, gerado a partir das chaves do .env.
  const s3Config = join(LOCAL, 'seaweedfs-s3.json');
  writeFileSync(
    s3Config,
    JSON.stringify({
      identities: [
        {
          name: 'circle',
          credentials: [{ accessKey: env('S3_ACCESS_KEY_ID'), secretKey: env('S3_SECRET_ACCESS_KEY') }],
          actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
        },
      ],
    }),
  );
  run('storage', join(BIN, 'weed'), [
    'server',
    '-ip=127.0.0.1',
    `-dir=${dir}`,
    '-s3',
    `-s3.port=${s3Port}`,
    `-s3.config=${s3Config}`,
    '-master.volumeSizeLimitMB=64',
    '-volume.port=8380',
  ]);
  await waitForPort(s3Port, 'O storage (SeaweedFS)');
  log('storage', `SeaweedFS (S3) no ar em http://localhost:${s3Port}`);
}

async function startMail() {
  run('email', join(BIN, 'mailpit'), [
    `--smtp=127.0.0.1:${smtpPort}`,
    `--listen=127.0.0.1:${mailUiPort}`,
    `--database=${join(LOCAL, 'mailpit.db')}`,
    '--quiet',
  ]);
  await waitForPort(mailUiPort, 'O Mailpit');
  log('email', `Mailpit no ar: caixa de entrada em http://localhost:${mailUiPort}`);
}

async function main() {
  const ports: [number, string][] = [
    [Number(db.port || 5432), 'banco'], [s3Port, 'storage'], [smtpPort, 'e-mail (SMTP)'],
    [mailUiPort, 'Mailpit'], [apiPort, 'API'], [webPort, 'site'],
  ];
  for (const [port, what] of ports) {
    if (await portBusy(port)) {
      fail(`A porta ${port} (${what}) já está em uso. Talvez o "pnpm dev" já esteja rodando em outra janela.`);
    }
  }

  await startPostgres();
  await startStorage();
  await startMail();

  run('api', 'pnpm', ['--filter', '@circle/api', 'dev']);
  await waitForPort(apiPort, 'A API', 180);
  run('site', 'pnpm', ['--filter', '@circle/web', 'dev'], { PORT: String(webPort) });
  await waitForPort(webPort, 'O site', 180);

  log('dev', '');
  log('dev', '✓ Tudo no ar!');
  log('dev', `  Site:            http://localhost:${webPort}`);
  log('dev', `  API (saúde):     http://localhost:${apiPort}/api/health`);
  log('dev', `  E-mails (teste): http://localhost:${mailUiPort}`);
  log('dev', '  Ctrl+C para desligar tudo.');
}

main().catch(async err => {
  log('dev', `Erro ao iniciar: ${err instanceof Error ? err.message : err}`);
  await stopAll(1);
});
