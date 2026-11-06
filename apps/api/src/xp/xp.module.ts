import { Controller, Get, Global, Module, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { ActivityService } from './activity.service';
import { StreakService } from './streak.service';
import { XpService } from './xp.service';

@Controller('me')
class XpController {
  constructor(
    private readonly xp: XpService,
    private readonly activity: ActivityService,
    private readonly streak: StreakService,
  ) {}

  /** Extrato de gemas. */
  @Get('gems')
  gems(@CurrentUser() u: User) {
    return this.xp.gemHistory(u.id);
  }

  /** Ao abrir o app: conta o acesso do dia e dá as gemas da ofensiva (uma vez por dia). */
  @Post('checkin')
  checkin(@CurrentUser() u: User) {
    return this.streak.checkin(u);
  }

  /** Ofensiva e acessos do mês (perfil). */
  @Get('streak')
  streakStatus(@CurrentUser() u: User) {
    return this.streak.status(u);
  }

  /** Extrato de XP. */
  @Get('xp')
  history(@CurrentUser() u: User) {
    return this.xp.history(u.id);
  }

  /** Atividade recente. */
  @Get('activity')
  recent(@CurrentUser() u: User) {
    return this.activity.list(u.id);
  }
}

@Global()
@Module({
  controllers: [XpController],
  providers: [XpService, ActivityService, StreakService],
  exports: [XpService, ActivityService, StreakService],
})
export class XpModule {}
