/**
 * pnpm setup:local
 *
 * Baixa, uma única vez, os programas que o "pnpm dev" usa e que não vêm
 * pelo npm: SeaweedFS (storage compatível com S3) e Mailpit (caixa de
 * e-mails de teste). Tudo vai para .local/bin, fora do git. Nada é
 * instalado no Windows.
 *
 * As versões são fixas e cada arquivo baixado é conferido pelo seu
 * código SHA-256 antes de ser usado. Para trocar de versão, atualize a
 * tabela TOOLS (URL, tamanho e SHA-256 vêm da página de releases no GitHub).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BIN = join(ROOT, '.local', 'bin');
const TMP = join(ROOT, '.local', 'downloads');

type Tool = { name: string; version: string; url: string; sha256: string; exe: string };

// Por enquanto só há binários conferidos para Windows 64 bits (o computador
// do projeto). Em outros sistemas, use o docker-compose.yml.
const TOOLS: Record<string, Tool[]> = {
  'win32-x64': [
    {
      name: 'SeaweedFS',
      version: '4.48',
      url: 'https://github.com/seaweedfs/seaweedfs/releases/download/4.48/windows_amd64.zip',
      sha256: 'fe90c04c0620ad1a1c756f86cd5e1443773f56a446688077a4bb5ec04c3cc874',
      exe: 'weed.exe',
    },
    {
      name: 'Mailpit',
      version: '1.31.4',
      url: 'https://github.com/axllent/mailpit/releases/download/v1.31.4/mailpit-windows-amd64.zip',
      sha256: '0dd6ec909a6f5b2b66682b22d82abce97ab793e30766bf2f642b691e70a4a16b',
      exe: 'mailpit.exe',
    },
  ],
};

async function install(tool: Tool) {
  const marker = join(BIN, `${tool.exe}.version`);
  if (existsSync(join(BIN, tool.exe)) && existsSync(marker) && readFileSync(marker, 'utf8') === tool.version) {
    console.log(`✓ ${tool.name} ${tool.version} já está em .local/bin`);
    return;
  }

  console.log(`↓ Baixando ${tool.name} ${tool.version}…`);
  const res = await fetch(tool.url);
  if (!res.ok) throw new Error(`Falha ao baixar ${tool.name}: HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());

  const hash = createHash('sha256').update(data).digest('hex');
  if (hash !== tool.sha256) {
    throw new Error(`O arquivo do ${tool.name} não confere (SHA-256 diferente). Download cancelado por segurança.`);
  }

  const zip = join(TMP, `${tool.exe}.zip`);
  writeFileSync(zip, data);
  // O "tar" já vem no Windows 10/11 e também abre arquivos .zip. Usamos o do
  // próprio Windows: o do Git Bash não entende caminhos como "C:\...".
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  const unzip = spawnSync(tar, ['-xf', zip, '-C', BIN], { encoding: 'utf8' });
  rmSync(zip);
  if (unzip.status !== 0) throw new Error(`Não foi possível extrair o ${tool.name}: ${unzip.stderr || unzip.error}`);
  if (!existsSync(join(BIN, tool.exe))) throw new Error(`${tool.exe} não foi encontrado dentro do arquivo baixado.`);
  writeFileSync(marker, tool.version);
  console.log(`✓ ${tool.name} ${tool.version} instalado em .local/bin (${(data.length / 1e6).toFixed(1)} MB, conferido)`);
}

async function main() {
  const tools = TOOLS[`${process.platform}-${process.arch}`];
  if (!tools) {
    console.error(`Sistema ${process.platform}-${process.arch} ainda não suportado pelo setup local. Use o docker-compose.yml.`);
    process.exit(1);
  }
  mkdirSync(BIN, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  for (const tool of tools) await install(tool);
  console.log('\nPronto. O PostgreSQL vem pelo npm (pacote embedded-postgres). Agora rode: pnpm dev');
}

main().catch(err => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
