import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { XpService } from '../xp/xp.service';
import { toTaskDto } from './mappers';

/** Detalhe da tarefa: checklist, histórico e imagens anexadas. */
@Injectable()
export class TaskDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly uploads: UploadsService,
  ) {}

  private async task(userId: string, id: string) {
    const t = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!t) throw new NotFoundException('Tarefa não encontrada.');
    return t;
  }

  async detail(userId: string, id: string) {
    const t = await this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        checklist: { orderBy: { position: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' }, take: 50 },
        attachments: { include: { file: true }, orderBy: { createdAt: 'asc' } },
        epic: { include: { initiative: { select: { id: true, title: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Tarefa não encontrada.');
    return {
      task: toTaskDto(t),
      epic: { id: t.epic.id, title: t.epic.title, area: t.epic.area, areas: t.epic.areas.length ? t.epic.areas : [t.epic.area] },
      initiative: t.epic.initiative,
      checklist: t.checklist.map(c => ({ id: c.id, text: c.text, done: c.done })),
      logs: t.logs.map(l => ({ id: l.id, text: l.text, createdAt: l.createdAt.toISOString() })),
      attachments: await Promise.all(
        t.attachments.map(async a => ({ id: a.id, name: a.file.name, url: await this.uploads.url(a.file) })),
      ),
    };
  }

  // ---------- Checklist ----------

  async addItem(userId: string, taskId: string, text: string) {
    await this.task(userId, taskId);
    const last = await this.prisma.checklistItem.findFirst({ where: { taskId }, orderBy: { position: 'desc' } });
    const item = await this.prisma.checklistItem.create({ data: { taskId, text: text.trim(), position: (last?.position ?? -1) + 1 } });
    return { id: item.id, text: item.text, done: item.done };
  }

  /** Marcar item rende +2 XP (desmarcar tira) e fica no histórico. */
  async updateItem(userId: string, taskId: string, itemId: string, data: { done?: boolean; text?: string }) {
    await this.task(userId, taskId);
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, taskId } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.checklistItem.update({ where: { id: itemId }, data: { done: data.done, text: data.text?.trim() } });
      let gained = 0;
      if (data.done !== undefined && data.done !== item.done) {
        gained = data.done ? await this.xp.grant(tx, userId, 'check', itemId) : await this.xp.revoke(tx, userId, 'check', itemId);
        await tx.taskLog.create({ data: { taskId, text: `${data.done ? 'Concluiu' : 'Reabriu'} “${updated.text}”` } });
      }
      return { item: { id: updated.id, text: updated.text, done: updated.done }, xp: await this.xp.change(tx, userId, gained) };
    });
  }

  async deleteItem(userId: string, taskId: string, itemId: string) {
    await this.task(userId, taskId);
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, taskId } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    return this.prisma.$transaction(async tx => {
      const gained = await this.xp.revoke(tx, userId, 'check', itemId);
      await tx.checklistItem.delete({ where: { id: itemId } });
      return { xp: await this.xp.change(tx, userId, gained) };
    });
  }

  // ---------- Anexos ----------

  async attach(userId: string, taskId: string, fileId: string) {
    await this.task(userId, taskId);
    const file = await this.uploads.readyFile(userId, fileId, 'task');
    const a = await this.prisma.$transaction(async tx => {
      const created = await tx.taskAttachment.create({ data: { taskId, fileId } });
      await tx.taskLog.create({ data: { taskId, text: `Anexou ${file.name}` } });
      return created;
    });
    return { id: a.id, name: file.name, url: await this.uploads.url(file) };
  }

  async detach(userId: string, taskId: string, attachmentId: string) {
    await this.task(userId, taskId);
    const a = await this.prisma.taskAttachment.findFirst({ where: { id: attachmentId, taskId }, include: { file: true } });
    if (!a) throw new NotFoundException('Anexo não encontrado.');
    await this.uploads.remove(userId, a.fileId);
    await this.prisma.taskLog.create({ data: { taskId, text: `Removeu o anexo ${a.file.name}` } });
  }
}
