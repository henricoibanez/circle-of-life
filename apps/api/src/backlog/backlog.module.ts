import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SprintsController } from '../sprints/sprints.controller';
import { SprintsService } from '../sprints/sprints.service';
import { BacklogService } from './backlog.service';
import { AttachDto, ChecklistItemDto, CreateEpicDto, CreateInitiativeDto, CreateTaskDto, MoveTaskDto, UpdateChecklistItemDto, UpdateEpicDto, UpdateInitiativeDto, UpdateTaskDto } from './dto';
import { TaskDetailService } from './task-detail.service';

@Controller()
class BacklogController {
  constructor(
    private readonly backlog: BacklogService,
    private readonly detail: TaskDetailService,
  ) {}

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
  @Get('tasks/:id')
  taskDetail(@CurrentUser() u: User, @Param('id') id: string) {
    return this.detail.detail(u.id, id);
  }
  @Post('tasks/:id/checklist')
  addItem(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: ChecklistItemDto) {
    return this.detail.addItem(u.id, id, dto.text);
  }
  @Patch('tasks/:id/checklist/:itemId')
  updateItem(@CurrentUser() u: User, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateChecklistItemDto) {
    return this.detail.updateItem(u.id, id, itemId, dto);
  }
  @Delete('tasks/:id/checklist/:itemId')
  deleteItem(@CurrentUser() u: User, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.detail.deleteItem(u.id, id, itemId);
  }
  @Post('tasks/:id/attachments')
  attach(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: AttachDto) {
    return this.detail.attach(u.id, id, dto.fileId);
  }
  @Delete('tasks/:id/attachments/:attId')
  @HttpCode(204)
  detach(@CurrentUser() u: User, @Param('id') id: string, @Param('attId') attId: string) {
    return this.detail.detach(u.id, id, attId);
  }
  @Post('tasks/:id/move')
  moveTask(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.backlog.moveTask(u.id, id, dto.status);
  }
}

@Module({
  controllers: [BacklogController, SprintsController],
  providers: [BacklogService, SprintsService, TaskDetailService],
  exports: [BacklogService, SprintsService],
})
export class BacklogModule {}
