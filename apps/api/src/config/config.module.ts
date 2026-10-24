import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnv, type Env } from './env';

/** Leitura tipada das variáveis: config.get('S3_BUCKET'). */
export type AppConfig = ConfigService<Env, true>;

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      // Localmente lê o .env da raiz do projeto; em produção as variáveis
      // vêm do ambiente e o arquivo não existe.
      envFilePath: resolve(__dirname, '../../../../.env'),
      validate: validateEnv,
      isGlobal: true,
    }),
  ],
})
export class AppConfigModule {}
