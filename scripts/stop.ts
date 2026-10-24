/**
 * pnpm stop
 *
 * Desliga o ambiente local (o mesmo que Ctrl+C no "pnpm dev"), útil quando
 * o terminal que rodava o "pnpm dev" foi fechado. Encerra SÓ os programas
 * desta pasta do projeto: banco (com desligamento correto), storage,
 * e-mail, API e site. Nada mais do computador é tocado.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';

// 1. Banco: desligamento "educado", para não precisar de recuperação depois.
const dataDir = join(ROOT, '.local', 'postgres');
if (existsSync(join(dataDir, 'postmaster.pid'))) {
  // Programa pg_ctl que vem no pacote do PostgreSQL para este sistema (instalado pelo pnpm).
  const plat = `${isWindows ? 'windows' : process.platform}-${process.arch}`;
  const store = join(ROOT, 'node_modules', '.pnpm');
  const dir = readdirSync(store).find(d => d.startsWith(`@embedded-postgres+${plat}@`));
  const pgCtl = join(store, dir ?? '', 'node_modules', '@embedded-postgres', plat, 'native', 'bin', isWindows ? 'pg_ctl.exe' : 'pg_ctl');
  const r = spawnSync(pgCtl, ['stop', '-D', dataDir, '-m', 'fast'], { encoding: 'utf8' });
  console.log(r.status === 0 ? '✓ Banco desligado' : '• Banco já estava desligado');
}

// 2. Demais programas desta pasta (storage, e-mail, API, site e o próprio "pnpm dev").
function projectProcesses(): { pid: number; name: string }[] {
  if (!isWindows) {
    const out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
    return out
      .split('\n')
      .filter(l => l.includes(ROOT))
      .map(l => ({ pid: Number(l.trim().split(/\s+/)[0]), name: l.trim().split(/\s+/)[1] ?? '' }));
  }
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${ROOT.replace(/'/g, "''")}*' } | ForEach-Object { "$($_.ProcessId)|$($_.Name)" }`;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map(l => ({ pid: Number(l.split('|')[0]), name: l.split('|')[1] ?? '' }));
}

const keep = new Set([process.pid, process.ppid]);
const PROGRAMS = /^(node|weed|mailpit|postgres|esbuild)(.exe)?$/i;
const targets = projectProcesses().filter(p => PROGRAMS.test(p.name) && !keep.has(p.pid));
for (const p of targets) {
  if (isWindows) spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else spawnSync('kill', ['-TERM', String(p.pid)]);
}
console.log(targets.length ? `✓ ${targets.length} processos do projeto encerrados` : '• Nada do projeto estava rodando');
