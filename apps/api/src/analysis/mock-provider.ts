import { AREA, AREA_IDS, type AnalysisArea, type AnalysisContent, type AnalysisInsight, type AnalysisSuggestion, type AreaId } from '@circle/shared';
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
const LIBRARY: Record<AreaId, AnalysisSuggestion> = {
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

const clamp = (n: number) => Math.max(5, Math.min(95, Math.round(n)));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function mockAnalysis(input: AnalysisInput): AnalysisContent {
  const necro = (input.necrologio ?? '').toLowerCase();
  const facts = AREA_IDS.map(area => {
    const nota = input.roda?.notas[area] ?? null;
    const epicos = input.tarefas?.flatMap(i => i.epicos).filter(e => e.area === area) ?? [];
    const ativos = epicos.filter(e => !e.encerrado).length;
    const feitas = epicos.reduce((s, e) => s + e.feitas, 0);
    const naSprint = epicos.reduce((s, e) => s + e.naSprint, 0);
    const sonhos = input.quadro?.filter(d => d.area === area && !d.realizado).length ?? 0;
    const citada = KEYWORDS[area].some(k => necro.includes(k));
    const execucao = input.tarefas ? Math.min(1, ativos * 0.25 + naSprint * 0.15 + feitas * 0.03) : 0.5;
    const contentamento = nota === null ? 0.5 : nota / 10;
    const pct = clamp(contentamento * 45 + execucao * 45 + (citada || sonhos ? 4 : 10));
    return { area, nota, ativos, feitas, naSprint, sonhos, citada, pct, relevancia: (citada ? 2 : 0) + (sonhos ? 2 : 0) + (ativos ? 1 : 0) + (nota !== null && nota <= 5 ? 1 : 0) };
  });

  const chosen = [...facts].sort((a, b) => b.relevancia - a.relevancia || a.pct - b.pct).slice(0, 6).sort((a, b) => a.pct - b.pct);

  const areas: AnalysisArea[] = chosen.map(f => {
    const nome = AREA[f.area].name.toLowerCase();
    const parts: string[] = [];
    if (f.nota !== null) parts.push(`Você deu ${f.nota}/10 para a área ${nome} na roda`);
    else parts.push(`Na área ${nome}`);
    if (input.tarefas) parts[0] += f.ativos ? ` e tem ${plural(f.ativos, 'épico ativo', 'épicos ativos')}${f.naSprint ? `, com ${plural(f.naSprint, 'tarefa', 'tarefas')} na sprint` : ''}.` : ', mas não tem nenhum épico ativo no backlog.';
    else parts[0] += '.';
    if (f.sonhos) parts.push(`${plural(f.sonhos, 'sonho do seu quadro está', 'sonhos do seu quadro estão')} aqui, então vale ter um plano concreto.`);
    else if (f.citada) parts.push('O seu necrológio fala desse tema: o backlog precisa refletir isso.');
    else if (f.pct >= 70) parts.push('Intenção e ação estão andando juntas.');
    else parts.push('Uma tarefa pequena por sprint já muda esse quadro.');
    return { area: f.area, pct: f.pct, texto: parts.join(' ') };
  });

  const geral = areas.length ? Math.round(areas.reduce((s, a) => s + a.pct, 0) / areas.length) : 50;
  const pior = areas[0];
  const melhor = areas[areas.length - 1];
  const nomeDe = (a?: AnalysisArea) => (a ? AREA[a.area].name.toLowerCase() : '');

  const visao = [
    input.necrologio ? 'Você escreveu com clareza quem quer ter sido, e isso dá uma baliza forte para o backlog.' : 'Você já tem dados suficientes para comparar o que quer com o que está fazendo.',
    melhor ? `A área ${nomeDe(melhor)} é onde intenção e execução mais conversam.` : '',
    pior && pior !== melhor ? `Já a área ${nomeDe(pior)} pede atenção: o que você diz querer ainda não virou tarefa.` : '',
    'Escolha uma ou duas sugestões abaixo e coloque na próxima sprint.',
  ]
    .filter(Boolean)
    .join(' ');

  const insights: AnalysisInsight[] = [
    melhor
      ? { icon: 'trend', titulo: `${AREA[melhor.area].name} está bem encaminhada.`, texto: 'Mantenha o ritmo e use essa área como exemplo para as outras.' }
      : { icon: 'trend', titulo: 'Você começou a medir a sua vida.', texto: 'Cada exercício preenchido deixa a análise mais precisa.' },
    pior
      ? { icon: 'alert', titulo: `${AREA[pior.area].name} precisa sair do papel.`, texto: 'Crie um épico com uma primeira tarefa de até 30 minutos.' }
      : { icon: 'alert', titulo: 'Faltam dados para comparar.', texto: 'Preencha a roda da vida para ver as áreas lado a lado.' },
    input.maslow
      ? { icon: 'target', titulo: `Você está no nível ${input.maslow.nivelAtual.toLowerCase()} da pirâmide.`, texto: 'Priorize as tarefas que fecham as lacunas desse nível.' }
      : { icon: 'target', titulo: 'Releia o seu necrológio antes da planning.', texto: 'Veja se o backlog ainda conversa com ele.' },
  ];

  const suggestions = areas
    .filter(a => a.pct < 70)
    .slice(0, 3)
    .map(a => LIBRARY[a.area]);
  if (!suggestions.length && pior) suggestions.push(LIBRARY[pior.area]);

  return { geral, visao, areas, insights, suggestions };
}

/** Relatório de exemplo mostrado antes do primeiro relatório de verdade (como no protótipo). */
export const EXAMPLE_REPORT: AnalysisContent = {
  geral: 72,
  visao:
    'Você demonstra clareza sobre o que deseja conquistar e tem grandes sonhos registrados. Suas visualizações mostram um futuro bem definido. No entanto, os dados mostram um desalinhamento entre intenção e ação nas áreas financeira e física. Há potencial, mas falta consistência e estrutura na execução.',
  areas: [
    { area: 'financas', pct: 35, texto: 'Você avaliou sua vida financeira como 5/10 na roda, mas tem só uma tarefa ativa no tema. Os desejos estão claros nos sonhos, falta um plano de ação.' },
    { area: 'saude', pct: 40, texto: 'Você reconhece que sua saúde pede atenção, mas a hidratação é o único épico ativo. A pirâmide mostra a base quase completa, falta o hábito do movimento.' },
    { area: 'espiritualidade', pct: 60, texto: 'Você escreve sobre sentido e fé no necrológio, e os encontros do catecismo seguem. Falta uma prática diária mais curta.' },
    { area: 'intelectual', pct: 65, texto: 'Você investe tempo em aprendizado e tem boas referências. Vale transformar a leitura em algo que você compartilha.' },
    { area: 'amor', pct: 75, texto: 'Você tem clareza sobre o relacionamento que deseja e um épico ativo para o casamento. Ações e tarefas estão coerentes com o que escreveu.' },
    { area: 'familia', pct: 80, texto: 'Suas relações estão bem alinhadas com seus valores. Há registros recentes de momentos importantes.' },
  ],
  insights: [
    { icon: 'trend', titulo: 'Você sonha grande e tem clareza do que quer.', texto: 'Seu quadro de visualização e o necrológio mostram ambição e direção.' },
    { icon: 'alert', titulo: 'Finanças e saúde precisam sair do papel.', texto: 'Os sonhos estão lá, mas quase não há tarefas nessas áreas.' },
    { icon: 'target', titulo: 'Pequenos passos na próxima sprint.', texto: 'Uma tarefa curta por área já muda o alinhamento.' },
  ],
  suggestions: [LIBRARY.financas, LIBRARY.saude],
};
