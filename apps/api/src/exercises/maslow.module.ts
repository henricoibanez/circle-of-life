import { MASLOW_ITEM_KEYS, type MaslowDto, type MaslowLevelId } from '@circle/shared';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const LEVELS: MaslowLevelId[] = ['aut', 'est', 'soc', 'seg', 'fis'];

class CheckDto {
  @IsBoolean() checked!: boolean;
}
class NoteDto {
  @IsIn(LEVELS, { message: 'nível inválido' }) level!: MaslowLevelId;
  @IsString() @MinLength(1, { message: 'escreva a reflexão' }) @MaxLength(1000, { message: 'a reflexão pode ter até 1.000 caracteres' }) text!: string;
}

@Injectable()
export class MaslowService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<MaslowDto> {
    const [checks, notes] = await Promise.all([
      this.prisma.maslowCheck.findMany({ where: { userId }, select: { itemKey: true } }),
      this.prisma.maslowNote.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      checks: checks.map(c => c.itemKey),
      notes: notes.map(n => ({ id: n.id, level: n.level as MaslowLevelId, text: n.text, createdAt: n.createdAt.toISOString() })),
    };
  }

  async setCheck(userId: string, itemKey: string, checked: boolean) {
    if (!MASLOW_ITEM_KEYS.includes(itemKey)) throw new BadRequestException('Item da pirâmide inválido.');
    if (checked) await this.prisma.maslowCheck.upsert({ where: { userId_itemKey: { userId, itemKey } }, create: { userId, itemKey }, update: {} });
    else await this.prisma.maslowCheck.deleteMany({ where: { userId, itemKey } });
    return this.get(userId);
  }

  async addNote(userId: string, level: MaslowLevelId, text: string) {
    await this.prisma.maslowNote.create({ data: { userId, level, text: text.trim() } });
    return this.get(userId);
  }

  async deleteNote(userId: string, id: string) {
    const r = await this.prisma.maslowNote.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException('Reflexão não encontrada.');
  }
}

@Controller('maslow')
class MaslowController {
  constructor(private readonly maslow: MaslowService) {}

  @Get()
  get(@CurrentUser() u: User) {
    return this.maslow.get(u.id);
  }
  @Put('checks/:itemKey')
  check(@CurrentUser() u: User, @Param('itemKey') itemKey: string, @Body() dto: CheckDto) {
    return this.maslow.setCheck(u.id, itemKey, dto.checked);
  }
  @Post('notes')
  addNote(@CurrentUser() u: User, @Body() dto: NoteDto) {
    return this.maslow.addNote(u.id, dto.level, dto.text);
  }
  @Delete('notes/:id')
  @HttpCode(204)
  deleteNote(@CurrentUser() u: User, @Param('id') id: string) {
    return this.maslow.deleteNote(u.id, id);
  }
}

@Module({ controllers: [MaslowController], providers: [MaslowService], exports: [MaslowService] })
export class MaslowModule {}
