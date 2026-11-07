import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * Acesso ao storage compatível com S3 (SeaweedFS local, Supabase em produção).
 * Só usa o SDK S3 padrão: trocar de provedor é trocar variáveis de ambiente.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly client: S3Client;
  /** Mesmo storage, pelo endereço que o navegador enxerga (usado só para assinar URLs). */
  private readonly publicClient: S3Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET');
    const base: S3ClientConfig = {
      region: config.get('S3_REGION'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
      // Storages compatíveis com S3 (SeaweedFS, Supabase) nem sempre aceitam os
      // códigos de conferência novos da AWS; só usamos quando obrigatório.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
      },
    };
    this.client = new S3Client({ ...base, endpoint: config.get('S3_ENDPOINT') });
    this.publicClient = new S3Client({ ...base, endpoint: config.get('S3_PUBLIC_ENDPOINT') });
  }

  async onModuleInit() {
    if (this.config.get('S3_CREATE_BUCKET')) await this.ensureBucket();
  }

  /** Cria o bucket (se não existir) e libera o envio direto pelo site (CORS). */
  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" criado`);
    }
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: this.config.get('S3_CORS_ORIGINS'),
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  }

  /** URL temporária para o navegador ENVIAR um arquivo direto ao storage (PUT). */
  uploadUrl(key: string, contentType: string, seconds = 300) {
    return getSignedUrl(this.publicClient, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: seconds,
    });
  }

  /**
   * URL temporária para o navegador VER um arquivo (o bucket é privado).
   * Com `fileName`, o arquivo abre com o nome original (útil para documentos: ao baixar, não vira um código).
   */
  downloadUrl(key: string, seconds = 3600, fileName?: string) {
    const disposition = fileName ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}` : undefined;
    return getSignedUrl(this.publicClient, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition }), {
      expiresIn: seconds,
    });
  }

  /** Tamanho do arquivo no storage, ou null se ele não existe. */
  async size(key: string): Promise<number | null> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return r.ContentLength ?? 0;
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }

  /** Usado pelo health check: o bucket existe e responde? */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}
