import { AREA, AREA_IDS, type AnalysisContent, type AnalysisSuggestion, type AreaId } from '@circle/shared';
import type { AnalysisInput } from './analysis-input';

/**
 * IA simulada (AI_MODE=mock): monta um relatório realista a partir dos dados
 * reais da pessoa, com regras simples e sem chamar nenhum serviço externo.
 */

/** Palavras do necrológio que indicam cada área. */
const KEYWORDS: Record<AreaId, string[]> = {
  lazer: ['viag', 'música', 'gaita', 'hobby', 'descans', 'férias', 'praia'],
  amor: ['esposa', 'marido', 'casamento', 'namor', 'companheir', 'amor'],
  financas: ['dinheiro', 'casa', 'reserva', 'invest', 'dívida', 'finan'],
  familia: ['filh', 'família', 'pais', 'amig', 'netos', 'irmã'],
  intelectual: ['livro', 'ler', 'leitura', 'estud', 'curso', 'clássic', 'escrev'],
  espiritualidade: ['fé', 'deus', 'oração', 'espiritual', 'silêncio', 'medita', 'igreja'],
  sociedade: ['comunidade', 'voluntári', 'doar', 'ong', 'ajudou', 'cidade'],
  saude: ['saúde', 'corr', 'treino', 'corpo', 'dormir', 'caminh', 'esporte'],
  emocional: ['calma', 'ansiedade', 'emoç', 'terapia', 'paz', 'alegria'],
  profissional: ['trabalho', 'carreira', 'empresa', 'equipe', 'profiss', 'negócio'],
};

/** Trilhas sugeridas por área (iniciativa → épicos → tarefas). */
/** Formato da biblioteca (mais enxuto): épico com uma área e tarefas só com o título. */
type LibrarySuggestion = {
  iniciativa: { titulo: string; descricao: string; areas: AreaId[] };
  epicos: { titulo: string; area: AreaId; tarefas: string[] }[];
};

