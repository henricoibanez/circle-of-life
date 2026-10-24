import { BadRequestException, ValidationPipe, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Configurações comuns à API de verdade e aos testes. */
export function setupApp(app: INestApplication) {
  // Todas as rotas ficam em /api/... (o site repassa /api/* para cá).
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Mensagem única e em português, com o primeiro problema de cada campo.
      exceptionFactory: errors =>
        new BadRequestException(
          errors.map(e => Object.values(e.constraints ?? {})[0] ?? `campo "${e.property}" inválido`).join('; '),
        ),
    }),
  );
  app.enableShutdownHooks();
}
