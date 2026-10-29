'use client';

import { api } from './api';

export type UploadPurpose = 'avatar' | 'dream' | 'task' | 'post' | 'story' | 'group' | 'trilha';

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
