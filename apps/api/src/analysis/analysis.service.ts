import type { AnalysisContent, AnalysisImportBody, AnalysisLatestDto, AnalysisReportDto, AnalysisSource, AnalysisSuggestion, AreaId } from '@circle/shared';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTasksInBulk } from '../backlog/bulk-tasks';
import { ActivityService } from '../xp/activity.service';
import type { Env } from '../config/env';
import type { AnalysisReport, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiError, AflProvider } from './afl-provider';
import { availableSources, buildInput, isArea } from './analysis-input';
import { anonymizer, mapStrings, PERSON } from './anonymize';
import { EXAMPLE_REPORT, mockAnalysis } from './mock-provider';

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const DAY = 86_400_000;

/** Parte do relatório novo guardada na coluna "details". */
type Details = Pick<AnalysisContent, 'padroes' | 'gaps' | 'manter' | 'ajustar' | 'abandonar' | 'proximos7dias' | 'limitantes' | 'pergunta' | 'cuidado'>;
/** Sugestão como era guardada nos relatórios antigos (épico com uma área, tarefas só com título). */
type OldSuggestion = { iniciativa: { titulo: string; descricao: string; areas: AreaId[] }; epicos: { titulo: string; area: AreaId; tarefas: string[] }[] };

/** Lê a sugestão no formato novo, convertendo as dos relatórios antigos. */
function toSuggestion(s: AnalysisSuggestion | OldSuggestion): AnalysisSuggestion {
  return {
    iniciativa: { porque: '', ...s.iniciativa },
    epicos: s.epicos.map(e => ({
      titulo: e.titulo,
      areas: 'areas' in e ? e.areas : [e.area],
      tarefas: e.tarefas.map(t => (typeof t === 'string' ? { titulo: t, descricao: '' } : t)),
    })),
  };
}

