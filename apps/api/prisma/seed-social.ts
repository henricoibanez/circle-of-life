/**
 * Amigos e grupos de exemplo, como no protótipo (constantes FRIENDS e GROUPS).
 * O Henrico é amigo de Julia, Lucas, Tiago e Bárbara, tem um pedido recebido
 * do Vinícius e um enviado ao Usuário Novo. Administra Leitores de Homero e
 * Mitologias, participa do Time Ágil e vê os outros grupos como sugeridos.
 */
import type { Area, PrismaClient } from '../src/generated/prisma/client';

type GroupSeed = { name: string; desc: string; area: Area; art: string; icon: string; admin: string; members: string[]; trilhas?: string[] };

const GROUPS: GroupSeed[] = [
  { name: 'Time Ágil', desc: 'A turma piloto do Sprint da Vida.', area: 'profissional', art: 'night', icon: 'users', admin: 'julia', members: ['henrico', 'lucas', 'tiago', 'barbara'] },
  { name: 'Leitores de Homero', desc: 'Um grupo para quem ama os clássicos e busca sabedoria atemporal.', area: 'intelectual', art: 'night', icon: 'book', admin: 'henrico', members: ['barbara', 'julia'], trilhas: ['Os Clássicos Gregos'] },
  { name: 'Mitologias', desc: 'Exploramos mitos, histórias e símbolos que moldaram o mundo.', area: 'espiritualidade', art: 'sun', icon: 'lotus', admin: 'henrico', members: ['tiago'], trilhas: ['Silêncio Diário'] },
  { name: 'Estoicismo Diário', desc: 'Reflexões e práticas estoicas para o dia a dia.', area: 'emocional', art: 'night', icon: 'smile', admin: 'lucas', members: ['julia'] },
  { name: 'Diário da Gratidão', desc: 'Compartilhe gratidões e inspire outras pessoas.', area: 'espiritualidade', art: 'sun', icon: 'heart', admin: 'barbara', members: ['vinicius'] },
  { name: 'Trilhas da Evolução', desc: 'Desafios semanais para tirar as metas do papel.', area: 'saude', art: 'lake', icon: 'flag', admin: 'tiago', members: ['lucas'], trilhas: ['Treino Consistente', 'Beba Água, Viva Melhor'] },
  { name: 'Leitores de Sêneca', desc: 'Estudos e discussões sobre as obras de Sêneca.', area: 'intelectual', art: 'forest', icon: 'book', admin: 'julia', members: ['barbara'] },
];

const FRIENDS: [string, string][] = [
  ['henrico', 'julia'],
  ['lucas', 'henrico'],
  ['henrico', 'tiago'],
  ['barbara', 'henrico'],
  ['julia', 'barbara'],
  ['julia', 'lucas'],
];

/** Apaga os grupos criados por usuários de teste (antes de apagar os usuários). */
export async function clearSocial(prisma: PrismaClient, testUserIds: string[]) {
  await prisma.group.deleteMany({ where: { createdById: { in: testUserIds } } });
}

export async function seedSocial(prisma: PrismaClient, created: Record<string, string>) {
  const id = (who: string) => created[`${who}@teste.local`]!;
  const day = (n: number) => new Date(Date.now() - n * 86_400_000);

  for (const [i, [a, b]] of FRIENDS.entries()) {
    await prisma.friendship.create({ data: { requesterId: id(a), addresseeId: id(b), status: 'accepted', createdAt: day(60 - i), acceptedAt: day(59 - i) } });
  }
  const pending = await prisma.friendship.create({ data: { requesterId: id('vinicius'), addresseeId: id('henrico'), createdAt: day(1) } });
  await prisma.friendship.create({ data: { requesterId: id('henrico'), addresseeId: id('novo'), createdAt: day(2) } });
  await prisma.notification.create({
    data: {
      userId: id('henrico'),
      type: 'amizade_pedido',
      title: 'Vinícius Lima quer ser seu amigo',
      body: 'Aceite para ver os posts e as conquistas um do outro.',
      link: '/grupos?aba=amigos',
      actorId: id('vinicius'),
      refId: pending.id,
      createdAt: day(1),
    },
  });

  const trilhas = new Map((await prisma.trilha.findMany({ where: { status: 'aprovada' }, select: { id: true, title: true } })).map(t => [t.title, t.id]));
  for (const [i, g] of GROUPS.entries()) {
    const group = await prisma.group.create({
      data: {
        name: g.name,
        description: g.desc,
        area: g.area,
        art: g.art,
        icon: g.icon,
        createdById: id(g.admin),
        createdAt: day(90 - i),
        members: {
          create: [
            { userId: id(g.admin), role: 'admin', joinedAt: day(90 - i) },
            ...g.members.map((m, j) => ({ userId: id(m), joinedAt: day(80 - i - j) })),
          ],
        },
      },
    });
    for (const title of g.trilhas ?? []) {
      const trilhaId = trilhas.get(title);
      if (trilhaId) await prisma.groupTrilha.create({ data: { groupId: group.id, trilhaId, addedById: id(g.admin) } });
    }
  }
  return { groups: GROUPS.length, friendships: FRIENDS.length };
}
