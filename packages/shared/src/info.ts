/**
 * Textos dos botões "i" de cada tela (constante INFO do protótipo),
 * ajustados às decisões do dono (sem sistema de conquistas por pontos,
 * necrológio sem seções, trilhas com aprovação etc.).
 */
export const INFO: Record<string, [string, string[]]> = {
  roda: ['Roda da Vida', ['São indicadores das diferentes áreas da vida, como carreira, relacionamentos, saúde e finanças. Cada área é uma fatia da roda, e o objetivo é avaliar o nível de contentamento em cada uma.', 'Dê uma nota de 0 a 10 com honestidade. A roda mostra o seu presente. Ela não diz o que fazer: é você quem decide onde quer agir.', 'Tempo sugerido no dia zero: 20 minutos.']],
  maslow: ['Pirâmide de Maslow', ['Teoria proposta por Abraham Maslow em 1943. Descreve as necessidades humanas em uma hierarquia, das básicas até a autorrealização.', 'Hierarquia: as necessidades de um nível tendem a precisar ser atendidas antes de avançar. Mas há exceções e cada pessoa se adapta de um jeito.', 'Use a pirâmide como balizador: veja em que nível você está hoje e o que pode fazer para avançar.']],
  necro: ['Necrológio', ['Imagine que você viveu tudo o que deveria (70, 80, 90 anos) e morreu. Um amigo jornalista vai escrever sobre quem você foi, seus feitos e o que realizou.', 'Coloque-se no lugar dele e escreva sobre você. Seja sincero e mire alto. “Teve um carro bonito e uma casa gigante” é raso.', 'Aristóteles diria que só é possível saber se uma vida foi boa quando ela termina. O exercício traz clareza de prioridades, reflexão sobre valores e serve para balizar a sua vida.']],
  quadro: ['Quadro de visualização', ['Uma representação visual dos seus objetivos e sonhos, da vida toda ou de uma fatia dela, com imagens e palavras do que você deseja alcançar.', 'Benefícios: foco e clareza sobre os objetivos, motivação para trabalhar neles e uma visão positiva do futuro.', 'Quando um sonho se realiza, marque como realizado.']],
  analise: ['Análise inteligente', ['A IA cruza os exercícios que você escolher (necrológio, roda, pirâmide e quadro) com o que você está executando no backlog.', 'O índice de alinhamento mostra o quanto as suas ações de hoje conversam com o que você escreveu que quer viver.', 'As sugestões vêm em forma de trilha e são opcionais: você escolhe o que entra no backlog.']],
  relatorios: ['Relatórios', ['Acompanhe o que você entregou nas sprints e em quais áreas da vida a sua execução está indo.', 'As áreas menos utilizadas não são um problema por si só. Servem para você perceber onde está colocando energia.']],
  conquistas: ['Minhas conquistas', ['Os épicos encerrados e as iniciativas concluídas em cada área da sua vida.']],
  loja: ['Loja de trilhas', ['Trilhas são planos prontos, organizados em iniciativa, épicos e tarefas. Ao importar, tudo vai para o seu backlog e você ajusta do seu jeito.', 'Qualquer pessoa pode publicar uma iniciativa como trilha, grátis ou paga em XP. Toda trilha passa pela aprovação de um administrador antes de aparecer na loja.']],
  grupos: ['Amigos e grupos', ['Conecte-se com pessoas que estão fazendo a mesma caminhada. O compartilhamento é sempre opcional: compartilhe apenas aquilo com que se sente confortável.']],
};
