import { acceptedLabel, MEDIA_TYPES, mediaKind, mediaLimit, type MediaKind } from '@circle/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FilePurpose, File as StoredFile } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const MB = 1024 * 1024;

/** Nome do tipo de arquivo nas mensagens de erro. */
const KIND_NAME: Record<MediaKind, string> = { image: 'A imagem', video: 'O vídeo', doc: 'O documento' };

/**
 * Limite de tamanho (em bytes) daquele tipo de arquivo naquele lugar do app.
 * Tipos e limites ficam em MEDIA_RULES (packages/shared/src/media.ts).
 */
function limitFor(purpose: FilePurpose, mime: string) {
  const limit = mediaLimit(purpose, mime);
  if (!limit) throw new BadRequestException(`Envie ${acceptedLabel(purpose)}.`);
  return { bytes: limit.maxMb * MB, msg: `${KIND_NAME[mediaKind(mime)!]} pode ter até ${limit.maxMb} MB.` };
}

/**
 * Envio de arquivos em duas etapas:
 * 1. `create`: a API registra o arquivo como "pendente" e devolve uma URL
 *    temporária; o navegador envia o arquivo direto para o storage.
 * 2. `confirm`: a API confere que o arquivo chegou (e o tamanho) e marca como pronto.
 * A API nunca recebe o arquivo em si.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, purpose: FilePurpose, mime: string, size: number, name: string) {
    const limit = limitFor(purpose, mime);
    if (size > limit.bytes) throw new BadRequestException(limit.msg);
    const ext = MEDIA_TYPES[mime]!.ext;
    await this.cleanupStale(userId);

    const file = await this.prisma.file.create({
      data: { userId, purpose, mime, size, name: name.slice(0, 200) || `arquivo.${ext}`, key: `tmp-${crypto.randomUUID()}` },
    });
    const key = `users/${userId}/${purpose}/${file.id}.${ext}`;
    await this.prisma.file.update({ where: { id: file.id }, data: { key } });
    return { fileId: file.id, uploadUrl: await this.storage.uploadUrl(key, mime), headers: { 'Content-Type': mime } };
  }

  async confirm(userId: string, id: string) {
    const file = await this.own(userId, id);
    if (file.status === 'ready') return this.toDto(file);
    const size = await this.storage.size(file.key);
    if (size === null) throw new BadRequestException('O arquivo não chegou ao storage. Tente enviar de novo.');
    const limit = limitFor(file.purpose, file.mime);
    if (size > limit.bytes) {
      await this.storage.remove(file.key);
      await this.prisma.file.delete({ where: { id } });
      throw new BadRequestException(limit.msg);
    }
    const ready = await this.prisma.file.update({ where: { id }, data: { status: 'ready', size } });
    return this.toDto(ready);
  }

  async remove(userId: string, id: string) {
    const file = await this.own(userId, id);
    await this.storage.remove(file.key);
    await this.prisma.file.delete({ where: { id } });
  }

  /** Arquivo pronto, da pessoa e da finalidade certa (usado ao anexar em tarefa, sonho, post…). */
  async readyFile(userId: string, id: string, purpose: FilePurpose) {
    const file = await this.prisma.file.findFirst({ where: { id, userId, purpose, status: 'ready' } });
    if (!file) throw new BadRequestException('Arquivo não encontrado. Envie de novo.');
    return file;
  }

  /** Link temporário para ver o arquivo. Documentos levam o nome original (ao baixar, não vira um código). */
  url(file: Pick<StoredFile, 'key'> & Partial<Pick<StoredFile, 'mime' | 'name'>>) {
    const doc = Boolean(file.mime && mediaKind(file.mime) === 'doc');
    return this.storage.downloadUrl(file.key, 3600, doc ? file.name : undefined);
  }

  async toDto(file: StoredFile) {
    return { id: file.id, name: file.name, url: await this.url(file), kind: mediaKind(file.mime) ?? 'image', mime: file.mime };
  }

  private async own(userId: string, id: string) {
    const file = await this.prisma.file.findFirst({ where: { id, userId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    return file;
  }

  /** Envios iniciados há mais de um dia e nunca confirmados são apagados. */
  private async cleanupStale(userId: string) {
    const stale = await this.prisma.file.findMany({
      where: { userId, status: 'pending', createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    for (const f of stale) {
      await this.storage.remove(f.key);
      await this.prisma.file.delete({ where: { id: f.id } });
    }
  }
}
