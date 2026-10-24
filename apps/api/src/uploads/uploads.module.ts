import { Body, Controller, Delete, Global, HttpCode, Module, Param, Post } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { FilePurpose, User } from '../generated/prisma/client';
import { IMAGE_TYPES, UploadsService } from './uploads.service';

const PURPOSES: FilePurpose[] = ['avatar', 'dream', 'task', 'post', 'story', 'group', 'trilha'];

class CreateUploadDto {
  @IsIn(PURPOSES, { message: 'finalidade do arquivo inválida' }) purpose!: FilePurpose;
  @IsIn(Object.keys(IMAGE_TYPES), { message: 'envie uma imagem (JPG, PNG, WEBP ou GIF)' }) mime!: string;
  @IsInt() @IsPositive() size!: number;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
}

@Controller('uploads')
class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Pede uma URL temporária para enviar uma imagem direto ao storage. */
  @Post()
  create(@CurrentUser() u: User, @Body() dto: CreateUploadDto) {
    return this.uploads.create(u.id, dto.purpose, dto.mime, dto.size, dto.name ?? '');
  }

  /** Confirma que o envio terminou. */
  @Post(':id/confirm')
  confirm(@CurrentUser() u: User, @Param('id') id: string) {
    return this.uploads.confirm(u.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.uploads.remove(u.id, id);
  }
}

@Global()
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
