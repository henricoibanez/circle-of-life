import { TRILHA_CATEGORY_IDS, type TrilhaCategory } from '@circle/shared';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AdminOnly, CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { TrilhasService } from './trilhas.service';

class PublishDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120, { message: 'o nome pode ter até 120 caracteres' }) title?: string;
  @IsString() @MinLength(10, { message: 'conte em pelo menos 10 caracteres para quem é a trilha' }) @MaxLength(600, { message: 'a descrição pode ter até 600 caracteres' })
  description!: string;
  @IsIn(TRILHA_CATEGORY_IDS, { message: 'categoria inválida' }) category!: TrilhaCategory;
  @IsInt({ message: 'o preço precisa ser um número inteiro' }) @Min(0) @Max(100_000) priceXp!: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() coverFileId?: string | null;
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
  @Post('initiatives/:id/publish')
  publish(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: PublishDto) {
    return this.trilhas.publish(u, id, dto);
  }
  @AdminOnly()
  @Post('trilhas/:id/approve')
  approve(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.approve(u, id);
  }
  @AdminOnly()
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
  @Post('trilhas/:id/import')
  import(@CurrentUser() u: User, @Param('id') id: string) {
    return this.trilhas.import(u, id);
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
