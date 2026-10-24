import { AREA_IDS, type AreaId } from '@circle/shared';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const TITLE = { message: 'o nome precisa ter entre 1 e 120 caracteres' };
const AREA_MSG = { message: 'área da vida inválida' };

export class CreateInitiativeDto {
  @IsString(TITLE) @MinLength(1, TITLE) @MaxLength(120, TITLE) title!: string;
  @IsOptional() @IsString() @MaxLength(2000, { message: 'a descrição pode ter até 2.000 caracteres' }) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsIn(AREA_IDS, { each: true, ...AREA_MSG }) areas?: AreaId[];
  @IsOptional() @IsBoolean() isMaster?: boolean;
}
export class UpdateInitiativeDto {
  @IsOptional() @IsString(TITLE) @MinLength(1, TITLE) @MaxLength(120, TITLE) title?: string;
  @IsOptional() @IsString() @MaxLength(2000, { message: 'a descrição pode ter até 2.000 caracteres' }) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsIn(AREA_IDS, { each: true, ...AREA_MSG }) areas?: AreaId[];
  @IsOptional() @IsBoolean() isMaster?: boolean;
}

export class CreateEpicDto {
  @IsString({ message: 'escolha a iniciativa' }) initiativeId!: string;
  @IsString(TITLE) @MinLength(1, TITLE) @MaxLength(120, TITLE) title!: string;
  @IsOptional() @IsString() @MaxLength(2000, { message: 'a descrição pode ter até 2.000 caracteres' }) description?: string;
  @IsIn(AREA_IDS, AREA_MSG) area!: AreaId;
}
export class UpdateEpicDto {
  @IsOptional() @IsString() initiativeId?: string;
  @IsOptional() @IsString(TITLE) @MinLength(1, TITLE) @MaxLength(120, TITLE) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(AREA_IDS, AREA_MSG) area?: AreaId;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ['alta', 'media', 'baixa'] as const;
const STATUSES = ['backlog', 'todo', 'doing', 'done'] as const;

export class CreateTaskDto {
  @IsString({ message: 'escolha o épico' }) epicId!: string;
  @IsString(TITLE) @MinLength(1, TITLE) @MaxLength(120, TITLE) title!: string;
  @IsOptional() @IsString() @MaxLength(4000, { message: 'a descrição pode ter até 4.000 caracteres' }) description?: string;
  @IsOptional() @IsIn(PRIORITIES, { message: 'prioridade inválida' }) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(DATE, { message: 'data inválida' }) dueDate?: string | null;
  /** Onde colocar: no backlog ou já na sprint atual (A Fazer). */
  @IsOptional() @IsIn(['backlog', 'todo'], { message: 'escolha backlog ou sprint atual' }) status?: 'backlog' | 'todo';
}
export class UpdateTaskDto {
  @IsOptional() @IsString() epicId?: string;
  @IsOptional() @IsString(TITLE) @MinLength(1, TITLE) @MaxLength(120, TITLE) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsIn(PRIORITIES, { message: 'prioridade inválida' }) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(DATE, { message: 'data inválida' }) dueDate?: string | null;
}
export class MoveTaskDto {
  @IsIn(STATUSES, { message: 'status inválido' }) status!: (typeof STATUSES)[number];
}

export class ChecklistItemDto {
  @IsString({ message: 'escreva o item' }) @MinLength(1, { message: 'escreva o item' }) @MaxLength(200, { message: 'o item pode ter até 200 caracteres' }) text!: string;
}
export class UpdateChecklistItemDto {
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) text?: string;
}
export class AttachDto {
  @IsString({ message: 'envie a imagem antes de anexar' }) fileId!: string;
}
