import { AREA_IDS, MAX_OPEN_DREAMS, type AreaConquistasDto, type AreaId, type ConquistasDto, type DreamDto } from '@circle/shared';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { Dream, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { ActivityService } from '../xp/activity.service';
import { XpService } from '../xp/xp.service';

const TEXT = { message: 'descreva o sonho (até 300 caracteres)' };

class CreateDreamDto {
  @IsString(TEXT) @MinLength(1, TEXT) @MaxLength(300, TEXT) text!: string;
  @IsIn(AREA_IDS, { message: 'área da vida inválida' }) area!: AreaId;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() imageFileId?: string | null;
}
class UpdateDreamDto {
  @IsOptional() @IsString(TEXT) @MinLength(1, TEXT) @MaxLength(300, TEXT) text?: string;
  @IsOptional() @IsIn(AREA_IDS, { message: 'área da vida inválida' }) area?: AreaId;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() imageFileId?: string | null;
}

@Injectable()
export class DreamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly xp: XpService,
    private readonly activity: ActivityService,
  ) {}

  private async toDto(d: Dream): Promise<DreamDto> {
    const file = d.imageFileId ? await this.prisma.file.findUnique({ where: { id: d.imageFileId } }) : null;
    return {
      id: d.id,
      text: d.text,
      area: d.area,
      imageFileId: d.imageFileId,
      imageUrl: file ? await this.uploads.url(file) : null,
      doneAt: d.doneAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private async own(userId: string, id: string) {
    const d = await this.prisma.dream.findFirst({ where: { id, userId } });
    if (!d) throw new NotFoundException('Sonho não encontrado.');
    return d;
  }

  async list(userId: string) {
    const dreams = await this.prisma.dream.findMany({ where: { userId }, orderBy: [{ doneAt: 'desc' }, { position: 'asc' }, { createdAt: 'desc' }] });
    return Promise.all(dreams.map(d => this.toDto(d)));
  }

  async create(userId: string, dto: CreateDreamDto) {
    const open = await this.prisma.dream.count({ where: { userId, doneAt: null } });
    if (open >= MAX_OPEN_DREAMS) throw new ConflictException(`O quadro guarda até ${MAX_OPEN_DREAMS} sonhos abertos. Realize ou exclua um para abrir espaço.`);
    if (dto.imageFileId) await this.uploads.readyFile(userId, dto.imageFileId, 'dream');
    const d = await this.prisma.dream.create({ data: { userId, text: dto.text.trim(), area: dto.area, imageFileId: dto.imageFileId ?? null } });
    return this.toDto(d);
  }

  async update(userId: string, id: string, dto: UpdateDreamDto) {
    const d = await this.own(userId, id);
    if (dto.imageFileId) await this.uploads.readyFile(userId, dto.imageFileId, 'dream');
    const changedImage = dto.imageFileId !== undefined && dto.imageFileId !== d.imageFileId;
    const updated = await this.prisma.dream.update({ where: { id }, data: { text: dto.text?.trim(), area: dto.area, imageFileId: dto.imageFileId } });
    // A imagem antiga sai do storage quando é trocada ou removida.
    if (changedImage && d.imageFileId) await this.uploads.remove(userId, d.imageFileId).catch(() => undefined);
    return this.toDto(updated);
  }

  async remove(userId: string, id: string) {
    const d = await this.own(userId, id);
    await this.prisma.$transaction(async tx => {
      await this.xp.revoke(tx, userId, 'sonho', id);
      await tx.dream.delete({ where: { id } });
    });
    if (d.imageFileId) await this.uploads.remove(userId, d.imageFileId).catch(() => undefined);
  }

  /** "Realizei": o sonho sai dos abertos e rende +30 XP. */
  async realize(userId: string, id: string) {
    const d = await this.own(userId, id);
    if (d.doneAt) throw new BadRequestException('Esse sonho já foi realizado.');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.dream.update({ where: { id }, data: { doneAt: new Date() } });
      const gained = await this.xp.grant(tx, userId, 'sonho', id);
      await this.activity.add(tx, userId, 'star', `Você realizou um sonho: “${d.text}”`, '/quadro');
      return { dream: await this.toDto(updated), xp: await this.xp.change(tx, userId, gained) };
    });
  }

  /** Minhas conquistas por área: épicos encerrados e iniciativas concluídas. */
  async conquistas(userId: string): Promise<ConquistasDto> {
    const [epics, initiatives, done, total] = await Promise.all([
      // Épico encerrado conta em todas as suas áreas.
      this.prisma.epic.findMany({ where: { userId, closedAt: { not: null } }, select: { area: true, areas: true } }),
      this.prisma.initiative.findMany({ where: { userId, completedAt: { not: null } }, select: { areas: true } }),
      this.prisma.task.count({ where: { userId, status: 'done' } }),
      this.prisma.task.count({ where: { userId } }),
    ]);
    const epicAreasOf = (e: { area: AreaId; areas: AreaId[] }) => (e.areas.length ? e.areas : [e.area]);
    return {
      areas: AREA_IDS.map(area => ({
        area,
        epics: epics.filter(e => epicAreasOf(e).includes(area)).length,
        initiatives: initiatives.filter(i => i.areas.includes(area)).length,
      })),
      tasks: { done, total },
    };
  }

  async areaConquistas(userId: string, area: AreaId): Promise<AreaConquistasDto> {
    if (!(AREA_IDS as readonly string[]).includes(area)) throw new BadRequestException('área da vida inválida');
    const [epics, initiatives] = await Promise.all([
      this.prisma.epic.findMany({ where: { userId, areas: { has: area }, closedAt: { not: null } }, orderBy: { closedAt: 'desc' } }),
      this.prisma.initiative.findMany({ where: { userId, areas: { has: area }, completedAt: { not: null } }, orderBy: { completedAt: 'desc' } }),
    ]);
    return {
      epics: epics.map(e => ({ id: e.id, title: e.title, closedAt: e.closedAt!.toISOString() })),
      initiatives: initiatives.map(i => ({ id: i.id, title: i.title, completedAt: i.completedAt!.toISOString() })),
    };
  }
}

@Controller()
class DreamsController {
  constructor(private readonly dreams: DreamsService) {}

  @Get('dreams')
  list(@CurrentUser() u: User) {
    return this.dreams.list(u.id);
  }
  @Post('dreams')
  create(@CurrentUser() u: User, @Body() dto: CreateDreamDto) {
    return this.dreams.create(u.id, dto);
  }
  @Patch('dreams/:id')
  update(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: UpdateDreamDto) {
    return this.dreams.update(u.id, id, dto);
  }
  @Delete('dreams/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.dreams.remove(u.id, id);
  }
  @Post('dreams/:id/realize')
  realize(@CurrentUser() u: User, @Param('id') id: string) {
    return this.dreams.realize(u.id, id);
  }
  @Get('conquistas')
  conquistas(@CurrentUser() u: User) {
    return this.dreams.conquistas(u.id);
  }
  @Get('conquistas/:area')
  area(@CurrentUser() u: User, @Param('area') area: AreaId) {
    return this.dreams.areaConquistas(u.id, area);
  }
}

@Module({ controllers: [DreamsController], providers: [DreamsService] })
export class DreamsModule {}
