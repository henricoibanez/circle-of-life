import { Controller, Get, Global, Module } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { ActivityService } from './activity.service';
import { XpService } from './xp.service';

@Controller('me')
class XpController {
  constructor(
    private readonly xp: XpService,
    private readonly activity: ActivityService,
  ) {}

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
  providers: [XpService, ActivityService],
  exports: [XpService, ActivityService],
})
export class XpModule {}
