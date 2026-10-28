/**
 * Trilhas de exemplo (cada trilha é um épico com as tarefas): as oficiais do protótipo
 * (constante TRILHAS, com os Clássicos Gregos em duas trilhas), uma paga em XP publicada
 * pela Julia e uma aguardando aprovação do Lucas. As trilhas dos grupos vêm do seed-social.
 */
import type { PrismaClient } from '../src/generated/prisma/client';

type Seed = {
  title: string;
  area: string;
  cat: string;
  art: string;
  c: string;
  cover?: string;
  desc: string;
  dl: number;
  price?: number;
  tasks: string[];
};

const OFFICIAL: Seed[] = [
  { title: 'Épico Livro do CNV', area: 'amor', cat: 'relacionamento', art: 'night', c: '#1e3a5f', cover: 'ÉPICO\nLIVRO DO\nCNV', desc: 'Aprenda Comunicação Não Violenta na prática e melhore seus relacionamentos.', dl: 12400, tasks: ['Capítulos 1 a 3', 'Capítulos 4 a 6', 'Capítulos 7 a 9', 'Capítulos 10 a 13', 'Fazer um pedido claro por dia durante uma semana', 'Conversar sobre uma necessidade sem acusar'] },
  { title: 'Beba Água, Viva Melhor', area: 'saude', cat: 'saude', art: 'lake', c: '#7aa6c8', desc: 'Crie o hábito de beber água todos os dias e sinta mais disposição e foco.', dl: 8700, tasks: ['Descobrir quanto de água preciso por dia', 'Semana 1: 500 ml a mais por dia', 'Semana 2: 1 litro a mais por dia', 'Semana 3: atingir a meta diária', 'Semana 4: manter a meta sem lembrete'] },
  { title: 'Conexões que Constroem', area: 'amor', cat: 'relacionamento', art: 'sun', c: '#d97706', desc: 'Atividades práticas para fortalecer o relacionamento e criar memórias.', dl: 6500, tasks: ['Marcar um encontro por semana', 'Fazer uma lista de 10 lugares para conhecer juntos', 'Uma conversa sem celular por dia'] },
  { title: 'Descubra um Novo Hobby', area: 'lazer', cat: 'hobbies', art: 'field', c: '#b45309', desc: 'Explore novas paixões e desenvolva um hobby que faz bem para a mente.', dl: 5200, tasks: ['Listar 5 coisas que gostaria de aprender', 'Escolher uma e comprar o mínimo necessário', 'Praticar 20 minutos, 3 vezes por semana', 'Mostrar o resultado para alguém'] },
  { title: 'Treino Consistente', area: 'saude', cat: 'saude', art: 'night', c: '#374151', desc: 'Monte sua rotina de treinos e mantenha o corpo e a mente em movimento.', dl: 15100, tasks: ['Fazer check-up médico', 'Escolher a modalidade', 'Treinar 2 vezes na semana 1', 'Treinar 3 vezes na semana 2', 'Treinar 3 vezes por 4 semanas seguidas'] },
  { title: 'Organize suas Finanças', area: 'financas', cat: 'financeira', art: 'field', c: '#a16207', desc: 'Passo a passo para sair das dívidas, investir e conquistar liberdade financeira.', dl: 9300, tasks: ['Anotar todos os gastos por 30 dias', 'Calcular o custo de vida mensal', 'Definir a meta de 6 meses', 'Abrir uma conta só para a reserva', 'Programar transferência automática'] },
  { title: 'Ilíada, de Homero', area: 'intelectual', cat: 'estudos', art: 'night', c: '#7c2d12', desc: 'A Ilíada em leituras de poucos cantos por semana.', dl: 3100, tasks: ['Cantos 1 a 4', 'Cantos 5 a 8', 'Cantos 9 a 12', 'Cantos 13 a 18', 'Cantos 19 a 24'] },
  { title: 'Odisseia, de Homero', area: 'intelectual', cat: 'estudos', art: 'lake', c: '#1e3a5f', desc: 'A volta de Ulisses para casa, em quatro etapas de leitura.', dl: 2600, tasks: ['Cantos 1 a 6', 'Cantos 7 a 12', 'Cantos 13 a 18', 'Cantos 19 a 24'] },
  { title: 'Silêncio Diário', area: 'espiritualidade', cat: 'espiritualidade', art: 'forest', c: '#0f766e', desc: 'Dez minutos por dia sem tela, sem barulho.', dl: 4400, tasks: ['Escolher um horário fixo', '10 minutos de silêncio por 7 dias', 'Ler um texto religioso ou filosófico por semana', 'Escrever uma linha sobre o que percebi'] },
];

const JULIA: Seed = { title: 'Diário de 30 dias', area: 'emocional', cat: 'pessoal', art: 'sun', c: '#0ea5e9', desc: 'Uma página por dia durante um mês, com perguntas que ajudam a começar.', dl: 0, price: 100, tasks: ['Escolher caderno e horário', 'Semana 1: uma página por dia', 'Semana 2: uma página por dia', 'Semana 3: uma página por dia', 'Semana 4: reler tudo e escrever uma carta para mim'] };
const LUCAS: Seed = { title: 'Projeto Paralelo em 8 Semanas', area: 'profissional', cat: 'pessoal', art: 'night', c: '#1e3a8a', desc: 'Tirar uma ideia do papel trabalhando poucas horas por semana, à noite.', dl: 0, tasks: ['Escrever a ideia em uma página', 'Fazer a versão mais simples possível', 'Mostrar para 5 pessoas', 'Ajustar com o que ouvi'] };

async function create(prisma: PrismaClient, s: Seed, status: 'aprovada' | 'pendente', authorId: string | null) {
  const t = await prisma.trilha.create({
    data: {
      rootId: 'tmp',
      authorId,
      title: s.title,
      description: s.desc,
      category: s.cat,
      area: s.area as never,
      art: s.art,
      color: s.c,
      coverText: s.cover ?? null,
      priceXp: s.price ?? 0,
      status,
      baseDownloads: s.dl,
      tasks: { create: s.tasks.map((title, j) => ({ title, position: j })) },
    },
  });
  return prisma.trilha.update({ where: { id: t.id }, data: { rootId: t.id } });
}

export async function seedTrilhas(prisma: PrismaClient, users: Record<string, string>) {
  // Trilhas oficiais e de usuários de teste são recriadas a cada seed.
  await prisma.trilha.deleteMany({ where: { OR: [{ authorId: null }, { author: { isTestUser: true } }] } });
  for (const s of OFFICIAL) await create(prisma, s, 'aprovada', null);
  await create(prisma, JULIA, 'aprovada', users['julia@teste.local']!);
  await create(prisma, LUCAS, 'pendente', users['lucas@teste.local']!);
}