const LIBRARY: Record<AreaId, LibrarySuggestion> = {
  lazer: {
    iniciativa: { titulo: 'Tempo livre de verdade', descricao: 'Separar horas da semana para o que você faz por prazer, sem tela.', areas: ['lazer', 'emocional'] },
    epicos: [
      { titulo: 'Um hobby por semana', area: 'lazer', tarefas: ['Listar 5 coisas que você gostava de fazer', 'Escolher uma para os próximos 30 dias', 'Reservar 2 horas no sábado para ela'] },
      { titulo: 'Descanso sem tela', area: 'emocional', tarefas: ['Definir um horário para largar o celular', 'Deixar um livro na mesa de cabeceira', 'Fazer uma noite por semana sem tela'] },
    ],
  },
  amor: {
    iniciativa: { titulo: 'Mais tempo a dois', descricao: 'Encontros marcados e conversas sem pressa com quem você divide a vida.', areas: ['amor'] },
    epicos: [
      { titulo: 'Encontros marcados', area: 'amor', tarefas: ['Marcar um encontro por semana na agenda', 'Fazer uma lista de 10 lugares para conhecer juntos', 'Planejar uma viagem curta a dois'] },
      { titulo: 'Conversas que importam', area: 'amor', tarefas: ['Uma conversa de 20 minutos sem celular por dia', 'Perguntar o que a outra pessoa espera do próximo ano', 'Escrever uma carta de agradecimento'] },
    ],
  },
  financas: {
    iniciativa: { titulo: 'Organização financeira', descricao: 'Saber para onde vai o dinheiro e montar a reserva de emergência.', areas: ['financas'] },
    epicos: [
      { titulo: 'Raio-x dos gastos', area: 'financas', tarefas: ['Anotar todos os gastos por 30 dias', 'Separar gastos fixos e variáveis', 'Cortar uma assinatura que você não usa'] },
      { titulo: 'Reserva de emergência', area: 'financas', tarefas: ['Calcular o custo de vida mensal', 'Abrir uma conta só para a reserva', 'Programar uma transferência automática no dia do pagamento'] },
    ],
  },
  familia: {
    iniciativa: { titulo: 'Perto de quem importa', descricao: 'Ligações, visitas e rituais simples com família e amigos.', areas: ['familia'] },
    epicos: [
      { titulo: 'Rotina de contato', area: 'familia', tarefas: ['Ligar para uma pessoa da família por semana', 'Marcar um almoço de domingo por mês', 'Criar um grupo para combinar os encontros'] },
      { titulo: 'Amizades antigas', area: 'familia', tarefas: ['Listar 3 amigos com quem você perdeu contato', 'Mandar uma mensagem para cada um', 'Marcar um café com pelo menos um'] },
    ],
  },
  intelectual: {
    iniciativa: { titulo: 'Leitura com constância', descricao: 'Ler um pouco todo dia e transformar o que leu em algo que você compartilha.', areas: ['intelectual'] },
    epicos: [
      { titulo: 'Hábito de leitura', area: 'intelectual', tarefas: ['Escolher o próximo livro', 'Ler 15 minutos antes de dormir', 'Anotar uma ideia por capítulo'] },
      { titulo: 'Compartilhar o que aprendeu', area: 'intelectual', tarefas: ['Escrever um resumo de uma página', 'Conversar sobre o livro com alguém', 'Publicar uma reflexão no feed'] },
    ],
  },
  espiritualidade: {
    iniciativa: { titulo: 'Prática diária curta', descricao: 'Dez minutos por dia para silêncio, oração ou leitura que dê sentido.', areas: ['espiritualidade', 'emocional'] },
    epicos: [
      { titulo: 'Dez minutos de silêncio', area: 'espiritualidade', tarefas: ['Escolher um horário fixo', 'Fazer 10 minutos de silêncio por 7 dias', 'Escrever uma linha sobre o que percebeu'] },
      { titulo: 'Leitura que dá sentido', area: 'espiritualidade', tarefas: ['Escolher um texto religioso ou filosófico', 'Ler um trecho por semana', 'Conversar sobre ele com alguém de confiança'] },
    ],
  },
  sociedade: {
    iniciativa: { titulo: 'Doar tempo', descricao: 'Um compromisso pequeno e fixo com uma causa da sua cidade.', areas: ['sociedade'] },
    epicos: [
      { titulo: 'Encontrar uma causa', area: 'sociedade', tarefas: ['Listar 3 causas que mexem com você', 'Pesquisar ONGs perto de casa', 'Visitar uma delas'] },
      { titulo: 'Compromisso mensal', area: 'sociedade', tarefas: ['Combinar um dia por mês de voluntariado', 'Convidar um amigo para ir junto', 'Registrar o que mudou depois de 3 meses'] },
    ],
  },
  saude: {
    iniciativa: { titulo: 'Corpo em movimento', descricao: 'Exercício regular, água e sono para ter energia no dia a dia.', areas: ['saude'] },
    epicos: [
      { titulo: 'Rotina de exercícios', area: 'saude', tarefas: ['Fazer check-up médico', 'Caminhar 30 minutos 3 vezes na semana', 'Escolher uma modalidade para os próximos 2 meses'] },
      { titulo: 'Sono e hidratação', area: 'saude', tarefas: ['Definir um horário para dormir', 'Beber 2 litros de água por dia durante uma semana', 'Tirar o celular do quarto'] },
    ],
  },
  emocional: {
    iniciativa: { titulo: 'Cuidar da cabeça', descricao: 'Perceber o que sente e ter com quem conversar.', areas: ['emocional'] },
    epicos: [
      { titulo: 'Diário curto', area: 'emocional', tarefas: ['Escrever 3 linhas por noite durante 2 semanas', 'Anotar o que deu energia e o que tirou', 'Reler as anotações no fim do mês'] },
      { titulo: 'Rede de apoio', area: 'emocional', tarefas: ['Listar 3 pessoas com quem você pode contar', 'Marcar uma conversa com uma delas', 'Pesquisar um profissional de terapia'] },
    ],
  },
  profissional: {
    iniciativa: { titulo: 'Próximo passo na carreira', descricao: 'Clareza sobre onde quer chegar e um plano de estudo para isso.', areas: ['profissional', 'intelectual'] },
    epicos: [
      { titulo: 'Mapa da carreira', area: 'profissional', tarefas: ['Escrever onde quer estar em 3 anos', 'Conversar com alguém que já chegou lá', 'Listar as 3 habilidades que faltam'] },
      { titulo: 'Plano de estudo', area: 'intelectual', tarefas: ['Escolher um curso para a primeira habilidade', 'Reservar 2 horas por semana para ele', 'Aplicar o que aprendeu num projeto real'] },
    ],
  },
};

/** Converte uma trilha da biblioteca para o formato do relatório. */
function toSuggestion(s: LibrarySuggestion, porque: string): AnalysisSuggestion {
  return {
    iniciativa: { ...s.iniciativa, porque },
    epicos: s.epicos.map(e => ({ titulo: e.titulo, areas: [e.area], tarefas: e.tarefas.map(t => ({ titulo: t, descricao: '' })) })),
  };
}

const clamp = (n: number) => Math.max(5, Math.min(95, Math.round(n)));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const nomeArea = (a: AreaId) => AREA[a].name.toLowerCase();

