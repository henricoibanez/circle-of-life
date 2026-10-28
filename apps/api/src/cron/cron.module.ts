import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers, Module, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators';
import type { Env } from '../config/env';
import { RateLimitService } from '../auth/rate-limit.service';
import { SessionModule } from '../auth/auth.module';
import { NotificationsService } from '../notifications/notifications.service';
import { StoriesModule } from '../stories/stories.module';
import { StoriesService } from '../stories/stories.service';

/**
 * Tarefas diárias chamadas de fora (na Vercel, pelo agendador "Cron Jobs", que
 * manda o CRON_SECRET no cabeçalho Authorization). Onde a API fica sempre ligada,
 * as mesmas tarefas já rodam sozinhas a cada hora (@nestjs/schedule).
 */
@Controller('cron')
class CronController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
    private readonly stories: StoriesService,
    private readonly rate: RateLimitService,
  ) {}

  @Public()
  @Get('daily')
  async daily(@Headers('authorization') auth?: string) {
    const secret = this.config.get('CRON_SECRET');
    if (!secret) throw new NotFoundException();
    const expected = Buffer.from(`Bearer ${secret}`);
    const got = Buffer.from(auth ?? '');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new UnauthorizedException();
    await this.notifications.hourly();
    const stories = await this.stories.cleanup();
    // Limpa contadores de limite com mais de um dia (a tabela não cresce à toa).
    await this.rate.pruneOlderThan(24 * 3600_000);
    return { ok: true, storiesApagados: stories };
  }
}

@Module({ imports: [StoriesModule, SessionModule], controllers: [CronController] })
export class CronModule {}
