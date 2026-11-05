/**
 * Anonimização dos dados antes de irem para a IA (decisão do dono de 05/11/2026):
 * o nome da pessoa vira [PESSOA] e e-mails, links, CPFs e telefones viram marcadores.
 * A IA escreve com [PESSOA] e o app troca de volta pelo primeiro nome antes de mostrar.
 * Nomes de outras pessoas (cônjuge, filhos) não são detectados.
 */
export const PERSON = '[PESSOA]';

/** Partes do nome que não identificam ninguém ("Maria da Silva" → só "Maria" e "Silva"). */
const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);
/** Cada letra aceita a versão com ou sem acento ("Barbara" também pega "Bárbara"). */
const VARIANTS: Record<string, string> = { a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ' };

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[EMAIL]'],
  [/\b(https?:\/\/|www\.)\S+/gi, '[LINK]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]'],
  // Telefone: 10 a 13 dígitos, com ou sem +55, parênteses, espaço ou hífen.
  [/(\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, '[TELEFONE]'],
];

/** Monta a função que anonimiza textos para uma pessoa com este nome completo. */
export function anonymizer(fullName: string) {
  const parts = [...new Set(plain(fullName).split(/[^\p{L}]+/u))].filter(p => p.length >= 2 && !PARTICLES.has(p));
  const nameRe = parts.length
    ? new RegExp(
        `(?<![\\p{L}\\p{N}])(${parts.map(p => [...p].map(ch => (VARIANTS[ch] ? `[${VARIANTS[ch]}]` : escape(ch))).join('')).join('|')})(?![\\p{L}\\p{N}])`,
        'giu',
      )
    : null;
  return (text: string) => {
    let out = text;
    for (const [re, mark] of PATTERNS) out = out.replace(re, mark);
    if (nameRe) out = out.replace(nameRe, PERSON).replace(/\[PESSOA\](\s+\[PESSOA\])+/g, PERSON);
    return out;
  };
}

/** Aplica uma troca em todos os textos de um objeto (listas e objetos aninhados). */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) return value.map(v => mapStrings(v, fn)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  return value;
}
