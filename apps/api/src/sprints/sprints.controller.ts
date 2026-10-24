import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SprintsService } from './sprints.service';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  /** Sprint atual e histórico. */
  @Get()
  overview(@CurrentUser() u: User) {
    return this.sprints.overview(u.id);
  }

  /** Encerra a sprint atual e abre a próxima. */
  @Post('current/close')
  close(@CurrentUser() u: User) {
    return this.sprints.close(u.id);
  }
}
