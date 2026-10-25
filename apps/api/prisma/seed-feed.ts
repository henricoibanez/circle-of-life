/**
 * Posts de exemplo, inspirados no protótipo (constante posts), sem nível e
 * sequência e coerentes com o backlog do Henrico (sprint 11 encerrada com 9/10).
 * Cada post tem uma foto de prisma/seed-images.
 */
import type { Area, PrismaClient, Visibility } from '../src/generated/prisma/client';
import type { SeedImages } from './seed-images';

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
  photo?: string;
  likes: string[];
  comments?: [author: string, text: string, hoursAgo: number][];
};

const POSTS: PostSeed[] = [
  {
    author: 'henrico',
    hoursAgo: 20,
    group: 'Time Ágil',
    title: 'Sprint 11 encerrada: 9 de 10 tarefas prontas',
    text: 'Só a reunião com o corretor ficou para a próxima. O melhor da sprint foi começar a hidratação diária: já estou na semana 2.',
    area: 'saude',
    tags: ['sprint', 'constância', 'timeágil'],
    photo: 'po_agua',
    likes: ['julia', 'lucas', 'tiago'],
    comments: [
      ['julia', 'Que demais! A hidratação foi a mais difícil pra mim também.', 18],
      ['tiago', 'Semana 2 é onde a maioria desiste. Segura firme!', 12],
    ],
  },
  {
    author: 'julia',
    hoursAgo: 5,
    area: 'emocional',
    title: 'Épico encerrado: Diário de 30 dias',
    text: 'Escrevi uma página por dia durante um mês inteiro. Nunca imaginei que fosse conseguir.',
    xp: 50,
    photo: 'po_diario',
    likes: ['henrico', 'lucas', 'barbara'],
    comments: [['barbara', 'Me inspirou a voltar a escrever. Começo amanhã.', 3]],
  },
  {
    author: 'lucas',
    hoursAgo: 9,
    area: 'profissional',
    title: 'Épico encerrado: Plataforma de Aprendizado 🚀',
    text: 'Seis meses de trabalho à noite. Hoje o primeiro aluno de verdade fez login. Agora é ver se alguém usa.',
    xp: 50,
    tags: ['carreira'],
    photo: 'po_laptop',
    likes: ['julia', 'tiago', 'henrico'],
  },
  {
    author: 'tiago',
    hoursAgo: 26,
    area: 'saude',
    title: 'Épico encerrado: correr 5 km',
    text: 'Seis semanas atrás eu não corria até a esquina. Hoje foram 5 km sem parar, em 34 minutos.',
    xp: 50,
    photo: 'po_corrida',
    likes: ['barbara', 'henrico'],
    comments: [['henrico', 'Que evolução! Qual o próximo objetivo?', 24]],
  },
  {
    author: 'barbara',
    hoursAgo: 50,
    group: 'Leitores de Homero',
    area: 'intelectual',
    text: 'Terminei o canto 6 da Ilíada. A despedida de Heitor e Andrômaca é a cena mais humana que já li.',
    tags: ['ilíada', 'clássicos'],
    photo: 'po_iliada',
    likes: ['julia', 'henrico'],
  },
  {
    author: 'vinicius',
    hoursAgo: 30,
    area: 'lazer',
    text: 'Primeira semana usando o quadro. Tirei do papel duas tarefas que estavam paradas há meses.',
    photo: 'po_kanban',
    likes: ['tiago'],
  },
];

export async function seedFeed(prisma: PrismaClient, created: Record<string, string>, images: SeedImages) {
  const id = (who: string) => created[`${who}@teste.local`]!;
  const groups = new Map((await prisma.group.findMany({ select: { id: true, name: true } })).map(g => [g.name, g.id]));
  const at = (h: number) => new Date(Date.now() - h * 3_600_000);

  for (const p of POSTS) {
    const fileId = p.photo ? await images.put(id(p.author), 'post', p.photo, at(p.hoursAgo)) : null;
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
        media: fileId ? { create: [{ fileId, position: 0 }] } : undefined,
        likes: { create: p.likes.map((u, i) => ({ userId: id(u), createdAt: at(p.hoursAgo - 0.1 * (i + 1)) })) },
        comments: { create: (p.comments ?? []).map(([u, text, h]) => ({ authorId: id(u), text, createdAt: at(h) })) },
      },
    });
  }
  return POSTS.length;
}
