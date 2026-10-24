import Anthropic from '@anthropic-ai/sdk';
import { AREA_IDS, type AnalysisContent } from '@circle/shared';
import { z } from 'zod';
import type { AnalysisInput } from './analysis-input';

/** Erro com mensagem que pode ser mostrada para a pessoa. */
export class AiError extends Error {}

const area = z.enum(AREA_IDS as unknown as [string, ...string[]]);

/** Validação da resposta da IA (além do formato garantido pela API). */
const contentSchema = z.object({
  geral: z.number(),
  visao: z.string(),
  areas: z.array(z.object({ area, pct: z.number(), texto: z.string() })),
  insights: z.array(z.object({ icon: z.enum(['trend', 'alert', 'target']), titulo: z.string(), texto: z.string() })),
  suggestions: z.array(
    z.object({
      iniciativa: z.object({ titulo: z.string(), descricao: z.string(), areas: z.array(area) }),
      epicos: z.array(z.object({ titulo: z.string(), area, tarefas: z.array(z.string()) })),
    }),
  ),
});

/** Formato JSON que a API do Claude é obrigada a seguir (structured outputs). */
const strictObject = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const areaEnum = { type: 'string', enum: [...AREA_IDS] };
const JSON_SCHEMA = strictObject({
  geral: { type: 'integer', description: 'Índice de alinhamento geral, de 0 a 100.' },
  visao: { type: 'string', description: '3 a 4 frases sobre a visão geral.' },
  areas: {
    type: 'array',
    description: 'As 6 áreas mais relevantes.',
    items: strictObject({ area: areaEnum, pct: { type: 'integer', description: 'Alinhamento de 0 a 100.' }, texto: { type: 'string', description: '2 frases citando os dados.' } }),
  },
  insights: {
    type: 'array',
    description: 'Exatamente 3 insights.',
    items: strictObject({ icon: { type: 'string', enum: ['trend', 'alert', 'target'] }, titulo: { type: 'string' }, texto: { type: 'string' } }),
  },
  suggestions: {
    type: 'array',
    description: 'De 1 a 3 trilhas sugeridas para as áreas com menor alinhamento.',
    items: strictObject({
      iniciativa: strictObject({ titulo: { type: 'string' }, descricao: { type: 'string' }, areas: { type: 'array', items: areaEnum } }),
      epicos: {
        type: 'array',
        description: '1 a 3 épicos.',
        items: strictObject({ titulo: { type: 'string' }, area: areaEnum, tarefas: { type: 'array', description: '2 a 5 tarefas pequenas e concretas.', items: { type: 'string' } } }),
      },
    }),
  },
});

const SYSTEM = `Você analisa os exercícios de uma pessoa que usa o método Sprint da Vida: necrológio (quem ela quer ter sido), Roda da Vida (contentamento de 0 a 10 por área), Pirâmide de Maslow, quadro de sonhos e um backlog ágil (iniciativas, épicos e tarefas).

Objetivo: medir o alinhamento entre o que a pessoa diz querer (necrológio, sonhos, notas da roda, reflexões) e o que ela está executando (épicos e tarefas). Use só as fontes que vierem nos dados e cite números concretos delas.

Escreva em português do Brasil, frases curtas e concretas, tratando a pessoa por "você". Não use vocabulário de autoajuda ou coaching (nada de "jornada", "propósito de vida", "melhor versão", "mindset", "zona de conforto", "desbloquear potencial" e afins).

As sugestões são trilhas prontas para o backlog: uma iniciativa com 1 a 3 épicos, cada épico com 2 a 5 tarefas pequenas, executáveis em uma sprint de 14 dias.`;

/** IA de verdade (AI_MODE=anthropic): chama a API do Claude e valida a resposta. */
export class AnthropicProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(input: AnalysisInput): Promise<AnalysisContent> {
    let response;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Se o modelo recusar por engano, a API tenta de novo com outro modelo, na mesma chamada.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: JSON_SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: `Dados da pessoa (JSON):\n${JSON.stringify(input)}` }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new AiError('A IA está ocupada agora. Tente de novo em alguns minutos.');
      if (e instanceof Anthropic.AuthenticationError) throw new AiError('A chave da API do Claude não foi aceita. Avise o administrador.');
      if (e instanceof Anthropic.APIError) throw new AiError('Não foi possível gerar o relatório agora. Tente novamente em instantes.');
      throw e;
    }
    if (response.stop_reason === 'refusal') throw new AiError('A IA não conseguiu analisar esses dados. Tente com outras fontes.');
    if (response.stop_reason === 'max_tokens') throw new AiError('O relatório ficou grande demais. Tente com menos fontes.');
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AiError('A IA respondeu num formato inesperado. Tente de novo.');
    }
    const r = contentSchema.safeParse(parsed);
    if (!r.success) throw new AiError('A IA respondeu num formato inesperado. Tente de novo.');
    return r.data as AnalysisContent;
  }
}
