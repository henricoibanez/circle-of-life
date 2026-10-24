import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type Check = { ok: boolean; erro?: string };

/**
 * GET /api/health — diz se a API, o banco e o storage estão funcionando.
 * Público (não exige login). Responde 503 se algo estiver fora do ar.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check() {
    const [banco, storage] = await Promise.all([
      this.run(async () => {
        await this.prisma.$queryRaw`select 1`;
      }),
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
}
