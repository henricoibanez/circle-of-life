import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SprintsService } from '../sprints/sprints.service';
import { BacklogService } from './backlog.service';
import { CreateEpicDto, CreateInitiativeDto, CreateTaskDto, MoveTaskDto, UpdateEpicDto, UpdateInitiativeDto, UpdateTaskDto } from './dto';

@Controller()
class BacklogController {
  constructor(private readonly backlog: BacklogService) {}

  /** Backlog completo da pessoa logada. */
  @Get('backlog')
  all(@CurrentUser() u: User) {
    return this.backlog.all(u.id);
  }

  // Iniciativas
  @Post('initiatives')
  createInitiative(@CurrentUser() u: User, @Body() dto: CreateInitiativeDto) {
    return this.backlog.createInitiative(u.id, dto);
  }
  @Patch('initiatives/:id')
  updateInitiative(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: UpdateInitiativeDto) {
    return this.backlog.updateInitiative(u.id, id, dto);
  }
  @Delete('initiatives/:id')
  @HttpCode(204)
  deleteInitiative(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.deleteInitiative(u.id, id);
  }
  @Post('initiatives/:id/duplicate')
  duplicateInitiative(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.duplicateInitiative(u.id, id);
  }
  @Post('initiatives/:id/complete')
  completeInitiative(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.completeInitiative(u.id, id);
  }
  @Post('initiatives/:id/reopen')
  reopenInitiative(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.reopenInitiativeById(u.id, id);
  }

  // Épicos
  @Post('epics')
  createEpic(@CurrentUser() u: User, @Body() dto: CreateEpicDto) {
    return this.backlog.createEpic(u.id, dto);
  }
  @Patch('epics/:id')
  updateEpic(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: UpdateEpicDto) {
    return this.backlog.updateEpic(u.id, id, dto);
  }
  @Delete('epics/:id')
  @HttpCode(204)
  deleteEpic(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.deleteEpic(u.id, id);
  }
  @Post('epics/:id/duplicate')
  duplicateEpic(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.duplicateEpic(u.id, id);
  }
  @Post('epics/:id/close')
  closeEpic(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.closeEpic(u.id, id);
  }
  @Post('epics/:id/reopen')
  reopenEpic(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.reopenEpic(u.id, id);
  }

  // Tarefas
  @Post('tasks')
  createTask(@CurrentUser() u: User, @Body() dto: CreateTaskDto) {
    return this.backlog.createTask(u.id, dto);
  }
  @Patch('tasks/:id')
  updateTask(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.backlog.updateTask(u.id, id, dto);
  }
  @Delete('tasks/:id')
  @HttpCode(204)
  deleteTask(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.deleteTask(u.id, id);
  }
  @Post('tasks/:id/duplicate')
  duplicateTask(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.duplicateTask(u.id, id);
  }
  @Post('tasks/:id/move')
  moveTask(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.backlog.moveTask(u.id, id, dto.status);
  }
}

@Module({
  controllers: [BacklogController],
  providers: [BacklogService, SprintsService],
  exports: [BacklogService, SprintsService],
})
export class BacklogModule {}
