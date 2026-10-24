/**
 * Ajudantes dos testes de ponta a ponta da API.
 *
 * Os testes usam o PostgreSQL, o storage e o Mailpit do "pnpm dev" (que
 * precisa estar ligado), mas num banco SEPARADO: circle_of_life_test.
 * Esse banco é recriado do zero no início de cada execução.
 */
import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

const API_DIR = resolve(__dirname, '../..');
loadEnv({ path: resolve(API_DIR, '../../.env'), quiet: true });

const mainUrl = new URL(process.env.DATABASE_URL!);
const testUrl = new URL(mainUrl);
testUrl.pathname = '/circle_of_life_test';
export const TEST_DATABASE_URL = testUrl.toString();

let prepared = false;

/** Recria o banco de testes e aplica todas as migrations. */
export async function prepareTestDatabase() {
  if (prepared) return;
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: mainUrl.toString() }) });
  await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS circle_of_life_test WITH (FORCE)');
  await admin.$executeRawUnsafe('CREATE DATABASE circle_of_life_test');
  await admin.$disconnect();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    stdio: 'pipe',
  });
  prepared = true;
}

/** Sobe a API de verdade (mesmos módulos e configurações), ligada ao banco de testes. */
export async function startApi(env: Record<string, string> = {}) {
  await prepareTestDatabase();
  Object.assign(process.env, { DATABASE_URL: TEST_DATABASE_URL, API_PORT: '0', DISABLE_SCHEDULE: 'true' }, env);
  // Carregados só agora (require) para que leiam as variáveis acima.
  const { AppModule } = require('../src/app.module') as typeof import('../src/app.module.js');
  const { setupApp } = require('../src/app.setup') as typeof import('../src/app.setup.js');
  const app: INestApplication = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  setupApp(app);
  await app.listen(0);
  const url = `${await app.getUrl()}/api`.replace('[::1]', 'localhost');
  return { app, url, prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) }) };
}

/** Pequeno cliente HTTP que guarda o cookie de sessão, como um navegador. */
export function client(baseUrl: string) {
  let cookie = '';
  return {
    get cookie() {
      return cookie;
    },
    async request(method: string, path: string, body?: unknown) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        redirect: 'manual',
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const [name, value] = pair!.split('=');
        // Cookie apagado (valor vazio) sai da lista; os outros substituem o anterior.
        const others = cookie.split('; ').filter(x => x && !x.startsWith(`${name}=`));
        cookie = [...others, ...(value ? [`${name}=${value}`] : [])].join('; ');
      }
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, body: json, headers: res.headers };
    },
  };
}

/** Lê os e-mails capturados pelo Mailpit (para conferir convites enviados). */
export async function mailpitMessages(to: string) {
  const port = process.env.MAILPIT_UI_PORT ?? '8025';
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  const data = (await res.json()) as { messages: { ID: string; Subject: string }[] };
  return data.messages;
}

export async function mailpitBody(id: string) {
  const port = process.env.MAILPIT_UI_PORT ?? '8025';
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/message/${id}`);
  return ((await res.json()) as { Text: string }).Text;
}

/** Cria um usuário de teste e devolve um cliente HTTP já logado como ele. */
export async function loginAs(api: Awaited<ReturnType<typeof startApi>>, handle: string, extra: { role?: 'admin' | 'member' } = {}) {
  const user = await api.prisma.user.create({
    data: { email: `${handle}@teste.local`, name: handle, handle, isTestUser: true, role: extra.role ?? 'member' },
  });
  const c = client(api.url);
  const res = await c.request('POST', '/auth/dev/login', { userId: user.id });
  if (res.status !== 204) throw new Error(`login de teste falhou: ${res.status}`);
  return { user, c };
}
