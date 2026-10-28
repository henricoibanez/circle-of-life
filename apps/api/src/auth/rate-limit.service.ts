import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Mostra a espera de um jeito legível ("3 minutos", "2 horas"). */
function formatWait(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.ceil(min / 60);
  return `${h} ${h === 1 ? 'hora' : 'horas'}`;
}

/**
 * Limite de tentativas por "chave" (ex.: login de um e-mail), para travar
 * ataques de força bruta. A contagem fica no banco (janela fixa), então o
 * limite vale mesmo na Vercel, onde a API não guarda memória entre pedidos.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Conta mais uma tentativa para `key`. Se passar de `limit` dentro da janela
   * de `windowMs`, recusa com 429 e diz quanto tempo esperar.
   */
  async hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const row = await this.prisma.rateLimit.findUnique({ where: { key } });

    // Sem registro, ou janela já vencida: recomeça a contagem.
    if (!row || now - row.windowStart.getTime() > windowMs) {
      await this.prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: new Date(now) },
        update: { count: 1, windowStart: new Date(now) },
      });
      return;
    }

    if (row.count >= limit) {
      const wait = windowMs - (now - row.windowStart.getTime());
      throw new HttpException(`Muitas tentativas. Tente de novo em ${formatWait(wait)}.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  }

  /** Zera o contador (ex.: depois de um login que deu certo). */
  async clear(key: string) {
    await this.prisma.rateLimit.deleteMany({ where: { key } });
  }

  /** Apaga janelas antigas (chamado pela tarefa diária, para a tabela não crescer à toa). */
  async pruneOlderThan(ms: number) {
    await this.prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - ms) } } });
  }
}
