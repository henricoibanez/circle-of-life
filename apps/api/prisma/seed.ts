/**
 * Seed: dados de exemplo para o ambiente local.
 *
 * Recria os usuários de teste (os do protótipo) e um convite pendente.
 * Pode ser rodado quantas vezes quiser: apaga os dados de teste e cria
 * de novo. Só roda com NODE_ENV=development, para nunca tocar em dados reais.
 *
 * Rodar: pnpm --filter @circle/api db:seed
 * Zerar o banco inteiro e semear de novo: pnpm --filter @circle/api db:reset
 *
 * A cada etapa, este arquivo cresce com o restante do cenário do protótipo
 * (backlog, sprint, exercícios, social…).
 */
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';
import { seedBacklog } from './seed-backlog';
import { seedFeed } from './seed-feed';
import { SeedImages } from './seed-images';
import { clearSocial, seedSocial } from './seed-social';
import { seedStories } from './seed-stories';
import { seedTrilhas } from './seed-trilhas';
import { seedDreams, seedMaslow, seedNecrologio, seedRoda } from './seed-exercises';

loadEnv({ path: resolve(__dirname, '../../../.env'), quiet: true });

if (process.env.NODE_ENV !== 'development') {
  console.error('✗ O seed só roda com NODE_ENV=development (para não mexer em dados reais).');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** Token fixo do convite de teste, para o link funcionar sempre igual no ambiente local. */
const TEST_INVITE_TOKEN = 'convite-de-teste-local';

const USERS: Prisma.UserCreateInput[] = [
  {
    email: 'henrico@teste.local',
    name: 'Henrico Ibanez',
    handle: 'henricoibanez',
    role: 'admin',
    bio: 'Construindo uma vida com propósito, foco e liberdade.',
    xpTotal: 2450,
  },
  { email: 'julia@teste.local', name: 'Julia Fernandes', handle: 'juliafernandes', bio: 'Uma página por dia.', xpTotal: 2780 },
  { email: 'lucas@teste.local', name: 'Lucas Almeida', handle: 'lucasalmeida', bio: 'Construindo coisas à noite.', xpTotal: 1940 },
  { email: 'tiago@teste.local', name: 'Tiago Moron', handle: 'tiagomoron', bio: 'Correndo atrás dos 5 km.', xpTotal: 1620 },
  { email: 'barbara@teste.local', name: 'Bárbara Sajo', handle: 'barbarasajo', bio: 'Lendo os clássicos devagar.', xpTotal: 1310 },
  { email: 'vinicius@teste.local', name: 'Vinícius Lima', handle: 'viniciuslima', bio: 'Começando a planejar a vida em sprints.', xpTotal: 480 },
  { email: 'novo@teste.local', name: 'Usuário Novo', handle: 'usuarionovo', bio: '' },
];

async function main() {
  // Apaga só o que o seed criou (usuários de teste e seus convites, em cascata).
  const old = await prisma.user.findMany({ where: { isTestUser: true }, select: { id: true } });
  await clearSocial(prisma, old.map(u => u.id));
  await prisma.user.deleteMany({ where: { isTestUser: true } });

  const created: Record<string, string> = {};
  for (const data of USERS) {
    const user = await prisma.user.create({ data: { ...data, isTestUser: true } });
    created[user.email] = user.id;
  }

  await prisma.invite.create({
    data: {
      email: 'convidado@teste.local',
      tokenHash: createHash('sha256').update(TEST_INVITE_TOKEN).digest('hex'),
      invitedById: created['henrico@teste.local']!,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // Fotos de perfil dos amigos (o Henrico e o Usuário Novo ficam com as iniciais).
  const images = new SeedImages(prisma);
  for (const who of ['julia', 'lucas', 'tiago', 'barbara', 'vinicius']) {
    const userId = created[`${who}@teste.local`]!;
    const photoFileId = await images.put(userId, 'avatar', `av_${who}`);
    if (photoFileId) await prisma.user.update({ where: { id: userId }, data: { photoFileId } });
  }

  const henrico = created['henrico@teste.local']!;
  const backlog = await seedBacklog(prisma, henrico);
  await seedRoda(prisma, henrico);
  await seedMaslow(prisma, henrico);
  await seedNecrologio(prisma, henrico);
  await seedDreams(prisma, henrico, images);
  await seedTrilhas(prisma, created);
  const social = await seedSocial(prisma, created);
  const posts = await seedFeed(prisma, created, images);
  const stories = await seedStories(prisma, created, images);
  await seedActivity(prisma, created);
  const late = await prisma.task.findFirst({ where: { userId: henrico, title: { startsWith: 'Lição de casa' } } });
  if (late) {
    await prisma.task.update({ where: { id: late.id }, data: { overdueNotifiedAt: new Date() } });
    await prisma.notification.create({
      data: { userId: henrico, type: 'tarefa_atrasada', title: 'Tarefa atrasada', body: `“${late.title}” passou do prazo.`, link: '/board', refId: late.id },
    });
  }

  console.log(`✓ Seed concluído: ${USERS.length} usuários de teste, 1 convite pendente (convidado@teste.local) e o backlog do Henrico (${backlog.initiatives} iniciativas, ${backlog.epics} épicos, ${backlog.tasks} tarefas, sprints 10 a 12) os exercícios de reflexão, 11 trilhas na loja (1 aguardando aprovação), trilhas dos grupos (1 sugestão aguardando gestor), ${social.groups} grupos, ${social.friendships} amizades, ${posts} posts e ${stories} stories.`);
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

/** Atividade recente do Henrico (tela de perfil) e avisos coerentes com os posts de exemplo. */
async function seedActivity(prisma: PrismaClient, created: Record<string, string>) {
  const henrico = created['henrico@teste.local']!;
  const ACTIVITY: [icon: string, text: string, link: string, hours: number][] = [
    ['feather', 'Você escreveu no seu necrológio', '/necrologio', 6 * 24],
    ['flag', 'Você encerrou a sprint 11 (9/10)', '/board', 5 * 24],
    ['checkSq', 'Você concluiu “Canto 1: a ira de Aquiles”', '/board', 4 * 24],
    ['checkSq', 'Você concluiu “Encontro 09”', '/board', 3 * 24],
    ['checkSq', 'Você concluiu “Pesquisar bairros”', '/board', 2 * 24],
    ['checkSq', 'Você concluiu “Música do Red Dead 2”', '/board', 26],
    ['trophy', 'Você encerrou o épico “Gaita de boca”', '/quadro?aba=conquistas', 25],
    ['star', 'Você realizou um sonho: “Tocar gaita numa roda de amigos”', '/quadro', 10 * 24],
  ];
  await prisma.activityEvent.createMany({ data: ACTIVITY.map(([icon, text, link, h]) => ({ userId: henrico, icon, text, link, createdAt: hoursAgo(h) })) });

  const post = await prisma.post.findFirst({ where: { authorId: henrico }, orderBy: { createdAt: 'desc' } });
  if (post) {
    const link = `/feed?post=${post.id}`;
    await prisma.notification.createMany({
      data: [
        { userId: henrico, type: 'curtida', title: 'Tiago e mais 2 pessoas curtiram seu post', body: post.title, link, actorId: created['tiago@teste.local'], refId: post.id, createdAt: hoursAgo(15) },
        { userId: henrico, type: 'comentario', title: 'Tiago comentou seu post', body: '“Semana 2 é onde a maioria desiste. Segura firme!”', link, actorId: created['tiago@teste.local'], refId: post.id, createdAt: hoursAgo(12) },
        { userId: henrico, type: 'comentario', title: 'Julia comentou seu post', body: '“Que demais! A hidratação foi a mais difícil pra mim também.”', link, actorId: created['julia@teste.local'], refId: post.id, readAt: hoursAgo(17), createdAt: hoursAgo(18) },
      ],
    });
  }
}

main()
  .catch(err => {
    console.error('✗ Erro no seed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
