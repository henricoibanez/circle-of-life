import { SPRINT_LENGTH_DAYS } from '@circle/shared';
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SprintsService } from './sprints.service';

class SprintEditDto {
  @IsOptional() @IsString() @MaxLength(60, { message: 'o nome da sprint pode ter até 60 caracteres' }) name?: string;
  @IsOptional() @IsString() @MaxLength(1000, { message: 'a descrição pode ter até 1.000 caracteres' }) description?: string;
  @IsOptional() @IsIn(SPRINT_LENGTH_DAYS, { message: 'duração de sprint inválida' }) length?: number;
}

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  /** Sprint atual (iniciada ou em planejamento) e histórico. */
  @Get()
  overview(@CurrentUser() u: User) {
    return this.sprints.overview(u.id);
  }

  /** Nome, descrição e duração da sprint atual. */
  @Patch('current')
  update(@CurrentUser() u: User, @Body() dto: SprintEditDto) {
    return this.sprints.update(u.id, dto);
  }

  /** "Iniciar sprint" (pode mandar nome, descrição e duração junto). */
  @Post('current/start')
  start(@CurrentUser() u: User, @Body() dto: SprintEditDto) {
    return this.sprints.start(u.id, dto);
  }

  /** Encerra a sprint atual; a próxima fica em planejamento. */
  @Post('current/close')
  close(@CurrentUser() u: User) {
    return this.sprints.close(u.id);
  }
}
