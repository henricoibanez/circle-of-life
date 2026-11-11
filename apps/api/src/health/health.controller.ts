import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type Check = { ok: boolean; erro?: string };

/**
 * Por quanto tempo um "storage ok" vale sem consultar o storage de novo. O balanceador da AWS chama
 * esta rota a cada poucos segundos, e cada consulta ao storage é cobrada. O banco continua conferido
 * em toda chamada (não custa nada), e uma falha do storage nunca fica guardada: a próxima chamada
 * consulta de novo.
 */
const STORAGE_OK_MS = 30_000;

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

  /** Até quando o último "storage ok" vale (0 = ainda não conferido nesta instância da API). */
  private storageOkUntil = 0;

  @Public()
  @Get()
  async check() {
    const [banco, storage] = await Promise.all([
      this.run(async () => {
        await this.prisma.$queryRaw`select 1`;
      }),
      this.checkStorage(),
    ]);
    const body = { status: banco.ok && storage.ok ? 'ok' : 'com problemas', api: { ok: true }, banco, storage };
    if (body.status !== 'ok') throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }

  private async checkStorage(): Promise<Check> {
    if (Date.now() < this.storageOkUntil) return { ok: true };
    const result = await this.run(() => this.storage.ping());
    this.storageOkUntil = result.ok ? Date.now() + STORAGE_OK_MS : 0;
    return result;
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
