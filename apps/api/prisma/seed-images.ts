/**
 * Fotos dos dados de exemplo (fotos de perfil, stories, posts e sonhos).
 * As imagens ficam em prisma/seed-images (fotos do Unsplash, licença livre;
 * origem de cada uma em seed-images/CREDITOS.md) e são enviadas ao storage
 * S3 local. Se o storage não estiver no ar, o seed segue sem as fotos.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FilePurpose, PrismaClient } from '../src/generated/prisma/client';

export class SeedImages {
  private readonly s3: S3Client;
  private offline = false;

  constructor(private readonly prisma: PrismaClient) {
    const env = process.env;
    this.s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
  }

  /** Envia a foto `name` (sem .jpg) e devolve o id do arquivo, ou null sem storage. */
  async put(userId: string, purpose: FilePurpose, name: string, createdAt = new Date()): Promise<string | null> {
    if (this.offline) return null;
    const body = readFileSync(resolve(__dirname, 'seed-images', `${name}.jpg`));
    const key = `users/${userId}/${purpose}/${randomUUID().replace(/-/g, '')}.jpg`;
    try {
      await this.s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: 'image/jpeg' }));
    } catch {
      this.offline = true;
      console.warn('  (storage fora do ar: os dados de exemplo ficam sem fotos; rode com o pnpm dev ligado)');
      return null;
    }
    const file = await this.prisma.file.create({ data: { userId, key, name: `${name}.jpg`, mime: 'image/jpeg', size: body.length, purpose, status: 'ready', createdAt } });
    return file.id;
  }
}
