import { AREA_IDS, type AreaId, TRILHA_CATEGORY_IDS, type TrilhaCategory } from '@circle/shared';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { TrilhasService } from './trilhas.service';

class PublishDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120, { message: 'o nome pode ter até 120 caracteres' }) title?: string;
  @IsString() @MinLength(10, { message: 'conte em pelo menos 10 caracteres para quem é a trilha' }) @MaxLength(600, { message: 'a descrição pode ter até 600 caracteres' })
  description!: string;
  @IsIn(TRILHA_CATEGORY_IDS, { message: 'categoria inválida' }) category!: TrilhaCategory;
  @IsInt({ message: 'o preço precisa ser um número inteiro' }) @Min(0) @Max(100_000) priceGems!: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() coverFileId?: string | null;
  /** Grupo onde publicar (vazio = loja). */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() groupId?: string | null;
}
class EditDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120, { message: 'o nome pode ter até 120 caracteres' }) title?: string;
  @IsOptional() @IsString() @MaxLength(600, { message: 'a descrição pode ter até 600 caracteres' }) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(AREA_IDS.length) @IsIn(AREA_IDS, { each: true, message: 'área inválida' }) areas?: AreaId[];
  @IsOptional() @IsArray() @ArrayMaxSize(100, { message: 'a trilha pode ter até 100 tarefas' }) @IsString({ each: true }) @MaxLength(200, { each: true, message: 'cada tarefa pode ter até 200 caracteres' })
  tasks?: string[];
}
/** Onde o épico entra: numa iniciativa sua (initiativeId) ou numa nova (newInitiative = nome). */
class ImportDto {
  @IsOptional() @IsString() initiativeId?: string;
  @IsOptional() @IsString() @MaxLength(200, { message: 'o nome pode ter até 200 caracteres' }) newInitiative?: string;
}
class RejectDto {
  @IsOptional() @IsString() @MaxLength(500, { message: 'o motivo pode ter até 500 caracteres' }) reason?: string;
}

@Controller()
class TrilhasController {
  constructor(private readonly trilhas: TrilhasService) {}

  @Get('trilhas')
  list(@CurrentUser() u: User, @Query('q') q?: string, @Query('category') category?: string) {
    return this.trilhas.list(u, q, category);
  }
  @Get('trilhas/mine')
  mine(@CurrentUser() u: User) {
    return this.trilhas.mine(u);
  }
  @Get('trilhas/:id')
  detail(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.detail(u, id);
  }
  @Post('epics/:id/publish')
  publish(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: PublishDto) {
    return this.trilhas.publish(u, id, dto);
  }
  /** Admin do app (loja) ou gestor do grupo (trilha de grupo): a regra fica no serviço. */
  @Post('trilhas/:id/approve')
  approve(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.approve(u, id);
  }
  @Post('trilhas/:id/reject')
  @HttpCode(204)
  reject(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.trilhas.reject(u, id, dto.reason);
  }
  @Post('trilhas/:id/unpublish')
  @HttpCode(204)
  unpublish(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.unpublish(u, id);
  }
  @Patch('trilhas/:id')
  edit(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: EditDto) {
    return this.trilhas.edit(u, id, dto);
  }
  @Post('trilhas/:id/import')
  import(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: ImportDto) {
    if (dto.initiativeId) return this.trilhas.import(u, id, { initiativeId: dto.initiativeId });
    if (dto.newInitiative?.trim()) return this.trilhas.import(u, id, { newInitiative: dto.newInitiative });
    throw new BadRequestException('Escolha uma iniciativa ou dê nome a uma nova.');
  }
  @Put('trilhas/:id/favorite')
  @HttpCode(204)
  fav(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.favorite(u, id, true);
  }
  @Delete('trilhas/:id/favorite')
  @HttpCode(204)
  unfav(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.favorite(u, id, false);
  }
}

@Module({ controllers: [TrilhasController], providers: [TrilhasService], exports: [TrilhasService] })
export class TrilhasModule {}
