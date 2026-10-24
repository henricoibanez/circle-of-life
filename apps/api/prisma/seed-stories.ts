/**
 * Stories de exemplo de alguns amigos do Henrico (para o feed não abrir vazio).
 * As fotos são imagens simples geradas aqui (degradê com um "sol"), enviadas ao
 * storage S3 local. Se o storage não estiver no ar, os stories são pulados.
 */
import { randomUUID } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Area, PrismaClient } from '../src/generated/prisma/client';

type StorySeed = { author: string; hoursAgo: number; areas: Area[]; caption: string; top: string; bottom: string; sun: string };

const STORIES: StorySeed[] = [
  { author: 'julia', hoursAgo: 3, areas: ['intelectual', 'emocional'], caption: 'Página 30 de 30 ✍️', top: '#1e3a8a', bottom: '#7c3aed', sun: '#fde68a' },
  { author: 'tiago', hoursAgo: 6, areas: ['saude'], caption: 'Treino das 6h feito', top: '#f59e0b', bottom: '#b45309', sun: '#fff7ed' },
  { author: 'tiago', hoursAgo: 5, areas: ['saude', 'lazer'], caption: 'Vista do parque', top: '#38bdf8', bottom: '#15803d', sun: '#fef9c3' },
  { author: 'barbara', hoursAgo: 10, areas: ['intelectual', 'espiritualidade'], caption: 'Canto 7 da Ilíada', top: '#0f172a', bottom: '#7c2d12', sun: '#fcd34d' },
];

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** PNG em degradê vertical com um círculo claro (feito à mão, sem bibliotecas). */
function gradientPng(top: string, bottom: string, sun: string, w = 360, h = 640) {
  const [a, b, s] = [rgb(top), rgb(bottom), rgb(sun)];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w * 0.68, y - h * 0.3);
      const glow = d < 60 ? 1 : d < 75 ? (75 - d) / 15 : 0;
      for (let c = 0; c < 3; c++) {
        const base = a[c]! + (b[c]! - a[c]!) * t;
        raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.round(base + (s[c]! - base) * glow);
      }
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export async function seedStories(prisma: PrismaClient, created: Record<string, string>) {
  const env = process.env;
  const s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });
  let n = 0;
  for (const st of STORIES) {
    const userId = created[`${st.author}@teste.local`]!;
    const body = gradientPng(st.top, st.bottom, st.sun);
    const id = randomUUID().replace(/-/g, '');
    const key = `users/${userId}/story/${id}.png`;
    try {
      await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: 'image/png' }));
    } catch {
      console.warn('  (storage fora do ar: stories de exemplo pulados; rode com o pnpm dev ligado)');
      return 0;
    }
    const createdAt = new Date(Date.now() - st.hoursAgo * 3_600_000);
    const file = await prisma.file.create({ data: { userId, key, name: 'story.png', mime: 'image/png', size: body.length, purpose: 'story', status: 'ready', createdAt } });
    await prisma.story.create({
      data: { authorId: userId, fileId: file.id, areas: st.areas, caption: st.caption, visibility: 'publico', createdAt, expiresAt: new Date(createdAt.getTime() + 24 * 3_600_000) },
    });
    n++;
  }
  return n;
}
