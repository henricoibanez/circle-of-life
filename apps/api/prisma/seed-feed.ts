/**
 * Posts de exemplo, como no protótipo (constante posts), sem nível e sequência.
 * As imagens do protótipo eram ilustrações; aqui os posts vão sem imagem.
 */
import type { Area, PrismaClient, Visibility } from '../src/generated/prisma/client';

type PostSeed = {
  author: string;
  hoursAgo: number;
  title?: string;
  text: string;
  area?: Area;
  group?: string;
  visibility?: Visibility;
  tags?: string[];
  xp?: number;
  likes: string[];
  comments?: [string, string, number][];
};

const POSTS: PostSeed[] = [
  {
    author: 'henrico',
    hoursAgo: 2,
    group: 'Time Ágil',
    title: 'Sprint 4 concluída com sucesso! 🎉',
    text: 'Entreguei todas as tarefas planejadas e finalmente comecei a hidratação diária.',
    tags: ['sprint', 'constância', 'timeágil'],
    xp: 100,
    likes: ['julia', 'lucas', 'tiago'],
    comments: [['julia', 'Que demais! A hidratação foi a mais difícil pra mim também.', 1]],
  },
  {
    author: 'julia',
    hoursAgo: 5,
    area: 'emocional',
    title: 'História concluída: Diário de 30 dias',
    text: 'Escrevi uma página por dia durante um mês inteiro. Nunca imaginei que fosse conseguir.',
    xp: 120,
    likes: ['henrico', 'lucas'],
  },
  {
    author: 'lucas',
    hoursAgo: 7,
    area: 'profissional',
    title: 'Épico concluído: Plataforma de Aprendizado 🚀',
    text: 'Seis meses de trabalho noturno. Agora é ver se alguém usa.',
    tags: ['carreira'],
    likes: ['julia', 'tiago'],
  },
  {
    author: 'tiago',
    hoursAgo: 26,
    area: 'saude',
    title: 'Épico encerrado: corrida de 5 km',
    text: 'Seis semanas atrás eu não corria até a esquina.',
    xp: 50,
    likes: ['barbara'],
  },
  {
    author: 'barbara',
    hoursAgo: 50,
    group: 'Leitores de Homero',
    text: 'Terminei o canto 6 da Ilíada. A despedida de Heitor e Andrômaca é a cena mais humana que já li.',
    tags: ['ilíada', 'clássicos'],
    likes: ['julia'],
  },
  {
    author: 'vinicius',
    hoursAgo: 30,
    area: 'lazer',
    text: 'Primeira semana usando o quadro. Tirei duas tarefas do papel que estavam paradas há meses.',
    likes: [],
  },
];

export async function seedFeed(prisma: PrismaClient, created: Record<string, string>) {
  const id = (who: string) => created[`${who}@teste.local`]!;
  const groups = new Map((await prisma.group.findMany({ select: { id: true, name: true } })).map(g => [g.name, g.id]));
  const at = (h: number) => new Date(Date.now() - h * 3_600_000);

  for (const p of POSTS) {
    await prisma.post.create({
      data: {
        authorId: id(p.author),
        title: p.title ?? '',
        text: p.text,
        area: p.area ?? null,
        groupId: p.group ? (groups.get(p.group) ?? null) : null,
        visibility: p.visibility ?? 'publico',
        tags: p.tags ?? [],
        xpShown: p.xp ?? null,
        createdAt: at(p.hoursAgo),
        likes: { create: p.likes.map((u, i) => ({ userId: id(u), createdAt: at(p.hoursAgo - 0.1 * (i + 1)) })) },
        comments: { create: (p.comments ?? []).map(([u, text, h]) => ({ authorId: id(u), text, createdAt: at(h) })) },
      },
    });
  }
  return POSTS.length;
}
