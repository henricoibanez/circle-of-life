import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Todas as rotas ficam em /api/... (o site repassa /api/* para cá).
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = app.get(ConfigService<Env, true>).get('API_PORT');
  await app.listen(port);
  new Logger('API').log(`API no ar em http://localhost:${port}/api`);
}

bootstrap().catch(err => {
  // Mensagem clara quando falta configuração, em vez de um erro técnico enorme.
  console.error(`\n✗ A API não iniciou.\n${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