export function mockAnalysis(input: AnalysisInput): AnalysisContent {
  const necro = (input.necrologio ?? '').toLowerCase();
  const facts = AREA_IDS.map(area => {
    const nota = input.roda?.notas[area] ?? null;
    const epicos = input.tarefas?.flatMap(i => i.epicos).filter(e => e.area === area) ?? [];
    const ativos = epicos.filter(e => !e.encerrado).length;
    const feitas = epicos.reduce((s, e) => s + e.feitas, 0);
    const parado = epicos.reduce((s, e) => s + e.tarefas.filter(t => t.status === 'no backlog').length, 0);
    const sonhos = input.quadro?.filter(d => d.area === area && !d.realizado).length ?? 0;
    const citada = KEYWORDS[area].some(k => necro.includes(k));
    const execucao = input.tarefas ? Math.min(1, ativos * 0.25 + feitas * 0.05) : 0.5;
    const contentamento = nota === null ? 0.5 : nota / 10;
    const pct = clamp(contentamento * 45 + execucao * 45 + (citada || sonhos ? 4 : 10));
    const desejo = (citada ? 2 : 0) + (sonhos ? 2 : 0) + (nota !== null && nota <= 5 ? 1 : 0);
    return { area, nota, ativos, feitas, parado, sonhos, citada, pct, desejo };
  });

  // Gaps: áreas que a pessoa diz querer (necrológio, sonhos, nota baixa) e quase não executa.
  const gaps = [...facts].filter(f => f.desejo > 0).sort((a, b) => b.desejo - a.desejo || a.pct - b.pct);
  const fortes = [...facts].filter(f => f.ativos > 0 || (f.nota ?? 0) >= 7).sort((a, b) => b.pct - a.pct);
  const geral = Math.round(facts.reduce((s, f) => s + f.pct, 0) / facts.length);
  const pior = gaps[0] ?? [...facts].sort((a, b) => a.pct - b.pct)[0]!;
  const melhor = fortes[0];
  const voce = input.nome ? `${input.nome}, você` : 'Você';
  const totalFeitas = facts.reduce((s, f) => s + f.feitas, 0);
  const totalParadas = facts.reduce((s, f) => s + f.parado, 0);

  const retrato = [
    `${voce} já colocou no papel o que importa para você${input.necrologio ? ', e o seu necrológio deixa isso claro' : ''}.`,
    melhor ? `A área ${nomeArea(melhor.area)} é onde você mais transforma intenção em ação.` : 'Você ainda está no começo da execução.',
    `O problema está em ${nomeArea(pior.area)}: você diz que quer, mas quase nada disso virou tarefa.`,
    input.tarefas ? `Você concluiu ${plural(totalFeitas, 'tarefa', 'tarefas')} e deixou ${plural(totalParadas, 'parada', 'paradas')} no backlog.` : '',
    'O momento pede menos intenção e mais compromisso com o que você escreveu.',
  ]
    .filter(Boolean)
    .join(' ');

  const gapText = (f: (typeof facts)[number]) => {
    const motivos = [f.citada && 'aparece no seu necrológio', f.sonhos && `tem ${plural(f.sonhos, 'sonho', 'sonhos')} no quadro`, f.nota !== null && `recebeu nota ${f.nota} na roda`].filter(Boolean).join(', ');
    return `A área ${nomeArea(f.area)} ${motivos || 'pede atenção'}, mas ${f.ativos ? `tem só ${plural(f.ativos, 'épico ativo', 'épicos ativos')}` : 'não tem nenhum épico ativo'}. Desejo sem tarefa não sai do papel.`;
  };

  const padroes = [
    melhor
      ? { titulo: `${AREA[melhor.area].name} anda`, texto: `Você executa em ${nomeArea(melhor.area)}${melhor.feitas ? `: ${plural(melhor.feitas, 'tarefa concluída', 'tarefas concluídas')}` : ''}. É a prova de que você sabe fazer quando decide.` }
      : { titulo: 'Começo de caminho', texto: 'Você já preencheu os exercícios. Agora falta transformar isso em tarefas.' },
    { titulo: 'Você mede a sua vida', texto: 'Ter os exercícios preenchidos coloca você à frente de quem só pensa no assunto.' },
    input.maslow
      ? { titulo: `Nível ${input.maslow.nivelAtual.toLowerCase()} da pirâmide`, texto: 'A base que falta nesse nível pesa em todo o resto. Comece por ela.' }
      : { titulo: 'Clareza antes de pressa', texto: 'Releia o seu necrológio antes da planning e veja se o backlog ainda conversa com ele.' },
  ];

  const sugestoes = gaps
    .slice(0, 3)
    .map(f => toSuggestion(LIBRARY[f.area], `A área ${nomeArea(f.area)} aparece no que você quer, mas quase não aparece no que você faz.`));
  if (!sugestoes.length) sugestoes.push(toSuggestion(LIBRARY[pior.area], `A área ${nomeArea(pior.area)} é a menos alinhada hoje.`));

  return {
    retrato,
    geral,
    padroes,
    gaps: (gaps.length ? gaps : [pior]).slice(0, 3).map(f => ({ titulo: `${AREA[f.area].name} sem plano`, texto: gapText(f) })),
    manter: melhor ? [`O ritmo em ${nomeArea(melhor.area)}.`] : ['O hábito de preencher os exercícios.'],
    ajustar: ['Planejar menos tarefas por sprint e terminar o que começou.', `Colocar pelo menos uma tarefa de ${nomeArea(pior.area)} em toda sprint.`],
    abandonar: ['Criar tarefas novas antes de concluir as que estão paradas.'],
    proximos7dias: [
      `Escolher uma tarefa de ${nomeArea(pior.area)} e colocar na sprint hoje.`,
      'Reler o necrológio e riscar do backlog o que não conversa com ele.',
      'Concluir a tarefa mais antiga que está em "Fazendo".',
    ],
    limitantes: [
      { nome: 'Intenção sem agenda', texto: `Você sabe o que quer em ${nomeArea(pior.area)}, mas não reservou tempo para isso.` },
      { nome: 'Conforto no que já funciona', texto: melhor ? `Você volta para ${nomeArea(melhor.area)} porque ali é mais fácil ter resultado.` : 'Você prefere planejar a executar.' },
    ],
    pergunta: `Se nada mudar em ${nomeArea(pior.area)} nos próximos 12 meses, o seu necrológio ainda vai ser verdade?`,
    cuidado: '',
    sugestoes,
  };
}

