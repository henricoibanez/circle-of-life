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
import { seedRoda } from './seed-exercises';

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
  { email: 'vinicius@teste.local', name: 'Vinícius Lima', handle: 'viniciuslima', bio: '', xpTotal: 480 },
  { email: 'novo@teste.local', name: 'Usuário Novo', handle: 'usuarionovo', bio: '' },
];

async function main() {
  // Apaga só o que o seed criou (usuários de teste e seus convites, em cascata).
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

  const henrico = created['henrico@teste.local']!;
  const backlog = await seedBacklog(prisma, henrico);
  await seedRoda(prisma, henrico);

  console.log(`✓ Seed concluído: ${USERS.length} usuários de teste, 1 convite pendente (convidado@teste.local) e o backlog do Henrico (${backlog.initiatives} iniciativas, ${backlog.epics} épicos, ${backlog.tasks} tarefas, sprints 10 a 12) e os exercícios de reflexão.`);
}

main()
  .catch(err => {
    console.error('✗ Erro no seed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
