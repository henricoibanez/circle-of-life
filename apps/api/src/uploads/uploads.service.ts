import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FilePurpose, File as StoredFile } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Tipos de imagem aceitos e a extensão usada no storage. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MB = 1024 * 1024;
/** Tamanho máximo por finalidade (as imagens já são reduzidas no navegador antes do envio). */
export const MAX_SIZE: Record<FilePurpose, number> = {
  avatar: 2 * MB,
  dream: 5 * MB,
  task: 5 * MB,
  post: 5 * MB,
  story: 5 * MB,
  group: 5 * MB,
  trilha: 5 * MB,
};

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
    const ext = IMAGE_TYPES[mime];
    if (!ext) throw new BadRequestException('Envie uma imagem (JPG, PNG, WEBP ou GIF).');
    if (size > MAX_SIZE[purpose]) throw new BadRequestException(`A imagem pode ter até ${MAX_SIZE[purpose] / MB} MB.`);
    await this.cleanupStale(userId);

    const file = await this.prisma.file.create({
      data: { userId, purpose, mime, size, name: name.slice(0, 200) || `imagem.${ext}`, key: `tmp-${crypto.randomUUID()}` },
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
    if (size > MAX_SIZE[file.purpose]) {
      await this.storage.remove(file.key);
      await this.prisma.file.delete({ where: { id } });
      throw new BadRequestException(`A imagem pode ter até ${MAX_SIZE[file.purpose] / MB} MB.`);
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
    if (!file) throw new BadRequestException('Imagem não encontrada. Envie de novo.');
    return file;
  }

  url(file: Pick<StoredFile, 'key'>) {
    return this.storage.downloadUrl(file.key);
  }

  async toDto(file: StoredFile) {
    return { id: file.id, name: file.name, url: await this.url(file) };
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
