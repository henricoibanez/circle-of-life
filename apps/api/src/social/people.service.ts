import type { PersonDto } from '@circle/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

type PersonRow = { id: string; name: string; handle: string; photoFileId: string | null };

export const PERSON_SELECT = { id: true, name: true, handle: true, photoFileId: true } as const;

/** Monta "pessoas" (nome, @ e foto) para as telas sociais, buscando as fotos de uma vez só. */
@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async many(rows: PersonRow[]): Promise<PersonDto[]> {
    const ids = rows.map(r => r.photoFileId).filter((x): x is string => Boolean(x));
    const files = ids.length ? await this.prisma.file.findMany({ where: { id: { in: ids } } }) : [];
    const urls = new Map(await Promise.all(files.map(async f => [f.id, await this.uploads.url(f)] as const)));
    return rows.map(r => ({ id: r.id, name: r.name, handle: r.handle, photoUrl: r.photoFileId ? (urls.get(r.photoFileId) ?? null) : null }));
  }

  async one(row: PersonRow) {
    return (await this.many([row]))[0]!;
  }

  /** Ids dos amigos (amizades aceitas) de uma pessoa. */
  async friendIds(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'accepted', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map(r => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }
}
