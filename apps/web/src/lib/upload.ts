'use client';

import { acceptedLabel, MEDIA_RULES, MEDIA_TYPES, MIME_BY_EXT, mediaKind, mediaLimit, type MediaKind, type UploadPurpose } from '@circle/shared';
import { api } from './api';

export type { UploadPurpose };

/** Tamanho ideal de cada imagem, conforme o formato em que ela aparece no app (mostrado em cada campo). */
export const IMAGE_SIZE: Record<UploadPurpose, [size: string, note?: string]> = {
  avatar: ['400 × 400 px (quadrada)'],
  dream: ['1200 × 900 px (horizontal)'],
  task: ['até 1200 px no lado maior'],
  post: ['1080 × 1080, 1080 × 1350 ou 1080 × 566 px', 'O app ajusta sozinho ao formato mais próximo.'],
  story: ['1080 × 1920 px (vertical)', 'Arraste e dê zoom para enquadrar.'],
  group: ['1200 × 600 px (horizontal)', 'Deixe o assunto no centro: ela também aparece num círculo.'],
  trilha: ['1200 × 675 px (horizontal)'],
};

/** Formatos de post e story (os do Instagram), em px. */
export type ImageFormat = { w: number; h: number };
export const FORMATS: Partial<Record<UploadPurpose, ImageFormat[]>> = {
  post: [
    { w: 1080, h: 1080 }, // quadrada (1:1)
    { w: 1080, h: 1350 }, // vertical (4:5)
    { w: 1080, h: 566 }, // horizontal (1,91:1)
  ],
  story: [{ w: 1080, h: 1920 }], // vertical (9:16)
};

/** O formato com a proporção mais próxima da foto (comparando na escala logarítmica, justa para largas e altas). */
export const closestFormat = (w: number, h: number, formats: ImageFormat[]) =>
  formats.reduce((best, f) => (Math.abs(Math.log(w / h / (f.w / f.h))) < Math.abs(Math.log(w / h / (best.w / best.h))) ? f : best));

/**
 * Reduz a imagem no navegador antes de enviar (lado maior em `max` px, JPEG), como no protótipo.
 * Com `formats`, escolhe o formato mais próximo, recorta o excesso pelo centro e entrega no tamanho exato.
 */
export function shrinkImage(file: File, max = 900, formats?: ImageFormat[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      if (formats?.length) {
        const f = closestFormat(img.width, img.height, formats);
        // Maior área da foto com a proporção do formato, centralizada.
        const k = Math.min(img.width / f.w, img.height / f.h);
        const sw = f.w * k;
        const sh = f.h * k;
        // Foto menor que o formato: não amplia (evita imagem borrada).
        const out = Math.min(1, k);
        canvas.width = Math.round(f.w * out);
        canvas.height = Math.round(f.h * out);
        canvas.getContext('2d')!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
      } else {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Não foi possível ler essa imagem.'))), 'image/jpeg', 0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir essa imagem.'));
    };
    img.src = url;
  });
}

/**
 * Envia um JPEG já pronto (ex.: recortado pela pessoa no story): pede à API uma
 * URL temporária, manda o arquivo direto para o storage e confirma.
 */
export async function uploadBlob(blob: Blob, purpose: UploadPurpose, name = 'imagem.jpg') {
  const { fileId, uploadUrl, headers } = await api<{ fileId: string; uploadUrl: string; headers: Record<string, string> }>('/uploads', {
    method: 'POST',
    body: { purpose, mime: 'image/jpeg', size: blob.size, name },
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers, body: blob });
  if (!put.ok) throw new Error('Não foi possível enviar a imagem. Tente de novo.');
  return api<{ id: string; name: string; url: string }>(`/uploads/${fileId}/confirm`, { method: 'POST' });
}

/**
 * Envia uma imagem: reduz/recorta no navegador e manda para o storage.
 * Devolve o id do arquivo e a URL para mostrar.
 */
export async function uploadImage(file: File, purpose: UploadPurpose, max = 900) {
  const blob = await shrinkImage(file, max, FORMATS[purpose]);
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return uploadBlob(blob, purpose, name);
}

// ---------- Vídeos e documentos (sem redução: vão como estão, dentro dos limites de MEDIA_RULES) ----------

export type UploadedFile = { id: string; name: string; url: string; kind: MediaKind; mime: string };

/** Tipo do arquivo (MIME). Alguns aparelhos não informam: aí vale a extensão do nome. */
export function fileMime(file: File) {
  if (file.type && MEDIA_TYPES[file.type]) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? file.type;
}

/** O que o seletor de arquivos mostra naquele lugar (tipos e extensões aceitos). */
export function acceptFor(purpose: UploadPurpose) {
  const kinds = MEDIA_RULES[purpose];
  return Object.entries(MEDIA_TYPES)
    .filter(([, t]) => kinds[t.kind])
    .flatMap(([mime, t]) => [mime, `.${t.ext}`])
    .join(',');
}

/** Duração do vídeo (segundos), lida no próprio aparelho antes de enviar. */
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return done(v.duration);
      // Vídeos gravados pelo navegador (WebM) às vezes não informam a duração: pular para o fim revela.
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        done(v.duration);
      };
      v.currentTime = 1e101;
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir esse vídeo. Tente outro formato (MP4).'));
    };
    v.src = url;
  });
}

/**
 * Confere o arquivo antes de enviar (tipo aceito naquele lugar e tamanho), com a
 * mesma regra da API. Devolve o tipo e o limite; erro vem com a mensagem para a pessoa.
 */
export function checkFile(file: File, purpose: UploadPurpose) {
  const mime = fileMime(file);
  const kind = mediaKind(mime);
  const limit = mediaLimit(purpose, mime);
  if (!kind || !limit) throw new Error(`Envie ${acceptedLabel(purpose)}.`);
  // Imagem é reduzida antes de enviar: o tamanho original não importa.
  if (kind !== 'image' && file.size > limit.maxMb * 1024 * 1024) {
    const name = kind === 'video' ? 'O vídeo' : 'O documento';
    throw new Error(`${name} pode ter até ${limit.maxMb} MB (este tem ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB).`);
  }
  return { mime, kind, limit };
}

/** Envia um vídeo ou documento como está, mostrando o progresso (0 a 1). */
export async function uploadFile(file: File, purpose: UploadPurpose, onProgress?: (p: number) => void) {
  const { mime } = checkFile(file, purpose);
  const { fileId, uploadUrl, headers } = await api<{ fileId: string; uploadUrl: string; headers: Record<string, string> }>('/uploads', {
    method: 'POST',
    body: { purpose, mime, size: file.size, name: file.name.slice(0, 200) },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('Não foi possível enviar o arquivo. Tente de novo.')));
    xhr.onerror = () => reject(new Error('A conexão caiu durante o envio. Tente de novo.'));
    xhr.send(file);
  });
  return api<UploadedFile>(`/uploads/${fileId}/confirm`, { method: 'POST' });
}

/** Envia qualquer arquivo aceito: imagem é reduzida (como antes); vídeo e documento vão como estão. */
export async function uploadAny(file: File, purpose: UploadPurpose, opts: { max?: number; onProgress?: (p: number) => void } = {}) {
  const { kind } = checkFile(file, purpose);
  if (kind === 'image') return { ...(await uploadImage(file, purpose, opts.max)), kind } as UploadedFile;
  return uploadFile(file, purpose, opts.onProgress);
}
