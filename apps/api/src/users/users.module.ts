import { MASLOW_ITEM_KEYS, MAX_OPEN_DREAMS, socialStatus } from '@circle/shared';
import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, Patch, Res } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { CalendarService } from '../calendar/calendar.service';
import { SessionModule } from '../auth/auth.module';
import { SessionService } from '../auth/session.service';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(1, { message: 'informe seu nome' }) @MaxLength(80) name?: string;
  @IsOptional()
  @Matches(/^[a-z0-9._]{3,30}$/, { message: 'o ID usa de 3 a 30 letras minúsculas, números, ponto ou sublinhado' })
  handle?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'a bio pode ter até 300 caracteres' }) bio?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() photoFileId?: string | null;
}

class DeleteAccountDto {
  @IsOptional() @IsString() confirm?: string;
}

const PALETTES =['natureza', 'serenity', 'soft', 'dourado', 'mindful', 'premium'] as const;
class PreferencesDto {
  @IsOptional() @IsIn(PALETTES, { message: 'paleta inválida' }) palette?: (typeof PALETTES)[number];
  @IsOptional() @IsBoolean() randomTheme?: boolean;
  @IsOptional() @IsIn(['auto', 'light', 'dark'], { message: 'aparência inválida' }) themeMode?: 'auto' | 'light' | 'dark';
  @IsOptional() @IsIn(['publico', 'amigos', 'privado'], { message: 'visibilidade inválida' }) defaultPostVisibility?: 'publico' | 'amigos' | 'privado';
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly calendar: CalendarService,
  ) {}

  /** O que o app recebe sobre a pessoa logada. */
  async toMe(user: User) {
    const photo = user.photoFileId ? await this.prisma.file.findUnique({ where: { id: user.photoFileId } }) : null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      handle: user.handle,
      bio: user.bio,
      role: user.role,
      photoUrl: photo ? await this.uploads.url(photo) : null,
      googleConnected: Boolean(user.googleId),
      googleCalendar: { available: this.calendar.available, connected: this.calendar.connected(user) },
      preferences: {
        palette: user.palette,
        randomTheme: user.randomTheme,
        themeMode: user.themeMode,
        defaultPostVisibility: user.defaultPostVisibility,
      },
      xp: { total: user.xpTotal, disponivel: Math.max(0, user.xpTotal - user.xpSpent) },
      /** Passa pela Jornada de primeiro acesso (a aba Jornada fica no lugar do Feed). */
      journey: user.journey,
      /** Rede social aberta ou, na Jornada, quando abre (trava das abas Feed e Grupos). */
      social: socialStatus(user),
      /** Já viu o troféu "Jornada concluída". */
      journeyCelebrated: Boolean(user.journeyCelebratedAt),
      /** Já apertou "Concluir minha jornada" (o XP passa a aparecer e a valer). */
      journeyFinished: Boolean(user.journeyFinishedAt),
    };
  }

  async update(user: User, dto: UpdateMeDto) {
    if (dto.handle && dto.handle !== user.handle) {
      const taken = await this.prisma.user.findUnique({ where: { handle: dto.handle }, select: { id: true } });
      if (taken) throw new ConflictException('Esse ID já está em uso. Escolha outro.');
    }
    if (dto.photoFileId) await this.uploads.readyFile(user.id, dto.photoFileId, 'avatar');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { name: dto.name?.trim(), handle: dto.handle, bio: dto.bio?.trim(), photoFileId: dto.photoFileId },
    });
    // A foto antiga sai do storage quando é trocada ou removida.
    if (dto.photoFileId !== undefined && user.photoFileId && dto.photoFileId !== user.photoFileId) {
      await this.uploads.remove(user.id, user.photoFileId).catch(() => undefined);
    }
    return this.toMe(updated);
  }

  async preferences(user: User, dto: PreferencesDto) {
    return this.toMe(await this.prisma.user.update({ where: { id: user.id }, data: dto }));
  }

  /**
   * Quanto cada ferramenta está sendo usada (0 a 1), para "Seu progresso geral":
   * pirâmide (itens marcados), roda (média das notas), necrológio (texto escrito),
   * quadro (sonhos cadastrados e realizados) e backlog (épicos com 3+ tarefas).
   */
  async usage(userId: string) {
    const [checks, roda, necro, openDreams, doneDreams, epics] = await Promise.all([
      this.prisma.maslowCheck.count({ where: { userId } }),
      this.prisma.rodaScore.findMany({ where: { userId }, select: { score: true } }),
      this.prisma.necrologio.findUnique({ where: { userId }, select: { html: true } }),
      this.prisma.dream.count({ where: { userId, doneAt: null } }),
      this.prisma.dream.count({ where: { userId, doneAt: { not: null } } }),
      this.prisma.epic.findMany({ where: { userId }, select: { _count: { select: { tasks: true } } } }),
    ]);
    const words = (necro?.html ?? '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return {
      maslow: checks / MASLOW_ITEM_KEYS.length,
      roda: roda.length ? roda.reduce((s, r) => s + r.score, 0) / 10 / 10 : 0,
      // Um necrológio de ~300 palavras já conta como completo.
      necrologio: Math.min(1, words / 300),
      quadro: Math.min(1, openDreams / MAX_OPEN_DREAMS + doneDreams / 20),
      backlog: epics.length ? epics.filter(e => e._count.tasks >= 3).length / epics.length : 0,
    };
  }

  /**
   * Exclui a conta e tudo dela: dados (em cascata no banco) e arquivos no storage.
   * Também apaga os convites e códigos do e-mail dela, para um admin poder convidar
   * de novo e a pessoa começar do zero (decisão do dono de 06/11/2026).
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const files = await this.prisma.file.findMany({ where: { userId }, select: { id: true } });
    for (const f of files) await this.uploads.remove(userId, f.id).catch(() => undefined);
    await this.prisma.$transaction([
      this.prisma.invite.deleteMany({ where: { OR: [{ acceptedUserId: userId }, { email: user.email }] } }),
      this.prisma.emailCode.deleteMany({ where: { email: user.email } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}

@Controller('me')
class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly session: SessionService,
  ) {}

  /** Dados da pessoa logada. */
  @Get()
  me(@CurrentUser() user: User) {
    return this.users.toMe(user);
  }

  @Patch()
  update(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    return this.users.update(user, dto);
  }

  @Patch('preferences')
  preferences(@CurrentUser() user: User, @Body() dto: PreferencesDto) {
    return this.users.preferences(user, dto);
  }

  @Get('usage')
  usage(@CurrentUser() user: User) {
    return this.users.usage(user.id);
  }

  /** Excluir minha conta (não dá para desfazer). */
  /** Excluir a conta: a pessoa precisa digitar DELETAR para confirmar (decisão do dono de 04/11/2026). */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Body() dto: DeleteAccountDto, @Res({ passthrough: true }) res: Response) {
    if (dto.confirm?.trim().toUpperCase() !== 'DELETAR') throw new BadRequestException('Digite DELETAR para confirmar a exclusão da conta.');
    await this.users.deleteAccount(user.id);
    this.session.end(res);
  }
}

@Module({ imports: [SessionModule], controllers: [MeController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