/** Relatório de exemplo mostrado antes do primeiro relatório de verdade. */
export const EXAMPLE_REPORT: AnalysisContent = {
  retrato:
    'Você sonha grande e escreveu com clareza quem quer ter sido. Na prática, sua energia vai quase toda para o trabalho e para os estudos, onde você já se sente competente. Saúde e finanças aparecem nos seus sonhos, mas quase não aparecem no backlog. Há potencial de sobra; falta compromisso com as áreas difíceis.',
  geral: 58,
  padroes: [
    { titulo: 'Disciplina para estudar', texto: 'Quando a meta é intelectual, você cria tarefas e conclui. Isso mostra que o problema não é falta de disciplina.' },
    { titulo: 'Carreira no centro', texto: 'A iniciativa mais estruturada é a profissional. Ela recebe atenção maior do que as áreas com notas mais baixas.' },
    { titulo: 'Preparo sem prática', texto: 'Você compra o tênis, monta a planilha, faz a lista. O passo seguinte, que é o difícil, fica no backlog.' },
  ],
  gaps: [
    { titulo: 'Maratona sem corrida', texto: 'A corrida está no seu quadro de sonhos e a nota de saúde é 4, mas nenhuma tarefa de treino saiu do backlog.' },
    { titulo: 'Reserva só no desejo', texto: 'Você marcou a reserva de emergência como não atendida na pirâmide e não tem nenhum épico de finanças ativo.' },
    { titulo: 'Família fora da sprint', texto: 'O seu necrológio fala de presença em casa, mas nenhuma tarefa das últimas sprints foi dessa área.' },
  ],
  manter: ['A constância nos estudos.', 'O hábito de planejar a sprint.'],
  ajustar: ['Puxar menos tarefas por sprint: você conclui cerca de metade do que planeja.', 'Ter uma tarefa de saúde em toda sprint.'],
  abandonar: ['Começar um curso novo antes de terminar o atual.'],
  proximos7dias: ['Agendar um check-up médico.', 'Caminhar 20 minutos em três dias desta semana.', 'Listar os gastos fixos do mês.'],
  limitantes: [
    { nome: 'Carreira como refúgio', texto: 'Quando precisa escolher onde agir, você volta para o trabalho e para os livros. Isso evita encarar saúde, finanças e família.' },
    { nome: 'Preparação como progresso', texto: 'Você trata o começo como se fosse avanço. Comprar o tênis não é treinar.' },
  ],
  pergunta: 'Se sua agenda continuar igual, em que momento você vai construir a pessoa que descreveu no seu necrológio?',
  cuidado: '',
  sugestoes: [
    toSuggestion(LIBRARY.saude, 'A corrida é um sonho declarado e a saúde tem uma das menores notas.'),
    toSuggestion(LIBRARY.financas, 'A reserva de emergência falta na pirâmide e a área financeira não tem plano.'),
  ],
};
