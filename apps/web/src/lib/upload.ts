'use client';

import { api } from './api';

export type UploadPurpose = 'avatar' | 'dream' | 'task' | 'post' | 'story' | 'group' | 'trilha';

/** Tamanho ideal de cada imagem, conforme o formato em que ela aparece no app (mostrado em cada campo). */
export const IMAGE_SIZE: Record<UploadPurpose, string> = {
  avatar: 'quadrada, 400 × 400 px',
  dream: 'horizontal (4:3), 1200 × 900 px',
  task: 'qualquer formato, até 1200 px no lado maior',
  post: 'horizontal (16:9), 1200 × 675 px. Com várias fotos, quadradas de 1080 × 1080 px',
  story: 'vertical (9:16), 1080 × 1920 px',
  group: 'horizontal (2:1), 1200 × 600 px, com o assunto no centro (ela também aparece num círculo)',
  trilha: 'horizontal (16:9), 1200 × 675 px',
};

/** Reduz a imagem no navegador antes de enviar (lado maior em `max` px, JPEG), como no protótipo. */
export function shrinkImage(file: File, max = 900): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
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
 * Envia uma imagem: pede à API uma URL temporária, manda o arquivo direto
 * para o storage e confirma. Devolve o id do arquivo e a URL para mostrar.
 */
export async function uploadImage(file: File, purpose: UploadPurpose, max = 900) {
  const blob = await shrinkImage(file, max);
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  const { fileId, uploadUrl, headers } = await api<{ fileId: string; uploadUrl: string; headers: Record<string, string> }>('/uploads', {
    method: 'POST',
    body: { purpose, mime: 'image/jpeg', size: blob.size, name },
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers, body: blob });
  if (!put.ok) throw new Error('Não foi possível enviar a imagem. Tente de novo.');
  return api<{ id: string; name: string; url: string }>(`/uploads/${fileId}/confirm`, { method: 'POST' });
}