/** "Me analise": cruza os exercícios escolhidos com o backlog e sugere trilhas. */
@Injectable()
export class AnalysisService {
  private readonly afl: AflProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.afl = config.get('AI_MODE') === 'afl' ? new AflProvider(config.get('AFL_API_URL'), config.get('AFL_API_KEY'), config.get('AFL_AGENT_ID')) : null;
  }

  private toDto(r: AnalysisReport): AnalysisReportDto {
    const d = r.details as Details | null;
    // Relatórios antigos (antes de 05/11/2026) não têm "details": os insights viram os padrões.
    const old = (r.insights as { titulo: string; texto: string }[]).map(i => ({ titulo: i.titulo, texto: i.texto }));
    return {
      id: r.id,
      example: false,
      sources: r.sources as AnalysisSource[],
      retrato: r.visao,
      geral: r.geral,
      padroes: d?.padroes ?? old,
      gaps: d?.gaps ?? [],
      manter: d?.manter ?? [],
      ajustar: d?.ajustar ?? [],
      abandonar: d?.abandonar ?? [],
      proximos7dias: d?.proximos7dias ?? [],
      limitantes: d?.limitantes ?? [],
      pergunta: d?.pergunta ?? '',
      cuidado: d?.cuidado ?? '',
      sugestoes: (r.suggestions as (AnalysisSuggestion | OldSuggestion)[]).map(toSuggestion),
      imported: r.imported,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /**
   * Uma análise a cada AI_INTERVAL_DAYS dias (decisão do dono: uma por mês). Tentativa que falha não conta.
   * Administradores não têm limite (decisão do dono de 05/11/2026).
   */
  private nextAllowed(user: User, last: AnalysisReport | null) {
    const days = this.config.get('AI_INTERVAL_DAYS');
    if (!last || !days || user.role === 'admin') return null;
    const at = new Date(last.createdAt.getTime() + days * DAY);
    return at > new Date() ? at : null;
  }

  async latest(user: User): Promise<AnalysisLatestDto> {
    const last = await this.prisma.analysisReport.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    return {
      report: last ? this.toDto(last) : { ...EXAMPLE_REPORT, id: null, example: true, sources: [], imported: [], createdAt: new Date().toISOString() },
      available: await availableSources(this.prisma, user.id),
      mode: this.config.get('AI_MODE'),
      nextAllowedAt: this.nextAllowed(user, last)?.toISOString() ?? null,
    };
  }

  /** Ajusta o que veio da IA: áreas válidas, percentual de 0 a 100, listas no tamanho certo, nada vazio. */
  private clean(c: AnalysisContent): AnalysisContent {
    const filled = (s: string) => s.trim().length > 0;
    const areas = (list: string[]) => [...new Set(list.filter(isArea))];
    return {
      retrato: c.retrato.trim(),
      geral: clampPct(c.geral),
      padroes: c.padroes.filter(p => filled(p.titulo) || filled(p.texto)).slice(0, 5),
      gaps: c.gaps.filter(p => filled(p.titulo) || filled(p.texto)).slice(0, 5),
      manter: c.manter.filter(filled).slice(0, 5),
      ajustar: c.ajustar.filter(filled).slice(0, 5),
      abandonar: c.abandonar.filter(filled).slice(0, 5),
      proximos7dias: c.proximos7dias.filter(filled).slice(0, 5),
      limitantes: c.limitantes.filter(l => filled(l.nome) || filled(l.texto)).slice(0, 4),
      pergunta: c.pergunta.trim(),
      cuidado: c.cuidado.trim(),
      sugestoes: c.sugestoes
        .slice(0, 4)
        .map(s => {
          const epicos = s.epicos
            .map(e => ({ titulo: e.titulo.trim(), areas: areas(e.areas), tarefas: e.tarefas.filter(t => filled(t.titulo)).slice(0, 8) }))
            .filter(e => e.titulo && e.areas.length)
            .slice(0, 4);
          const ini = areas(s.iniciativa.areas);
          return { iniciativa: { ...s.iniciativa, areas: ini.length ? ini : areas(epicos.flatMap(e => e.areas)) }, epicos };
        })
        .filter(s => s.iniciativa.titulo.trim() && s.epicos.length),
    };
  }

  async generate(user: User, sources: AnalysisSource[]) {
    const available = await availableSources(this.prisma, user.id);
    const chosen = [...new Set(sources)].filter(s => available.includes(s));
    if (!chosen.length) throw new BadRequestException('Escolha pelo menos uma fonte com dados para a análise.');

    const last = await this.prisma.analysisReport.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const wait = this.nextAllowed(user, last);
    if (wait) {
      const when = wait.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: user.timezone || 'America/Sao_Paulo' });
      throw new HttpException(`Você pode gerar uma análise por mês. A próxima fica disponível em ${when}.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const real = await buildInput(this.prisma, user.id, user.name, chosen);
    // A IA não recebe o nome nem e-mails, links, CPFs e telefones (ver anonymize.ts).
    const input = mapStrings(real, anonymizer(user.name));
    let content: AnalysisContent;
    if (this.afl) {
      try {
        content = await this.afl.analyze(input);
      } catch (e) {
        if (e instanceof AiError) throw new HttpException(e.message, HttpStatus.BAD_GATEWAY);
        throw e;
      }
    } else {
      // Pequena espera para a tela de "analisando" se comportar como com a IA de verdade.
      if (this.config.get('NODE_ENV') !== 'test') await new Promise(r => setTimeout(r, 900));
      content = mockAnalysis(input);
    }
    const c = this.clean(mapStrings(content, s => s.replaceAll(PERSON, real.nome || 'Você')));
    if (!c.retrato) throw new HttpException('A IA respondeu num formato inesperado. Tente de novo.', HttpStatus.BAD_GATEWAY);
    const { retrato, geral, sugestoes, ...details } = c;
    const r = await this.prisma.analysisReport.create({
      data: { userId: user.id, mode: this.config.get('AI_MODE'), sources: chosen, geral, visao: retrato, areas: [], insights: [], details, suggestions: sugestoes },
    });
    await this.activity.add(this.prisma, user.id, 'sparkles', 'Você gerou uma nova análise da sua vida', '/analise');
    return this.toDto(r);
  }

  /** Importa a trilha sugerida para o backlog, só com os épicos e tarefas marcados. */
  async importSuggestion(user: User, id: string, index: number, body: AnalysisImportBody) {
    const r = await this.prisma.analysisReport.findFirst({ where: { id, userId: user.id } });
    if (!r) throw new NotFoundException('Relatório não encontrado.');
    const raw = (r.suggestions as (AnalysisSuggestion | OldSuggestion)[])[index];
    if (!raw) throw new NotFoundException('Sugestão não encontrada.');
    const s = toSuggestion(raw);
    const epicos = body.epicos
      .filter(e => s.epicos[e.index])
      .map(e => ({ ...s.epicos[e.index]!, tarefas: [...new Set(e.tarefas)].map(i => s.epicos[e.index]!.tarefas[i]).filter(t => t !== undefined) }));
    if (!epicos.length) throw new BadRequestException('Marque pelo menos um épico.');

    const descricao = [s.iniciativa.descricao, s.iniciativa.porque && `Por que é importante: ${s.iniciativa.porque}`].filter(Boolean).join('\n\n');
    return this.prisma.$transaction(async tx => {
      const position = await tx.initiative.count({ where: { userId: user.id } });
      const ini = await tx.initiative.create({
        data: { userId: user.id, title: s.iniciativa.titulo, description: descricao, areas: [...new Set([...s.iniciativa.areas, ...epicos.flatMap(e => e.areas)])], source: 'ia', position },
      });
      for (const [i, e] of epicos.entries()) {
        const epic = await tx.epic.create({ data: { userId: user.id, initiativeId: ini.id, title: e.titulo, area: e.areas[0]!, areas: e.areas, position: i } });
        await createTasksInBulk(
          tx,
          epic.id,
          e.tarefas.map((t, j) => ({ userId: user.id, title: t.titulo, description: t.descricao, position: j })),
          'Criada a partir da análise inteligente',
        );
      }
      await tx.analysisReport.update({ where: { id }, data: { imported: [...new Set([...r.imported, index])] } });
      await this.activity.add(tx, user.id, 'sparkles', `Você importou a sugestão “${s.iniciativa.titulo}” da análise`, '/backlog');
      return { initiativeId: ini.id, epics: epicos.length, tasks: epicos.reduce((n, e) => n + e.tarefas.length, 0) };
    });
  }
}
