import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import type { Env } from '../config/env';
import { StorageService } from '../storage/storage.service';

type Check = { ok: boolean; erro?: string };

/**
 * GET /api/health — diz se a API, o banco e o storage estão funcionando.
 * Público (não exige login). Responde 503 se algo estiver fora do ar.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check() {
    const [banco, storage] = await Promise.all([
      this.run(() => this.pingDatabase()),
      this.run(() => this.storage.ping()),
    ]);
    const body = { status: banco.ok && storage.ok ? 'ok' : 'com problemas', api: { ok: true }, banco, storage };
    if (body.status !== 'ok') throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }

  private async run(fn: () => Promise<void>): Promise<Check> {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message || e.name : String(e) };
    }
  }

  // Temporário: na etapa 1 a conexão passa a ser feita pelo Prisma.
  private async pingDatabase() {
    const client = new Client({ connectionString: this.config.get('DATABASE_URL'), connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      await client.query('select 1');
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
