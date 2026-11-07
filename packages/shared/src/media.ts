/**
 * Arquivos que a pessoa pode enviar: tipos aceitos e limites de tamanho e de duração
 * por lugar do app (decisão do dono de 07/11/2026). Tudo num lugar só: a API confere
 * estas regras e o site usa as mesmas para avisar antes de enviar.
 */

/** Onde o arquivo vai ser usado (igual ao enum FilePurpose do banco). */
export type UploadPurpose = 'avatar' | 'dream' | 'task' | 'post' | 'story' | 'group' | 'trilha';

/** Tipo de arquivo: imagem, vídeo ou documento. */
export type MediaKind = 'image' | 'video' | 'doc';

/** Tipos aceitos (MIME), com o tipo de arquivo e a extensão usada no storage. */
export const MEDIA_TYPES: Record<string, { kind: MediaKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
  'application/pdf': { kind: 'doc', ext: 'pdf' },
  'application/msword': { kind: 'doc', ext: 'doc' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'doc', ext: 'docx' },
  'application/vnd.ms-excel': { kind: 'doc', ext: 'xls' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { kind: 'doc', ext: 'xlsx' },
  'application/vnd.ms-powerpoint': { kind: 'doc', ext: 'ppt' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { kind: 'doc', ext: 'pptx' },
  'text/plain': { kind: 'doc', ext: 'txt' },
  'text/csv': { kind: 'doc', ext: 'csv' },
};

/** Alguns aparelhos não informam o tipo do arquivo: o site descobre pela extensão do nome. */
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(MEDIA_TYPES).map(([mime, t]) => [t.ext, mime]),
);
MIME_BY_EXT.jpeg = 'image/jpeg';
MIME_BY_EXT.m4v = 'video/mp4';

/** Limite de cada tipo de arquivo: tamanho em MB e, para vídeo, o trecho máximo exibido (segundos). */
export type MediaLimit = { maxMb: number; maxSeconds?: number };

/** O que cada lugar do app aceita. Tipo que não aparece aqui é recusado naquele lugar. */
export const MEDIA_RULES: Record<UploadPurpose, Partial<Record<MediaKind, MediaLimit>>> = {
  avatar: { image: { maxMb: 2 } },
  dream: { image: { maxMb: 5 } },
  task: { image: { maxMb: 5 }, video: { maxMb: 50 }, doc: { maxMb: 10 } },
  post: { image: { maxMb: 5 }, video: { maxMb: 50, maxSeconds: 60 } },
  story: { image: { maxMb: 5 }, video: { maxMb: 30, maxSeconds: 30 } },
  group: { image: { maxMb: 5 } },
  trilha: { image: { maxMb: 5 } },
};

/** No máximo tantos vídeos por post (o resto são fotos). */
export const MAX_POST_VIDEOS = 1;

export const mediaKind = (mime: string): MediaKind | null => MEDIA_TYPES[mime]?.kind ?? null;

/** Limite do arquivo naquele lugar, ou null se aquele tipo não é aceito ali. */
export function mediaLimit(purpose: UploadPurpose, mime: string): MediaLimit | null {
  const kind = mediaKind(mime);
  return (kind && MEDIA_RULES[purpose][kind]) || null;
}

/** Texto com o que aquele lugar aceita, para mensagens de erro (ex.: "imagem ou vídeo"). */
export function acceptedLabel(purpose: UploadPurpose) {
  const names: Record<MediaKind, string> = { image: 'imagem', video: 'vídeo', doc: 'documento (PDF, Word, Excel, PowerPoint, TXT ou CSV)' };
  const kinds = Object.keys(MEDIA_RULES[purpose]) as MediaKind[];
  const list = kinds.map(k => names[k]);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} ou ${list.at(-1)}` : list[0]!;
}

/**
 * Trecho do vídeo que aparece (início e fim, em segundos). O arquivo vai inteiro;
 * só o trecho escolhido é exibido. Vale: começa em 0 ou depois, termina depois do início
 * e não passa do limite daquele lugar (meio segundo de folga para arredondamentos).
 */
export function validClip(purpose: UploadPurpose, start: number, end: number) {
  const max = MEDIA_RULES[purpose].video?.maxSeconds;
  if (!max) return false;
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end - start <= max + 0.5;
}
