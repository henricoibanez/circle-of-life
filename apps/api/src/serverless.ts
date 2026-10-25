import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

/**
 * Entrada da API como função da Vercel (em vez de um servidor sempre ligado).
 * A API é montada uma vez por instância e reaproveitada nos pedidos seguintes.
 * Localmente e em contêiner, a entrada continua sendo o main.ts.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let ready: Promise<Handler> | null = null;

async function build(): Promise<Handler> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= build().catch(e => {
    ready = null;
    throw e;
  });
  (await ready)(req, res);
}
