/**
 * Exercícios de reflexão de exemplo do protótipo (Roda da Vida, Pirâmide de
 * Maslow, Necrológio e Quadro de visualização) para o usuário Henrico.
 */
import type { PrismaClient } from '../src/generated/prisma/client';

const DAY = 86400000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

const RODA_NOW = { lazer: 6, amor: 7, financas: 5, familia: 8, intelectual: 6, espiritualidade: 5, sociedade: 4, saude: 7, emocional: 6, profissional: 8 };
const RODA_HISTORY = [
  { days: 32, scores: { lazer: 5, amor: 6, financas: 4, familia: 8, intelectual: 6, espiritualidade: 4, sociedade: 4, saude: 5, emocional: 5, profissional: 7 } },
  { days: 62, scores: { lazer: 4, amor: 6, financas: 3, familia: 7, intelectual: 5, espiritualidade: 4, sociedade: 3, saude: 4, emocional: 5, profissional: 7 } },
];

export async function seedRoda(prisma: PrismaClient, userId: string) {
  await prisma.rodaScore.createMany({ data: Object.entries(RODA_NOW).map(([area, score]) => ({ userId, area: area as never, score })) });
  await prisma.rodaSnapshot.createMany({ data: RODA_HISTORY.map(h => ({ userId, scores: h.scores, createdAt: ago(h.days) })) });
}
