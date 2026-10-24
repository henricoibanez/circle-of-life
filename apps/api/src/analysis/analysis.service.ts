import type { AnalysisContent, AnalysisImportBody, AnalysisLatestDto, AnalysisReportDto, AnalysisSource } from '@circle/shared';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityService } from '../xp/activity.service';
import type { Env } from '../config/env';
import type { AnalysisReport, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { availableSources, buildInput, isArea } from './analysis-input';
import { AiError, AnthropicProvider } from './anthropic-provider';
import { EXAMPLE_REPORT, mockAnalysis } from './mock-provider';

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Análise inteligente: cruza os exercícios escolhidos com o backlog e sugere trilhas. */
@Injectable()
export class AnalysisService {
  private readonly anthropic: AnthropicProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.anthropic = config.get('AI_MODE') === 'anthropic' ? new AnthropicProvider(config.get('ANTHROPIC_API_KEY'), config.get('AI_MODEL')) : null;
  }

  private toDto(r: AnalysisReport): AnalysisReportDto {
    return {
      id: r.id,
      example: false,
      sources: r.sources as AnalysisSource[],
      geral: r.geral,
      visao: r.visao,
      areas: r.areas as AnalysisReportDto['areas'],
      insights: r.insights as AnalysisReportDto['insights'],
      suggestions: r.suggestions as AnalysisReportDto['suggestions'],
      imported: r.imported,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private nextAllowed(last: AnalysisReport | null) {
    const min = this.config.get('AI_MIN_MINUTES');
    if (!last || !min) return null;
    const at = new Date(last.createdAt.getTime() + min * 60_000);
    return at > new Date() ? at : null;
  }

  async latest(user: User): Promise<AnalysisLatestDto> {
    const last = await this.prisma.analysisReport.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    return {
      report: last ? this.toDto(last) : { ...EXAMPLE_REPORT, id: null, example: true, sources: [], imported: [], createdAt: new Date().toISOString() },
      available: await availableSources(this.prisma, user.id),
      mode: this.config.get('AI_MODE'),
      nextAllowedAt: this.nextAllowed(last)?.toISOString() ?? null,
    };
  }

  /** Ajusta o que veio da IA: áreas válidas, percentuais de 0 a 100, listas no tamanho certo. */
  private clean(c: AnalysisContent): AnalysisContent {
    const seen = new Set<string>();
    return {
      geral: clampPct(c.geral),
      visao: c.visao.trim(),
      areas: c.areas.filter(a => isArea(a.area) && !seen.has(a.area) && seen.add(a.area)).map(a => ({ ...a, pct: clampPct(a.pct) })),
      insights: c.insights.slice(0, 3),
      suggestions: c.suggestions
        .slice(0, 3)
        .map(s => ({
          iniciativa: { ...s.iniciativa, areas: s.iniciativa.areas.filter(isArea) },
          epicos: s.epicos.filter(e => isArea(e.area) && e.titulo.trim()).map(e => ({ ...e, tarefas: e.tarefas.filter(t => t.trim()).slice(0, 8) })),
        }))
        .filter(s => s.iniciativa.titulo.trim() && s.epicos.length),
    };
  }

  async generate(user: User, sources: AnalysisSource[]) {
    const available = await availableSources(this.prisma, user.id);
    const chosen = [...new Set(sources)].filter(s => available.includes(s));
    if (!chosen.length) throw new BadRequestException('Escolha pelo menos uma fonte com dados para a análise.');

    const last = await this.prisma.analysisReport.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const wait = this.nextAllowed(last);
    if (wait) {
      const min = Math.ceil((wait.getTime() - Date.now()) / 60_000);
      throw new HttpException(`Você acabou de gerar um relatório. Tente de novo em ${min} ${min === 1 ? 'minuto' : 'minutos'}.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const input = await buildInput(this.prisma, user.id, chosen);
    let content: AnalysisContent;
    if (this.anthropic) {
      try {
        content = await this.anthropic.analyze(input);
      } catch (e) {
        if (e instanceof AiError) throw new HttpException(e.message, HttpStatus.BAD_GATEWAY);
        throw e;
      }
    } else {
      // Pequena espera para a tela de "analisando" se comportar como com a IA de verdade.
      if (this.config.get('NODE_ENV') !== 'test') await new Promise(r => setTimeout(r, 900));
      content = mockAnalysis(input);
    }
    const c = this.clean(content);
    const r = await this.prisma.analysisReport.create({
      data: {
        userId: user.id,
        mode: this.config.get('AI_MODE'),
        sources: chosen,
        geral: c.geral,
        visao: c.visao,
        areas: c.areas,
        insights: c.insights,
        suggestions: c.suggestions,
      },
    });
    await this.activity.add(this.prisma, user.id, 'sparkles', 'Você gerou um novo relatório da análise inteligente', '/analise');
    return this.toDto(r);
  }

  /** Importa a trilha sugerida para o backlog, só com os épicos e tarefas marcados. */
  async importSuggestion(user: User, id: string, index: number, body: AnalysisImportBody) {
    const r = await this.prisma.analysisReport.findFirst({ where: { id, userId: user.id } });
    if (!r) throw new NotFoundException('Relatório não encontrado.');
    const s = (r.suggestions as AnalysisContent['suggestions'])[index];
    if (!s) throw new NotFoundException('Sugestão não encontrada.');
    const epicos = body.epicos
      .filter(e => s.epicos[e.index])
      .map(e => ({ ...s.epicos[e.index]!, tarefas: [...new Set(e.tarefas)].map(i => s.epicos[e.index]!.tarefas[i]).filter((t): t is string => Boolean(t)) }));
    if (!epicos.length) throw new BadRequestException('Marque pelo menos um épico.');

    return this.prisma.$transaction(async tx => {
      const position = await tx.initiative.count({ where: { userId: user.id } });
      const ini = await tx.initiative.create({
        data: { userId: user.id, title: s.iniciativa.titulo, description: s.iniciativa.descricao, areas: [...new Set([...s.iniciativa.areas, ...epicos.map(e => e.area)])], source: 'ia', position },
      });
      for (const [i, e] of epicos.entries()) {
        await tx.epic.create({
          data: {
            userId: user.id,
            initiativeId: ini.id,
            title: e.titulo,
            area: e.area,
            position: i,
            tasks: { create: e.tarefas.map((t, j) => ({ userId: user.id, title: t, position: j, logs: { create: { text: 'Criada a partir da análise inteligente' } } })) },
          },
        });
      }
      await tx.analysisReport.update({ where: { id }, data: { imported: [...new Set([...r.imported, index])] } });
      await this.activity.add(tx, user.id, 'sparkles', `Você importou a sugestão “${s.iniciativa.titulo}” da análise`, '/backlog');
      return { initiativeId: ini.id, epics: epicos.length, tasks: epicos.reduce((n, e) => n + e.tarefas.length, 0) };
    });
  }
}
