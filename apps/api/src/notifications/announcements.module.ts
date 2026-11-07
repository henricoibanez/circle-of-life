import { GEMS, type ReleaseDto, SURVEY_EVERY_DAYS, type SurveyDto, type SurveyResultDto } from '@circle/shared';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminOnly, CurrentUser } from '../common/decorators';
import type { Release, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from '../xp/xp.service';
import { NotificationsService } from './notifications.service';

const DAY = 86_400_000;

class ReleaseInput {
  @IsString() @MinLength(1, { message: 'informe a versão' }) @MaxLength(20) version!: string;
  @IsString() @MinLength(1, { message: 'informe o título' }) @MaxLength(120) title!: string;
  @IsString() @MinLength(1, { message: 'escreva o que mudou' }) @MaxLength(5000) body!: string;
}
class SurveyInput {
  @IsString() @MinLength(3, { message: 'escreva a pergunta' }) @MaxLength(200) question!: string;
}
class AnswerInput {
  @IsInt() @Min(1, { message: 'a nota vai de 1 a 5' }) @Max(5, { message: 'a nota vai de 1 a 5' }) score!: number;
  @IsOptional() @IsString() @MaxLength(1000, { message: 'o comentário pode ter até 1.000 caracteres' }) comment?: string;
}

/** Quem recebe novidades e pesquisas: todo mundo fora da Jornada (decisão do dono de 07/11/2026). */
const OUTSIDE_JOURNEY = { OR: [{ journey: false }, { journeyFinishedAt: { not: null } }] };

const releaseDto = (r: Release): ReleaseDto => ({
  id: r.id,
  version: r.version,
  title: r.title,
  body: r.body,
  publishedAt: r.publishedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Novidades (etapa 5) e pesquisas rápidas (etapa 6). O admin escreve um rascunho e publica;
 * ao publicar, o aviso sai na hora para quem está fora da Jornada (sem contar no limite diário).
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly xp: XpService,
  ) {}

  // ---------- Novidades ----------

  async releases() {
    return (await this.prisma.release.findMany({ orderBy: { createdAt: 'desc' } })).map(releaseDto);
  }

  createRelease(userId: string, dto: ReleaseInput) {
    return this.prisma.release.create({ data: { ...this.cleanRelease(dto), createdById: userId } }).then(releaseDto);
  }

  async updateRelease(id: string, dto: ReleaseInput) {
    await this.draftRelease(id);
    return releaseDto(await this.prisma.release.update({ where: { id }, data: this.cleanRelease(dto) }));
  }

  async removeRelease(id: string) {
    await this.draftRelease(id);
    await this.prisma.release.delete({ where: { id } });
  }

  /** Publica e avisa todo mundo fora da Jornada. Devolve quantas pessoas receberam. */
  async publishRelease(id: string) {
    const r = await this.draftRelease(id);
    const { count } = await this.prisma.release.updateMany({ where: { id, publishedAt: null }, data: { publishedAt: new Date() } });
    if (!count) throw new BadRequestException('Essa novidade já foi publicada.');
    const users = await this.prisma.user.findMany({ where: OUTSIDE_JOURNEY, select: { id: true } });
    const notified = await this.notifications.broadcast(
      users.map(u => u.id),
      { type: 'novidade', title: `Novidades da versão ${r.version}`, body: r.title, link: `/novidades/${r.id}`, refId: r.id, key: `novidade:${r.id}` },
    );
    return { ...releaseDto((await this.prisma.release.findUnique({ where: { id } }))!), notified };
  }

  async release(id: string) {
    const r = await this.prisma.release.findFirst({ where: { id, publishedAt: { not: null } } });
    if (!r) throw new NotFoundException('Novidade não encontrada.');
    return releaseDto(r);
  }

  private cleanRelease(dto: ReleaseInput) {
    return { version: dto.version.trim(), title: dto.title.trim(), body: dto.body.replace(/\r\n/g, '\n').trim() };
  }

  private async draftRelease(id: string) {
    const r = await this.prisma.release.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Novidade não encontrada.');
    if (r.publishedAt) throw new BadRequestException('Novidade publicada não pode mais ser mudada.');
    return r;
  }

  // ---------- Pesquisas ----------

  async surveys(): Promise<SurveyResultDto[]> {
    const list = await this.prisma.survey.findMany({ orderBy: { createdAt: 'desc' }, include: { responses: { orderBy: { createdAt: 'desc' } } } });
    const sent = await Promise.all(list.map(s => this.prisma.notificationLog.count({ where: { key: `pesquisa:${s.id}` } })));
    return list.map((s, i) => {
      const counts = [1, 2, 3, 4, 5].map(n => s.responses.filter(r => r.score === n).length);
      const total = s.responses.length;
      return {
        id: s.id,
        question: s.question,
        publishedAt: s.publishedAt?.toISOString() ?? null,
        closedAt: s.closedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        sent: sent[i]!,
        responses: total,
        average: total ? Math.round((s.responses.reduce((a, r) => a + r.score, 0) / total) * 10) / 10 : null,
        counts,
        // Sem nomes: as respostas são analisadas em conjunto.
        comments: s.responses.filter(r => r.comment).map(r => ({ score: r.score, comment: r.comment, createdAt: r.createdAt.toISOString() })),
      };
    });
  }

  async createSurvey(userId: string, dto: SurveyInput) {
    const s = await this.prisma.survey.create({ data: { question: dto.question.trim(), createdById: userId } });
    return { id: s.id };
  }

  async removeSurvey(id: string) {
    const s = await this.prisma.survey.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Pesquisa não encontrada.');
    if (s.publishedAt) throw new BadRequestException('Pesquisa publicada não pode ser apagada. Encerre-a.');
    await this.prisma.survey.delete({ where: { id } });
  }

  /** Publica: vai para quem está fora da Jornada e não recebeu pesquisa nos últimos 30 dias. */
  async publishSurvey(id: string, now = new Date()) {
    const s = await this.prisma.survey.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Pesquisa não encontrada.');
    const { count } = await this.prisma.survey.updateMany({ where: { id, publishedAt: null }, data: { publishedAt: now } });
    if (!count) throw new BadRequestException('Essa pesquisa já foi publicada.');
    const users = await this.prisma.user.findMany({
      where: { ...OUTSIDE_JOURNEY, notificationLog: { none: { type: 'pesquisa', sentAt: { gte: new Date(now.getTime() - SURVEY_EVERY_DAYS * DAY) } } } },
      select: { id: true },
    });
    const sent = await this.notifications.broadcast(
      users.map(u => u.id),
      {
        type: 'pesquisa',
        title: 'Pesquisa rápida',
        body: `${s.question} Responda e ganhe ${GEMS.pesquisa} círculos.`,
        link: `/pesquisa/${s.id}`,
        refId: s.id,
        key: `pesquisa:${s.id}`,
      },
      now,
    );
    return { sent };
  }

  async closeSurvey(id: string) {
    const { count } = await this.prisma.survey.updateMany({ where: { id, closedAt: null }, data: { closedAt: new Date() } });
    if (!count) throw new NotFoundException('Pesquisa não encontrada ou já encerrada.');
  }

  /** A pesquisa como a pessoa vê. Só quem recebeu a pesquisa pode ver e responder. */
  async survey(userId: string, id: string): Promise<SurveyDto> {
    const s = await this.received(userId, id);
    const r = s.responses[0];
    return { id: s.id, question: s.question, open: !s.closedAt, answer: r ? { score: r.score, comment: r.comment } : null };
  }

  /** Responde (ou muda a resposta). Responder a primeira vez rende círculos (uma vez por pesquisa). */
  async answer(userId: string, id: string, dto: AnswerInput) {
    const s = await this.received(userId, id);
    if (s.closedAt) throw new BadRequestException('Essa pesquisa já foi encerrada. Obrigado mesmo assim!');
    const comment = dto.comment?.trim();
    const gems = await this.prisma.$transaction(async tx => {
      await tx.surveyResponse.upsert({
        where: { surveyId_userId: { surveyId: id, userId } },
        create: { surveyId: id, userId, score: dto.score, comment: comment ?? '' },
        update: { score: dto.score, ...(comment !== undefined ? { comment } : {}) },
      });
      return this.xp.grantGems(tx, userId, 'pesquisa', id, GEMS.pesquisa);
    });
    return { survey: await this.survey(userId, id), gemsGained: gems };
  }

  private async received(userId: string, id: string) {
    const [s, log] = await Promise.all([
      this.prisma.survey.findFirst({ where: { id, publishedAt: { not: null } }, include: { responses: { where: { userId } } } }),
      this.prisma.notificationLog.findUnique({ where: { userId_key: { userId, key: `pesquisa:${id}` } } }),
    ]);
    if (!s || !log) throw new NotFoundException('Pesquisa não encontrada.');
    return s;
  }
}

@Controller()
class AnnouncementsController {
  constructor(private readonly a: AnnouncementsService) {}

  // ----- Pessoa -----
  @Get('releases/:id')
  release(@Param('id') id: string) {
    return this.a.release(id);
  }
  @Get('surveys/:id')
  survey(@CurrentUser() u: User, @Param('id') id: string) {
    return this.a.survey(u.id, id);
  }
  @Post('surveys/:id/answer')
  answer(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: AnswerInput) {
    return this.a.answer(u.id, id, dto);
  }

  // ----- Admin: novidades -----
  @AdminOnly()
  @Get('admin/releases')
  releases() {
    return this.a.releases();
  }
  @AdminOnly()
  @Post('admin/releases')
  createRelease(@CurrentUser() u: User, @Body() dto: ReleaseInput) {
    return this.a.createRelease(u.id, dto);
  }
  @AdminOnly()
  @Patch('admin/releases/:id')
  updateRelease(@Param('id') id: string, @Body() dto: ReleaseInput) {
    return this.a.updateRelease(id, dto);
  }
  @AdminOnly()
  @Delete('admin/releases/:id')
  @HttpCode(204)
  removeRelease(@Param('id') id: string) {
    return this.a.removeRelease(id);
  }
  @AdminOnly()
  @Post('admin/releases/:id/publish')
  publishRelease(@Param('id') id: string) {
    return this.a.publishRelease(id);
  }

  // ----- Admin: pesquisas -----
  @AdminOnly()
  @Get('admin/surveys')
  surveys() {
    return this.a.surveys();
  }
  @AdminOnly()
  @Post('admin/surveys')
  createSurvey(@CurrentUser() u: User, @Body() dto: SurveyInput) {
    return this.a.createSurvey(u.id, dto);
  }
  @AdminOnly()
  @Delete('admin/surveys/:id')
  @HttpCode(204)
  removeSurvey(@Param('id') id: string) {
    return this.a.removeSurvey(id);
  }
  @AdminOnly()
  @Post('admin/surveys/:id/publish')
  publishSurvey(@Param('id') id: string) {
    return this.a.publishSurvey(id);
  }
  @AdminOnly()
  @Post('admin/surveys/:id/close')
  @HttpCode(204)
  closeSurvey(@Param('id') id: string) {
    return this.a.closeSurvey(id);
  }
}

@Module({ controllers: [AnnouncementsController], providers: [AnnouncementsService] })
export class AnnouncementsModule {}
