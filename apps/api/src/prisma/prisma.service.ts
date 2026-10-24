import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Acesso ao banco de dados. Use injetando o PrismaService:
 *   constructor(private readonly prisma: PrismaService) {}
 *   this.prisma.user.findMany()
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL') }),
      // Folga para operações maiores (ex.: encerrar sprint) num computador mais lento.
      transactionOptions: { timeout: 15_000, maxWait: 10_000 },
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
