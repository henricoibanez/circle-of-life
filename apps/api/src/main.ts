import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  // Ao receber o aviso de parada (troca de versão), termina os pedidos em andamento antes de sair.
  app.enableShutdownHooks();

  const port = app.get(ConfigService<Env, true>).get('API_PORT');
  await app.listen(port);
  // O balanceador da AWS mantém conexões ociosas por 120 s. O Node precisa esperar mais que isso:
  // se ele fechar primeiro, o balanceador reaproveita uma conexão morta e o usuário vê erro 502.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 125_000;
  server.headersTimeout = 126_000;
  new Logger('API').log(`API no ar em http://localhost:${port}/api`);
}

bootstrap().catch(err => {
  // Mensagem clara quando falta configuração, em vez de um erro técnico enorme.
  console.error(`\n✗ A API não iniciou.\n${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
