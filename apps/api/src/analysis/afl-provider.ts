import type { AnalysisContent } from '@circle/shared';
import { z } from 'zod';
import type { AnalysisInput } from './analysis-input';

/** Erro com mensagem que pode ser mostrada para a pessoa. */
export class AiError extends Error {}

const text = z.string().trim();
const list = z.array(text).default([]);
const point = z.object({ titulo: text, texto: text });

/** Validação da resposta do agente (o formato está descrito nas instruções dele, no Agents for Life). */
const contentSchema = z.object({
  retrato: text.min(1),
  geral: z.coerce.number(),
  padroes: z.array(point).default([]),
  gaps: z.array(point).default([]),
  manter: list,
  ajustar: list,
  abandonar: list,
  proximos7dias: list,
  limitantes: z.array(z.object({ nome: text, texto: text })).default([]),
  pergunta: text.default(''),
  cuidado: text.default(''),
  sugestoes: z
    .array(
      z.object({
        iniciativa: z.object({ titulo: text, descricao: text.default(''), porque: text.default(''), areas: z.array(z.string()).default([]) }),
        epicos: z.array(
          z.object({
            titulo: text,
            areas: z.array(z.string()).default([]),
            tarefas: z.array(z.object({ titulo: text, descricao: text.default('') })).default([]),
          }),
        ),
      }),
    )
    .default([]),
});

/** Tempo máximo de cada tentativa. A função da API na Vercel tem 60 segundos no total. */
const ATTEMPT_MS = 50_000;
/** Só tenta de novo se a primeira resposta veio rápido (para caber no tempo da Vercel). */
const RETRY_IF_UNDER_MS = 25_000;

/**
 * IA de verdade (AI_MODE=afl): conversa com o agente "Circle of Life — Me analise"
 * no Agents for Life, pelo hub MCP deles (JSON-RPC sobre HTTP). O agente não tem
 * ferramentas: só lê os dados e devolve a análise em JSON.
 */
export class AflProvider {
  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly agentId: string,
  ) {}

  private async rpc(method: string, params: unknown, session: string | null, signal: AbortSignal, notify = false) {
    const id = notify ? undefined : Math.floor(Math.random() * 1e9);
    const res = await fetch(this.url, {
      method: 'POST',
      signal,
      headers: {
        authorization: `Bearer ${this.key}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(notify ? {} : { id }) }),
    });
    if (res.status === 401 || res.status === 403) throw new AiError('A chave do Agents for Life não foi aceita. Avise o administrador.');
    if (!res.ok) throw new AiError('A IA está indisponível agora. Tente de novo em alguns minutos.');
    const session2 = res.headers.get('mcp-session-id') ?? session;
    const body = await res.text();
    if (notify) return { result: null, session: session2 };
    // A resposta pode vir como JSON puro ou como eventos (text/event-stream).
    const msgs = res.headers.get('content-type')?.includes('event-stream')
      ? body
          .split('\n')
          .filter(l => l.startsWith('data:'))
          .map(l => JSON.parse(l.slice(5)) as { id?: number; result?: unknown; error?: unknown })
      : [JSON.parse(body) as { id?: number; result?: unknown; error?: unknown }];
    const msg = msgs.find(m => m.id === id);
    if (!msg || msg.error) throw new AiError('A IA está indisponível agora. Tente de novo em alguns minutos.');
    return { result: msg.result, session: session2 };
  }

  /** Uma conversa com o agente: devolve o texto da resposta. */
  private async ask(message: string): Promise<string> {
    const signal = AbortSignal.timeout(ATTEMPT_MS);
    try {
      const init = await this.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'circle-of-life', version: '1' } }, null, signal);
      await this.rpc('notifications/initialized', undefined, init.session, signal, true);
      const { result } = await this.rpc('tools/call', { name: 'chat_with_agent', arguments: { agentId: this.agentId, message } }, init.session, signal);
      const r = result as { isError?: boolean; content?: { type: string; text?: string }[] };
      // O primeiro bloco é a fala do agente; o segundo é o registro do AFL (custo, ferramentas).
      const reply = r.content?.find(c => c.type === 'text')?.text;
      if (r.isError || !reply) throw new AiError('A IA está indisponível agora. Tente de novo em alguns minutos.');
      return reply;
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new AiError('A IA demorou demais para responder. Tente de novo em alguns minutos.');
      throw new AiError('A IA está indisponível agora. Tente de novo em alguns minutos.');
    }
  }

  async analyze(input: AnalysisInput): Promise<AnalysisContent> {
    // "<" vira \u003c (o JSON continua igual): assim nenhum texto da pessoa consegue fechar o bloco de dados.
    const message = `<dados_da_pessoa>\n${JSON.stringify(input).replace(/</g, '\\u003c')}\n</dados_da_pessoa>`;
    const t0 = Date.now();
    try {
      return parseReply(await this.ask(message));
    } catch (e) {
      if (!(e instanceof FormatError) || Date.now() - t0 > RETRY_IF_UNDER_MS) throw e instanceof FormatError ? new AiError(e.message) : e;
      try {
        return parseReply(await this.ask(message));
      } catch (e2) {
        throw e2 instanceof FormatError ? new AiError(e2.message) : e2;
      }
    }
  }
}

/** Resposta fora do formato combinado (vale tentar de novo). */
class FormatError extends Error {}

/** Lê o JSON da resposta do agente (tolerando um bloco de código em volta) e confere o formato. */
export function parseReply(reply: string): AnalysisContent {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new FormatError('A IA respondeu num formato inesperado. Tente de novo.');
  }
  if (parsed && typeof parsed === 'object' && 'erro' in parsed) throw new AiError('A IA não conseguiu analisar esses dados. Tente com outras fontes.');
  const r = contentSchema.safeParse(parsed);
  if (!r.success) throw new FormatError('A IA respondeu num formato inesperado. Tente de novo.');
  return r.data as AnalysisContent;
}
