/**
 * Exercícios de reflexão de exemplo do protótipo (Roda da Vida, Pirâmide de
 * Maslow, Necrológio e Quadro de visualização) para o usuário Henrico.
 */
import type { PrismaClient } from '../src/generated/prisma/client';
import type { SeedImages } from './seed-images';

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

const MASLOW_CHECKS = ['fis-0', 'fis-1', 'fis-2', 'fis-3', 'fis-5', 'seg-0', 'seg-1', 'seg-2', 'seg-5', 'soc-0', 'soc-1', 'soc-2', 'soc-4', 'est-0', 'est-1', 'est-3', 'est-4', 'aut-0', 'aut-1', 'aut-2', 'aut-3', 'aut-4', 'aut-5'];

export async function seedMaslow(prisma: PrismaClient, userId: string) {
  await prisma.maslowCheck.createMany({ data: MASLOW_CHECKS.map(itemKey => ({ userId, itemKey })) });
  await prisma.maslowNote.create({ data: { userId, level: 'fis', text: 'Respiração: quero voltar a caminhar no parque antes do trabalho.', createdAt: ago(6) } });
}

const NECRO = '<h1>Meu legado</h1><p>Se um dia eu partir, quero que lembrem de mim pelo amor que compartilhei, pelas pessoas que inspirei e pelas histórias que construí.</p><p>Minha missão nesta vida sempre foi ajudar o máximo de pessoas que eu pudesse, deixando um impacto positivo por onde eu passasse.</p><h2>Minha história</h2><p>Errou, aprendeu com os erros e decidiu usar o que aprendeu para ajudar quem vinha atrás.</p><h2>Valores e crenças</h2><ul><li>Honestidade em todas as minhas atitudes</li><li>Empatia e compaixão pelo próximo</li><li>Coragem para fazer o que é certo</li><li>Gratidão pelas pequenas coisas da vida</li></ul><h2>Conquistas e momentos marcantes</h2><p>Minha família, meus amigos e todas as conquistas que alcançamos juntos. Cada desafio me ensinou algo valioso.</p><h2>Conselhos e lições</h2><p>Viva com propósito. Ame intensamente. Seja gentil. E nunca pare de aprender.</p>';

export async function seedNecrologio(prisma: PrismaClient, userId: string) {
  await prisma.necrologio.create({ data: { userId, html: NECRO } });
}

const DREAMS: [text: string, area: string, photo: string, doneDaysAgo?: number][] = [
  ['Ver a aurora boreal com a minha esposa', 'amor', 'dr_aurora'],
  ['Ler a Ilíada e a Odisseia inteiras', 'intelectual', 'dr_livros'],
  ['Morar numa casa com quintal', 'financas', 'dr_casa'],
  ['Tocar gaita numa roda de amigos', 'lazer', 'dr_gaita', 10],
  ['Viagem de 15 dias pelo Nordeste', 'lazer', 'dr_nordeste', 80],
  ['Reserva de emergência de 6 meses', 'financas', 'dr_cofre', 120],
  ['Natal com a família inteira reunida', 'familia', 'dr_natal', 300],
  ['Retiro espiritual de 3 dias', 'espiritualidade', 'dr_retiro', 200],
];

export async function seedDreams(prisma: PrismaClient, userId: string, images: SeedImages) {
  for (const [position, [text, area, photo, done]] of DREAMS.entries()) {
    const imageFileId = await images.put(userId, 'dream', photo);
    await prisma.dream.create({ data: { userId, text, area: area as never, position, imageFileId, doneAt: done ? ago(done) : null } });
  }
}
