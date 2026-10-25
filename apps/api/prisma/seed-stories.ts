/**
 * Stories de exemplo de alguns amigos do Henrico (para o feed não abrir vazio).
 * Criados há poucas horas, para durarem quase um dia inteiro depois do seed.
 */
import type { Area, PrismaClient } from '../src/generated/prisma/client';
import type { SeedImages } from './seed-images';

type StorySeed = { author: string; hoursAgo: number; areas: Area[]; caption: string; photo: string };

const STORIES: StorySeed[] = [
  { author: 'julia', hoursAgo: 1, areas: ['intelectual', 'emocional'], caption: 'Página 30 de 30. O diário fechou o mês ✍️', photo: 'st_julia' },
  { author: 'tiago', hoursAgo: 3, areas: ['saude'], caption: 'Treino das 6h feito', photo: 'st_tiago1' },
  { author: 'tiago', hoursAgo: 2, areas: ['saude', 'lazer'], caption: 'Desaquecendo no parque', photo: 'st_tiago2' },
  { author: 'barbara', hoursAgo: 4, areas: ['intelectual', 'espiritualidade'], caption: 'Canto 7 da Ilíada com café', photo: 'st_barbara' },
];

export async function seedStories(prisma: PrismaClient, created: Record<string, string>, images: SeedImages) {
  let n = 0;
  for (const st of STORIES) {
    const authorId = created[`${st.author}@teste.local`]!;
    const createdAt = new Date(Date.now() - st.hoursAgo * 3_600_000);
    const fileId = await images.put(authorId, 'story', st.photo, createdAt);
    if (!fileId) return n;
    await prisma.story.create({
      data: { authorId, fileId, areas: st.areas, caption: st.caption, visibility: 'publico', createdAt, expiresAt: new Date(createdAt.getTime() + 24 * 3_600_000) },
    });
    n++;
  }
  return n;
}
