import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SprintsController } from '../sprints/sprints.controller';
import { SprintsService } from '../sprints/sprints.service';
import { MAX_IMPORT_ROWS } from '@circle/shared';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { BacklogIoService } from './backlog-io.service';
import { BacklogService } from './backlog.service';
import { AttachDto, BulkTasksDto, ChecklistItemDto, CreateEpicDto, CreateInitiativeDto, CreateTaskDto, MoveTaskDto, UpdateChecklistItemDto, UpdateEpicDto, UpdateInitiativeDto, UpdateTaskDto } from './dto';
import { TaskDetailService } from './task-detail.service';

/** Uma linha da planilha (todas as colunas como texto). */
class BacklogRowDto {
  @IsString() @MaxLength(200) area!: string;
  @IsString() @MaxLength(200) iniciativa!: string;
  @IsString() @MaxLength(2000) iniciativaDescricao!: string;
  @IsString() @MaxLength(200) epico!: string;
  @IsString() @MaxLength(2000) epicoDescricao!: string;
  @IsString() @MaxLength(300) tarefa!: string;
  @IsString() @MaxLength(4000) tarefaDescricao!: string;
  @IsString() @MaxLength(40) previsao!: string;
  @IsString() @MaxLength(40) status!: string;
  @IsString() @MaxLength(40) prioridade!: string;
  @IsString() @MaxLength(40) master!: string;
}
class BacklogImportDto {
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS, { message: `a planilha pode ter até ${MAX_IMPORT_ROWS} linhas` })
  @ValidateNested({ each: true })
  @Type(() => BacklogRowDto)
  rows!: BacklogRowDto[];
  /** false = só mostra o que vai entrar; true = grava. */
  @IsBoolean() apply!: boolean;
}
/** Nova ordem de uma lista (arrastar-e-soltar), ou voltar para alfabética com `reset`. */
class ReorderDto {
  @IsIn(['initiative', 'epic', 'task']) type!: 'initiative' | 'epic' | 'task';
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) ids!: string[];
  @IsOptional() @IsBoolean() reset?: boolean;
}

/** Exportar e importar o backlog em planilha (modelo do app antigo). */
@Controller('backlog')
class BacklogIoController {
  constructor(private readonly io: BacklogIoService) {}

  @Get('export')
  export(@CurrentUser() u: User) {
    return this.io.export(u.id);
  }
  @Post('import')
  @HttpCode(200)
  import(@CurrentUser() u: User, @Body() dto: BacklogImportDto) {
    return this.io.import(u.id, dto.rows, dto.apply);
  }
}

@Controller()
class BacklogController {
  constructor(
    private readonly backlog: BacklogService,
    private readonly detail: TaskDetailService,
  ) {}

  /** Backlog completo da pessoa logada. */
  @Put('backlog/order')
  reorder(@CurrentUser() u: User, @Body() dto: ReorderDto) {
    return this.backlog.reorder(u.id, dto.type, dto.ids, dto.reset ?? false);
  }
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
  @Post('tasks/:id/calendar')
  addToCalendar(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.addToCalendar(u.id, id);
  }
  @Delete('tasks/:id/calendar')
  removeFromCalendar(@CurrentUser() u: User, @Param('id') id: string) {
    return this.backlog.removeFromCalendar(u.id, id);
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
  /** Ações em massa nas tarefas selecionadas: enviar para a sprint, concluir ou excluir. */
  @Post('tasks/bulk')
  bulkTasks(@CurrentUser() u: User, @Body() dto: BulkTasksDto) {
    return this.backlog.bulkTasks(u.id, dto.ids, dto.action);
  }
}

@Module({
  controllers: [BacklogController, BacklogIoController, SprintsController],
  providers: [BacklogService, SprintsService, TaskDetailService, BacklogIoService],
  exports: [BacklogService, SprintsService],
})
export class BacklogModule {}
