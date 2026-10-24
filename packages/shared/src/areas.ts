/**
 * As 10 áreas da Roda da Vida. Ids, nomes, ícones, cores e textos vêm do
 * protótipo (constante AREAS) e devem ser usados exatamente assim.
 */

export const AREA_IDS = [
  'lazer',
  'amor',
  'financas',
  'familia',
  'intelectual',
  'espiritualidade',
  'sociedade',
  'saude',
  'emocional',
  'profissional',
] as const;

export type AreaId = (typeof AREA_IDS)[number];

/** Ilustrações de paisagem do protótipo (componente Art). */
export type ArtVariant = 'lake' | 'sun' | 'forest' | 'sea' | 'night' | 'field';

export type Area = {
  id: AreaId;
  name: string;
  /** Nome do ícone (conjunto de ícones do protótipo). */
  icon: string;
  color: string;
  art: ArtVariant;
  /** Pergunta principal da área. */
  q: string;
  /** Slogan da área (aparece em Minhas conquistas). */
  tag: string;
  /** Perguntas de reflexão do "Me ajude a refletir". */
  p: [string, string];
};

export const AREAS: Area[] = [
  { id: 'lazer', name: 'Lazer', icon: 'umbrella', color: '#8b5cf6', art: 'sea', q: 'Quanto você tem se divertido e descansado?', tag: 'Momentos de descanso, diversão e renovação que me fazem bem.', p: ['O que eu fazia por prazer e deixei de fazer?', 'Meu descanso é descanso ou é tela?'] },
  { id: 'amor', name: 'Relacionamento amoroso', icon: 'heart', color: '#ef4444', art: 'sun', q: 'Como está sua vida amorosa?', tag: 'Construindo conexão, amor e parceria todos os dias.', p: ['Quando foi a última vez que planejamos algo só nosso?', 'O que eu calo que deveria dizer?'] },
  { id: 'financas', name: 'Financeira', icon: 'banknote', color: '#16a34a', art: 'field', q: 'Como você se sente em relação ao seu dinheiro?', tag: 'Decisões inteligentes que me aproximam da liberdade.', p: ['Sei para onde foi meu dinheiro no último mês?', 'Quanto tempo eu aguentaria sem renda?'] },
  { id: 'familia', name: 'Família e amigos', icon: 'users', color: '#f59e0b', art: 'sun', q: 'Como estão seus relacionamentos próximos?', tag: 'Laços que me fortalecem e me apoiam.', p: ['Para quem eu deveria ligar hoje?', 'Estou presente quando estou presente?'] },
  { id: 'intelectual', name: 'Intelectual', icon: 'book', color: '#3b82f6', art: 'night', q: 'Como você desenvolve sua mente e aprende?', tag: 'Aprendizados que expandem minha mente e visão.', p: ['O que aprendi este mês que mudou alguma decisão?', 'Leio para entender ou para acumular?'] },
  { id: 'espiritualidade', name: 'Espiritual', icon: 'lotus', color: '#14b8a6', art: 'forest', q: 'Como está sua conexão com seu propósito?', tag: 'Conexão com meu propósito e com o que me transcende.', p: ['Em que eu acredito, de fato, quando ninguém está olhando?', 'Reservo tempo para o silêncio?'] },
  { id: 'sociedade', name: 'Sociedade', icon: 'handshake', color: '#eab308', art: 'field', q: 'Como você contribui para o mundo ao seu redor?', tag: 'O que eu devolvo para as pessoas e para a cidade.', p: ['Quem se beneficiou do meu tempo esta semana, além de mim?', 'Que causa me incomoda a ponto de agir?'] },
  { id: 'saude', name: 'Física', icon: 'dumbbell', color: '#a855f7', art: 'lake', q: 'Como está seu corpo e sua saúde?', tag: 'Corpo cuidado, disposição para o resto.', p: ['Estou me movimentando por prazer ou por culpa?', 'Tenho um plano para envelhecer com autonomia?'] },
  { id: 'emocional', name: 'Emocional', icon: 'smile', color: '#0ea5e9', art: 'lake', q: 'Como você lida com suas emoções?', tag: 'Equilíbrio para lidar com o que sinto.', p: ['O que tem me tirado o sono?', 'Consigo dizer não sem culpa?'] },
  { id: 'profissional', name: 'Profissional e carreira', icon: 'briefcase', color: '#65a30d', art: 'night', q: 'Como você se sente em relação ao seu trabalho?', tag: 'Trabalho que tem sentido e me desafia.', p: ['Meu trabalho de hoje me aproxima de quem quero ter sido?', 'O que eu aprenderia se não tivesse medo de errar?'] },
];

export const AREA = Object.fromEntries(AREAS.map(a => [a.id, a])) as Record<AreaId, Area>;

export const isAreaId = (v: unknown): v is AreaId => typeof v === 'string' && (AREA_IDS as readonly string[]).includes(v);
