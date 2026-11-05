# Circle of Life — guia do projeto

Este arquivo é lido pelo Claude no início de toda sessão. Ele explica o que é o app, o método por trás dele e as regras que valem para qualquer mudança. O plano técnico detalhado (modelo de dados, endpoints, etapas) está em [docs/plano.md](docs/plano.md).

## Como trabalhar com o dono do projeto

- O dono do projeto **não é programador**. Explique tudo em linguagem simples, sem jargão; quando um termo técnico for inevitável, diga em uma frase o que ele significa.
- **Peça aprovação antes de etapas importantes**: começar uma etapa do plano, mudar o modelo de dados, adicionar uma dependência relevante, mudar algo do protótipo, apagar dados ou arquivos. Ao fim de cada etapa, diga o que ficou pronto, como testar e o que vem a seguir.
- Construa em **etapas pequenas**, na ordem de [docs/plano.md](docs/plano.md). Não pule etapas nem adiante código de etapas futuras.
- Quando algo não estiver definido no protótipo, neste arquivo ou no plano, **pergunte** em vez de inventar.
- As decisões do dono que mudam o protótipo estão registradas na seção "Diferenças em relação ao protótipo" abaixo. Elas **valem mais que o protótipo**.

## O que é o app

Um **app de celular que também funciona no computador**. Nesta versão (beta) ele é um aplicativo web instalável (PWA): a pessoa abre no navegador, pode "instalar" na tela inicial do celular e recebe notificações. O layout é pensado primeiro para o celular. **Depois do beta, o app irá para a App Store e o Google Play**; por isso, evite soluções que só funcionem no navegador quando houver alternativa equivalente.

**Acesso só por convite** nesta versão: apenas participantes do Sprint da Vida entram. **Só administradores convidam**: o admin digita o e-mail, a pessoa recebe o convite e entra com a conta Google daquele e-mail **ou cria uma conta com e-mail e senha** (decisão do dono de 28/10/2026). No cadastro com senha, um **código de 6 números** chega por e-mail e a conta só é criada depois de confirmado; a pessoa aceita os **termos de uso** (texto provisório em `/termos`, a revisar). "Esqueci minha senha" manda um código para criar uma senha nova (serve também para quem só entrava com o Google). Os e-mails listados na variável `ADMIN_EMAILS` entram sem convite e viram administradores (é assim que o primeiro admin entra em produção). Convites feitos por participantes comuns (ex.: "Convidar pelo WhatsApp") ficam para o futuro. No futuro, qualquer pessoa poderá se cadastrar (Google, cadastro próprio etc.). Por isso, o login deve ser feito de um jeito que permita acrescentar outras formas de entrada depois.

## Idioma

Tudo que o usuário vê é em **português do Brasil**: telas, botões, mensagens de erro, e-mails, notificações, textos da IA, dados de exemplo. Datas no formato brasileiro (`23/10`, `23 out`), números com vírgula decimal e ponto de milhar (`2.450 XP`). Fuso padrão `America/Sao_Paulo`.

Código (nomes de variáveis, funções, tabelas) pode ficar em inglês; comentários, documentação e mensagens de commit ficam em português.

Tom dos textos: frases curtas e concretas, tratando a pessoa por "você", como nos textos do protótipo (ex.: "Releia o seu necrológio e veja se o backlog ainda conversa com ele.").

## A pasta `referencia/`

| Pasta | O que é | Como usar |
|---|---|---|
| `referencia/prototipo/` | `circle-of-life.html` é um protótipo funcional de **todas as telas** (React num único arquivo, dados no navegador). As imagens `IMG-*.jpg` são capturas dele. | **Referência oficial de visual e comportamento**, exceto onde a seção "Diferenças em relação ao protótipo" diz outra coisa. Na dúvida, abra o HTML no navegador e compare. |
| `referencia/app-antigo/` | Prints de uma versão antiga que será descontinuada. | Só para **identificar funcionalidades que não existem no protótipo** e perguntar ao dono se devem entrar. **Nunca copie o visual.** No futuro, os usuários e dados do app antigo serão migrados para este (não é desta versão). |
| `referencia/metodologia/` | Apresentação "Sprint da Vida" (`Board-da-Vida (1).pptx`) e imagens da Roda e do Necrológio. | Base para os **conceitos e textos dos exercícios** (o que é cada exercício, o que significa cada área). A apresentação descreve a dinâmica da turma presencial; regras da turma (pontuação "Vida Extra", mural de palavras proibidas etc.) **não** são regras do app. |

Não altere nada dentro de `referencia/`. Essa pasta fica **fora do git** (está no `.gitignore`) por ser grande; ela existe só no computador do dono.

## O método Sprint da Vida

A ideia é aplicar o jeito de trabalhar de times ágeis (backlog, sprints, quadro Kanban, entregas) à vida pessoal, depois de uma reflexão sobre o que é uma vida boa.

O caminho do usuário:

1. **Refletir** com quatro exercícios:
   - **Necrológio**: imaginar que viveu 70, 80, 90 anos e morreu; um amigo jornalista escreve sobre quem você foi. Você escreve no lugar dele, mirando alto ("teve um carro bonito" é raso). Serve de baliza para a vida.
   - **Quadro de visualização**: os 10 maiores sonhos de vida, com imagem. Quando um se realiza, é marcado como realizado.
   - **Pirâmide de Maslow**: marcar o que já está atendido em cada nível de necessidade (fisiológicas, segurança, relacionamento, estima, autorrealização), dentro e fora do trabalho, e ver em que nível você está.
   - **Roda da Vida**: nota de 0 a 10 de contentamento em cada uma das 10 áreas da vida. Mostra o presente; não diz o que fazer.
   - **Jornada de primeiro acesso** (decisões do dono de 03 e 04/11/2026; é o **centro do app**: nada do método funciona se a pessoa não seguir a Jornada). Quem está na Jornada (`users.journey = true`) vê a aba **Jornada** no lugar do Feed em todo login, até concluir de vez. São **7 fases em ordem** (`JOURNEY_PHASES` em `packages/shared/src/journey.ts`); cada uma só abre quando a anterior termina, e cada conclusão mostra um **pop-up de parabéns** e destaca a fase: 1) **Roda da Vida** (as 10 áreas com nota), 2) **Maslow** (1 item), 3) **Quadro** (1 sonho), 4) **Necrológio** (100 caracteres), 5) **Backlog** (iniciativa, épico e tarefa, ou a trilha recomendada, e pelo menos 1 tarefa enviada para a sprint), 6) **Iniciar a 1ª sprint** (abre a tela da sprint e volta para a Jornada), 7) **Concluir minha jornada** (botão). As 4 primeiras formam **Minha vida**: até completá-las, o quadro, puxar para a sprint e iniciar sprint ficam trancados (403 na API); depois de completas uma vez, não tranca mais. **Durante a Jornada nada rende XP** (regra no `XpService`) e o XP não aparece; o Mais mostra só Minha vida (até a fase atual), o Backlog (depois de Minha vida) e Configurações. **"Concluir minha jornada"** dá **+1.000 XP** (pop-up explica XP total e disponível e lista o que será liberado), a pontuação normal volta a valer e a pessoa escolhe: **liberar agora por 500 XP** ou **aguardar 7 dias** (vai para o Board, que vira a tela inicial; a aba Jornada continua e, passados os 7 dias, mostra "Concluir jornada" de graça). Até liberar, ficam trancados rede social, amigos, grupos, fórum, perfis e o "Quer compartilhar?" (rotas `@Social()`). Ao liberar, a **Jornada está concluída**: a aba Jornada some, volta o Feed, aparece uma vez o **troféu "Jornada concluída"** com a apresentação da rede e o convite para compartilhar a conclusão da sprint, e a conquista entra em **Minhas conquistas**, valendo para **todas as áreas da vida** (só para quem fez a Jornada). Quem já usava o app fica com `journey = false` (tudo liberado). **Toda conta nova, inclusive de admin, começa pela Jornada** (`journey: true` ao criar a conta em `auth.service.ts`; decisão do dono de 05/11/2026). Usuários de teste e do seed ficam fora. A parada do backlog recomenda a **trilha oficial "Primeiros passos"** (`STARTER_TRILHA_ID`, criada por migration, grátis): uma tarefa em cada área da vida, com descrição e área próprias (tarefas de trilha guardam descrição e áreas, e levam isso ao importar).
2. **Planejar** no backlog: transformar o que apareceu nos exercícios em Iniciativas, Épicos e Tarefas, criadas do zero, importadas de uma trilha ou sugeridas pela IA.
3. **Executar** em sprints de 14 dias no quadro Kanban.
4. **Acompanhar**: relatórios, análise inteligente (IA que cruza exercícios com execução) e XP.
5. **Compartilhar (opcional)**: feed, stories, amigos, grupos e trilhas publicadas. Nada vai para o feed sem a pessoa confirmar.

### As 10 áreas da Roda da Vida

São sempre estas 10, sem área "Outros". Ids, nomes, ícones e cores vêm do protótipo (constante `AREAS`):

| id | Nome no app | Ícone | Cor |
|---|---|---|---|
| `lazer` | Lazer | umbrella | `#8b5cf6` |
| `amor` | Relacionamento amoroso | heart | `#ef4444` |
| `financas` | Financeira | banknote | `#16a34a` |
| `familia` | Família e amigos | users | `#f59e0b` |
| `intelectual` | Intelectual | book | `#3b82f6` |
| `espiritualidade` | Espiritual | lotus | `#14b8a6` |
| `sociedade` | Sociedade | handshake | `#eab308` |
| `saude` | Física | dumbbell | `#a855f7` |
| `emocional` | Emocional | smile | `#0ea5e9` |
| `profissional` | Profissional e carreira | briefcase | `#65a30d` |

Cada área tem também uma pergunta principal, um slogan e duas perguntas de reflexão (usadas no "Me ajude a refletir"). Esses textos estão no protótipo e devem ser copiados de lá. A apresentação (slides 57 a 65) traz o significado de cada área e exemplos de metas.

### Iniciativa > Épico > Tarefa

- **Iniciativa**: objetivo estratégico de alto nível (ex.: "Vida longa e próspera"). Tem uma ou mais áreas da vida. Pode ser marcada como **Objetivo Master**. **Não** é publicada como trilha (é algo muito pessoal). Quando todos os seus épicos estão encerrados, pode ser **concluída** (vira conquista).
- **Épico**: conjunto de entregas relacionadas, dentro de uma iniciativa (ex.: "Comprar uma casa"). Tem **uma ou mais áreas da vida** (a primeira é a **principal**: cor, ícone e categoria da trilha). Pode ser **publicado como trilha** (na loja ou num grupo) e, aí, aparece em **todas as suas áreas** na loja. Quando todas as tarefas estão prontas, pode ser **encerrado** (vira conquista, contando em todas as suas áreas).
- **Tarefa**: ação específica e executável, dentro de um épico (ex.: "Visitar imóveis"). Tem **uma ou mais áreas da vida** (próprias; por padrão, as do épico), prioridade (Alta, Média, Baixa), prazo opcional, descrição, checklist, anexos de imagem e histórico de atividade. A tarefa é sempre do próprio usuário (não existe "responsável").

Regras: toda tarefa pertence a um épico; todo épico pertence a uma iniciativa. **Áreas da vida sem limite** (decisão do dono de 03/11/2026): iniciativa, épico, tarefa, post e story aceitam de uma até todas as áreas, e todo seletor de áreas tem o botão **"Marcar todas"**. A **herança é só o padrão, não uma regra**: o épico novo já vem com as áreas da iniciativa marcadas e a tarefa nova com as do épico; a pessoa pode trocar à vontade. Se nada for escolhido, o item usa as áreas do seu "superior" (o épico usa as da iniciativa; a tarefa, as do épico). Iniciativas, épicos e tarefas podem ser **duplicados**.

**Trilha** = **um épico pronto, com as tarefas**, que pode ser importado para o backlog. Ao importar, a pessoa escolhe em qual iniciativa dela o épico entra (ou cria uma nova). Há dois tipos (decisão do dono de 28/10/2026):
- **Trilha da loja**: qualquer pessoa vê e baixa; passa pela aprovação de um administrador do app; grátis ou paga em XP.
- **Trilha do grupo**: pertence ao grupo e só os membros veem e baixam; sempre grátis. O **gestor** do grupo publica direto (a partir de um épico dele) ou **traz da loja**, o que cria uma **cópia do grupo** (a da loja continua intacta) que os gestores podem editar. Membro comum só **sugere**: a sugestão fica pendente até um gestor aprovar ou recusar (com motivo opcional). Trilha do grupo não passa pelo admin do app (a moderação de grupos virá no futuro).

As **sugestões da análise inteligente** continuam no formato iniciativa → épicos → tarefas e vão direto para o backlog (não são trilhas da loja).

### Sprints de 14 dias

- Status de uma tarefa: **Backlog** → **A Fazer** → **Fazendo** → **Pronto**. O quadro Kanban mostra só A Fazer, Fazendo e Pronto.
- **Sprint manual** (decisão do dono de 03/11/2026): a sprint é numerada (Sprint 1, 2, 3…), tem **nome** (padrão "Sprint N", editável), **objetivo** opcional e **duração** (7, 14 por padrão ou 30 dias, ou sem prazo), tudo na **tela da sprint** (`/sprint`, botão "Sprint" no quadro; a duração saiu das Configurações). Ela nasce **em planejamento** e só começa quando a pessoa aperta **"Iniciar sprint"**, que exige **pelo menos 1 tarefa em A Fazer** e avisa no sino e no celular. Quando o prazo vence, o app **avisa, mas não encerra**.
- **Sem sprint iniciada**, dá para mover os cartões, mas concluir tarefa **não rende XP** e não pergunta "Quer compartilhar?"; o aviso disso aparece **só na 1ª vez** em cada intervalo entre sprints. Ao iniciar a sprint, essas tarefas saem do quadro (continuam concluídas, sem XP). Quadro sem cartões e sem sprint mostra "Nenhuma sprint em andamento".
- **Encerrar a sprint**: tarefas prontas saem do quadro (são arquivadas e vão para os relatórios); tarefas em A Fazer ou Fazendo voltam para o backlog com um registro no histórico; a sprint vai para o histórico com "prontas/total"; a seguinte fica **em planejamento** (herda a duração). Antes da próxima planning, o app sugere reler o necrológio.
- **Tarefas atrasadas** (prazo vencido e não prontas) aparecem num aviso no topo do Board e geram notificação no sino e no celular.

### XP

Nesta versão **só existe XP**. Não há nível nem sequência (streak), porque essas regras ainda não estão definidas. Não implemente nada disso sem o dono pedir. (A tela "Minhas conquistas" continua existindo; veja em Telas.)

Cada pessoa tem dois números:
- **XP total**: tudo que ela já ganhou na história dela no app.
- **XP disponível**: XP total menos o XP gasto.
- **Ganhar** XP soma nos dois. **Gastar** XP (comprar trilha) debita só do disponível. Estornos (ex.: reabrir uma tarefa pronta) tiram dos dois. O disponível nunca fica negativo; comprar exige saldo suficiente.

| Ação | XP |
|---|---|
| Concluir tarefa **com a sprint iniciada** | +10 (reabrir uma tarefa pronta tira os 10; sem sprint iniciada ou durante a Jornada, 0) |
| Concluir item de checklist | +2 (desmarcar tira os 2) |
| Encerrar épico | +50 |
| Concluir iniciativa com **mais de 5 tarefas concluídas** (6 ou mais) | +100 (com menos tarefas, conclui sem XP) |
| Encerrar sprint com **todas** as tarefas prontas | +100 |
| Registrar avaliação da Roda da Vida | +20 |
| Realizar um sonho do quadro | +30 |
| **Primeiro** post do dia | +10 (os outros posts do dia não rendem XP) |
| **Primeiro** story do dia | +10 |
| **Primeiro** comentário do dia, em qualquer publicação | +5 |
| Alguém baixar (importar) uma trilha sua **da loja** | +10 (uma vez por pessoa; trilhas de grupo não dão XP) |
| Comprar uma trilha paga | − preço, só do disponível. O preço **não** vai para o autor. |
| "Concluir minha jornada" (o único XP durante a Jornada) | +1.000 (uma vez só) |
| Liberar a rede social antes dos 7 dias (Jornada) | − 500, só do disponível |

"Dia" segue o fuso da pessoa. Todo ganho e gasto fica registrado num extrato.

**Estas regras são provisórias.** O dono vai definir a regra de negócio definitiva do XP e então todo o sistema de pontuação será refeito. Por isso, valores e condições de XP ficam **concentrados em um único lugar** (a tabela em `packages/shared/src/xp.ts` e um único serviço de XP na API), nunca espalhados pelo código. Celebrações (épico encerrado, sprint encerrada, sonho realizado) abrem uma folha com o XP ganho e o botão opcional "Compartilhar".

## Telas

Navegação inferior com 4 abas e um botão central "+": **Feed**, **Board**, **(+) Adicionar**, **Backlog**, **Mais**. Formulários e detalhes abrem em **folhas** que sobem de baixo (no computador, janela central). Um **sino** de notificações fica no topo do Feed e do Perfil.

| Tela | O que faz |
|---|---|
| **Stories** | Faixa no topo do Feed. Story de verdade: **foto que some em 24 horas**. Ao publicar, a pessoa escolhe **uma ou mais áreas da vida** (pelo menos 1), e os ícones dessas áreas aparecem como **marca d'água no canto inferior** da foto. Pode ter uma **legenda curta**. Em stories só dá para **curtir** (sem comentários). O autor vê **quem visualizou** ("Visto por"). Os filtros do feed não se aplicam aos stories. |
| **Feed** | Posts de você, amigos e grupos. Filtros: Para você, Amigos, Grupos, Seguindo, e por área. Curtir, comentar, compartilhar (copiar texto), salvar, **editar e excluir o próprio post**. Criar post com conquista opcional, texto, até 8 imagens, **uma ou mais áreas** (sem limite), **vários grupos** (sem limite), hashtags e visibilidade. **Quem vê** = o que a visibilidade libera (Todo mundo, Somente amigos ou Privado = só você) **mais** os membros dos grupos escolhidos (decisão do dono de 28/10/2026). |
| **Notificações (sino)** | Abre numa folha (não é uma página). Lista de notificações (pedidos de amizade, curtidas, comentários, tarefas atrasadas, trilha baixada etc.), com contador de não lidas, marcar como lida, marcar todas como lidas, apagar uma e limpar todas. Tocar leva à tela relacionada. |
| **Board** (Quadro Kanban) | Aviso de tarefas atrasadas. Colunas A Fazer, Fazendo, Pronto da sprint atual. Arrastar cartões (no celular, segurar e arrastar), visão em lista, busca, filtro por área. Toque no cabeçalho ou no botão "Sprint" abre a **tela da sprint** (nome, objetivo, duração, iniciar, encerrar, histórico). Cartões sem foto do usuário. |
| **Adicionar (+)** | Escolher: Nova Iniciativa, Novo Épico, Nova Tarefa, Novo post. |
| **Backlog** | Abas Iniciativas (cascata iniciativa → épicos → tarefas, com progresso), Épicos e Tarefas (No backlog, Na sprint, Concluídas). Busca, filtro por área, puxar para a sprint, importar trilha, duplicar. **Seleção e ações em massa** (decisão do dono de 04/11/2026): a bolinha da tarefa **seleciona** (não conclui mais; concluir uma tarefa só pelo quadro ou pelo detalhe) e, com tarefas selecionadas, aparece uma barra com **Para a sprint, Concluir e Excluir** (excluir sempre pede confirmação). Nos três pontinhos: **Exportar tarefas** e **Importar tarefas** em planilha Excel, no modelo do app antigo (8 colunas: área, iniciativa, descrição, épico, descrição, tarefa, descrição, previsão de entrega) + status, prioridade e objetivo master. A importação mostra uma prévia, junta sem duplicar (pelo nome) e lista o que falta completar (decisão do dono de 27/10/2026). No menu "⋮" do **épico**: **Publicar como trilha** (escolhendo loja ou um grupo seu). |
| **Detalhe da tarefa** | Abas Detalhes (prazo, área, iniciativa › épico, descrição, status), Checklist, Anexos e Atividade. Editar, duplicar e excluir. |
| **Concluir tarefa** | Ao concluir **qualquer** tarefa, aparece sempre a pergunta "Quer compartilhar?" (cada tarefa é uma conquista; não há opção para desligar). Se sim, abre o formulário de post já preenchido com a tarefa, a área e o XP. |
| **Mais** | Cartão do perfil e atalhos: Ferramentas de reflexão (Necrológio, Pirâmide de Maslow, Roda da Vida, Quadro de visualização) e Acompanhamento (Análise inteligente, Relatórios, Loja de trilhas, Amigos e grupos, Configurações). |
| **Necrológio** | Só um campo de texto em branco com a barra de formatação (H1, H2, negrito, itálico, sublinhado, destaque, lista, alinhamento) e salvamento automático. **Sem seções e sem percentual de progresso** (virão numa versão futura). |
| **Roda da Vida** | Nota 0–10 por área, gráfico radar, equilíbrio geral (média), "Me ajude a refletir" (passo a passo por área com as perguntas **e o controle de nota**, legendas "0 – Precisa melhorar muito / 5 – Regular / 10 – Excelente") e "Registrar avaliação de hoje". As notas salvam sozinhas; se a pessoa não registrar, a avaliação do dia é **guardada sozinha no fim do dia** (sem XP; tarefa agendada de hora em hora e na diária da Vercel). |
| **Pirâmide de Maslow** | Progresso geral e por nível, **nível atual** (ex.: "Nível atual: Segurança") e **itens marcados de N**, pirâmide clicável, itens marcáveis (Fora do trabalho / No trabalho) e reflexões por nível. |
| **Quadro de visualização / Minhas conquistas** | Quadro: até 10 sonhos abertos com imagem e área; "Realizei" marca como realizado. Minhas conquistas: por área da vida, os **épicos encerrados e as iniciativas concluídas** daquela área. |
| **Me analise** (análise inteligente) | No topo, os ícones das fontes (Necrológio, Roda da vida, Pirâmide, Quadro de visualização, Tarefas): **a pessoa escolhe quais entram na análise**. Formato novo (decisão do dono de 05/11/2026, inspirado no app antigo): índice de alinhamento, **retrato** (quem a pessoa é hoje), padrões de evolução, **gaps** (onde o que diz e o que faz não batem), **padrões limitantes**, recomendações (manter, ajustar, pausar), próximos 7 dias, uma pergunta para levar e **sugestões em forma de trilha** (iniciativa → épicos → tarefas, com descrição e "por que é importante") importadas **tarefa por tarefa**. Tom **direto, "tapas da verdade", sem desrespeitar**. **Uma análise por mês.** Relatórios antigos abrem no formato novo. |
| **Relatórios** | Visão geral, Por área da vida, Evolução e **Entregas** (tarefas concluídas entre duas datas, com data, área e épico, sem poluir). |
| **Loja de trilhas** | Trilhas publicadas pelos usuários, por categoria, busca, favoritos, detalhe. Trilha **grátis** ou **paga em XP**. "Importar para o backlog" (ou comprar, se paga), escolhendo a iniciativa. Trilhas de grupo não aparecem na loja. **Toda trilha publicada precisa ser aprovada por um administrador**: para o admin, as trilhas pendentes aparecem na própria loja com efeito borrado e o selo "Aguardando aprovação"; ele abre, confere e aprova ou recusa (com um motivo opcional, para o autor ajustar e mandar de novo). Para o autor, a trilha aparece como "Em análise". Os demais usuários só veem trilhas aprovadas. |
| **Amigos e grupos** | Grupos criados pelos usuários: membros interessados no assunto e **trilhas do grupo** (veja Trilha). **Gestores**: quem cria o grupo é gestor e, na lista de membros, escolhe quem mais é gestor (o criador continua sempre gestor; se ele sair, os gestores escolhem). Gestores criam, trazem da loja, editam e tiram trilhas do grupo, aprovam as sugestões dos membros e moderam o fórum. Fórum do grupo (tópicos e respostas, só membros). Adicionar amigo buscando pelo nome ou @ID das pessoas que já usam o app (não é campo livre), solicitações recebidas e enviadas, lista de amigos. |
| **Meu Perfil / Configurações** | Foto, nome, e-mail, ID (@), bio; XP total e XP disponível; uso das ferramentas; atividade recente; tema e aparência; **visibilidade padrão dos posts** (Todo mundo, Somente amigos, Privado); notificações no celular; **Sair**; **Excluir minha conta** (só depois de digitar **DELETAR**; a API também exige). |

Cada tela de ferramenta tem um botão "i" com a explicação do exercício (textos em `INFO` no protótipo).

### Diferenças em relação ao protótipo (decisões do dono)

- Sem nível e streak. Só XP (total e disponível). Remover do perfil, do feed (estatísticas dos posts), dos relatórios ("Sequência atual") e das celebrações. O contador "Conquistas" do perfil sai; a tela "Minhas conquistas" fica, mostrando épicos encerrados e iniciativas concluídas por área.
- Stories de verdade (24 horas, só curtidas, marca d'água das áreas), no lugar da faixa que só filtrava o feed.
- Necrológio sem seções nem percentual.
- Board sem foto do usuário nos cartões; detalhe da tarefa sem "Responsável".
- Grupos com **fórum** (tópicos com respostas, só para membros; decisão do dono de 26/10/2026), mas sem "Desafios", "Eventos" e sem indicador "online". Stories sem bolinha "online".
- "Apagar dados e recomeçar" vira "Excluir minha conta". Acrescentar "Sair".
- Acrescentar: notificações, aviso de atrasadas, duplicar, publicar épico como trilha (loja ou grupo), aprovação de trilhas pelo admin, gestores e trilhas próprias dos grupos, trilhas pagas em XP, relatório de entregas, concluir iniciativa, nota no "Me ajude a refletir", nível atual da pirâmide, escolha das fontes da análise, pergunta de compartilhar ao concluir tarefa, visibilidade dos posts, convites.

### Tema visual

- Fontes **Inter** (texto) e **Source Serif 4** (títulos do necrológio e citações), servidas localmente.
- **Densidade mais compacta que o protótipo** (decisão do dono: mobile first, tudo um pouco menor e mais próximo). Tamanho base do html em 15px e `--spacing` do Tailwind em 0,22rem, em `apps/web/src/app/globals.css`; mexa só nesses dois valores para mudar a densidade do app inteiro. Medidas nas classes sempre em rem (ex.: `text-[0.9375rem]`), nunca em px fixo. No celular, campos de texto ficam com 16px para o iPhone não dar zoom.
- Cores por variáveis CSS, como no protótipo: `bg`, `surface`, `sunk`, `ink`, `muted`, `line`, `primary`, `accent` (roxo `#7c4dde`), `onprimary`, com versões clara e escura.
- **6 paletas** para a cor principal: Verde/Natureza (padrão), Azul/Serenity, Vermelho/Soft, Amarelo/Dourado, Roxo/Mindfulness, Preto/Premium (força o modo escuro). Mais o modo **aleatório**, que troca a cada 2 minutos.
- Componentes **shadcn/ui** devem usar esses mesmos tokens. O resultado precisa ser visualmente igual ao protótipo, não o visual padrão do shadcn.
- Ícones e ilustrações (paisagens `Art`, folhas, troféu, pena etc.) são os SVGs do protótipo, copiados para componentes.

## Stack obrigatória

Monorepo com **pnpm workspaces**:

- `apps/web`: **Next.js** (App Router) + TypeScript + Tailwind + **shadcn/ui** com o tema do protótipo. PWA instalável, com Web Push para notificações no celular.
- `apps/api`: **Nest.js** + **Prisma** + **PostgreSQL**.
- `packages/shared`: constantes de domínio (áreas, níveis de Maslow, XP, paletas) e tipos compartilhados entre web e api.
- **Arquivos** (fotos, imagens de sonhos, anexos, mídia de posts e stories, capas de trilhas e grupos) em storage **compatível com S3**. O navegador envia o arquivo direto para o storage usando uma **URL pré-assinada** gerada pela API; a API nunca recebe o arquivo em si.
- **Login com Google** feito no Nest com **Passport**, e **e-mail e senha** (senha guardada só como resumo scrypt, do próprio Node; códigos por e-mail na tabela `email_codes`). Depois do login, a sessão é um **JWT guardado em cookie httpOnly** (o JavaScript da página não consegue ler o cookie, o que protege contra roubo de sessão).

## Regra principal: roda 100% local

O computador do dono **não tem Docker** (a virtualização está desligada e ele optou por não ativar). Por isso, o jeito principal de rodar é **`pnpm dev`, direto no Windows, sem Docker e sem instalar nada no sistema**. Ele sobe todos os serviços, sem depender de nenhum serviço externo:

| Serviço | Como roda localmente | Em produção (futuro) |
|---|---|---|
| `web` | Next.js no Node | Vercel |
| `api` | Nest.js no Node | **Função da Vercel** (decisão do dono para o beta; ver docs/deploy.md). O Dockerfile continua disponível para um host de contêiner. |
| `postgres` | PostgreSQL de verdade via pacote npm `embedded-postgres` (dados em `.local/postgres`) | Postgres do Supabase |
| `storage` | **SeaweedFS** (`weed.exe`, compatível com S3) em `.local/bin` | Storage do Supabase (via protocolo S3) |
| `mailpit` | **Mailpit** (`mailpit.exe`) em `.local/bin`; caixa de entrada falsa em `http://localhost:8025` | Servidor SMTP real |

- Os programas `.exe` são baixados uma vez, com **versões fixas**, por um script do projeto (`pnpm setup:local`) para a pasta `.local/`, que não vai para o git. Nada é instalado no Windows.
- O **`docker-compose.yml` também existe** e usa as mesmas variáveis e os mesmos programas (Postgres, SeaweedFS, Mailpit). Ele serve para outros computadores e para a produção, mas **não pode ser testado no computador do dono**; avise isso sempre que mexer nele.
- **Beta publicado só com Supabase + Vercel** (decisão do dono). Na Vercel a API roda como função: entrada em `apps/api/api/index.js` → `src/serverless.ts`; as tarefas agendadas rodam uma vez por dia pela rota `/api/cron/daily` (protegida por `CRON_SECRET`), com `DISABLE_SCHEDULE=true`. **E-mail pelo Gmail** do dono (SMTP com "senha de app"; ver docs/deploy.md). Sem `SMTP_HOST`, o cadastro com senha e o "esqueci minha senha" somem da tela e os convites valem pelo login com Google.
- O MinIO **não é usado**: ele deixou de publicar versões gratuitas em 2025.

- **Login de desenvolvimento**: com `NODE_ENV=development`, a tela de login mostra usuários de teste para entrar com um clique, sem Google. Com qualquer outro valor de `NODE_ENV`, essa rota **não existe** na API (não é só escondida na tela).
- **IA simulada**: com `AI_MODE=mock`, o "Me analise" devolve um relatório realista montado com os dados da pessoa, sem chamar nenhum serviço externo. Com `AI_MODE=afl`, usa o agente **"Circle of Life — Me analise"** do **Agents for Life** (plataforma de agentes da Eduzz), pelo hub MCP deles (`AFL_API_URL`, `AFL_API_KEY`, `AFL_AGENT_ID`; código em `apps/api/src/analysis/afl-provider.ts`). As instruções do agente (tom, regras de segurança e o **formato JSON da resposta**) ficam no próprio AFL; se o formato mudar lá, o app precisa mudar junto. O agente não tem ferramentas e os dados vão entre as marcas `<dados_da_pessoa>`. Uma análise a cada `AI_INTERVAL_DAYS` dias (30); tentativa que falha não conta; **administradores não têm limite** (decisão do dono de 05/11/2026). **Anonimização** (decisão do dono de 05/11/2026, em `anonymize.ts`): antes de enviar, o nome e o sobrenome da pessoa viram `[PESSOA]` em todos os textos e e-mails, telefones, CPFs e links viram `[EMAIL]`, `[TELEFONE]`, `[CPF]` e `[LINK]`; a IA escreve com `[PESSOA]` e o app troca pelo primeiro nome antes de salvar. Nomes de outras pessoas não são detectados.
- O login com Google funciona localmente quando houver credenciais de teste no `.env`; sem elas, o botão do Google fica desativado com um aviso e o login de desenvolvimento continua funcionando.
- **Notificações no celular** (Web Push) dependem do serviço de push do navegador, que é externo. Localmente, as notificações do sino funcionam sempre; o push só é enviado se as chaves `VAPID_*` estiverem configuradas.

## Configuração por variáveis de ambiente

Tudo que muda entre ambientes vem de **variáveis de ambiente**: endereços, chaves, credenciais, nomes de bucket, domínio do cookie, modo da IA, SMTP, chaves de push. Por isso:

- **Nenhum código específico de Supabase ou Vercel.** Usamos só protocolos padrão: Postgres pela `DATABASE_URL`, storage pelo SDK S3 genérico, e-mail por SMTP, push pelo padrão Web Push. Trocar de provedor é trocar variáveis.
- Cada app tem um `.env.example` com **todas** as variáveis, comentadas em português. Os `.env` reais nunca vão para o git.
- A API valida as variáveis ao iniciar e para com uma mensagem clara se faltar alguma.
- Nada de URL, porta ou segredo fixo no código.

## Regras de código

- TypeScript em modo estrito nos dois apps.
- Toda rota da API exige usuário logado, exceto login, aceite de convite, health check e (só em desenvolvimento) o login de teste. Cada usuário só lê e altera os próprios dados; dados sociais respeitam amizade, grupo e visibilidade.
- Validar toda entrada na API (DTOs com validação). O HTML do necrológio é sanitizado no servidor antes de salvar.
- Regras de negócio (XP, encerrar sprint, status de tarefa, compra de trilha, visibilidade, notificações) ficam **na API**, não no navegador. O web só exibe.
- Mudanças no banco só por **migrations do Prisma**. Dados de exemplo pelo **seed**, que recria o cenário do protótipo para os usuários de teste.
- Testes automatizados para as regras de negócio da API e para os fluxos principais.

## Comandos

```bash
pnpm install       # instala as bibliotecas (o PostgreSQL vem junto, pelo npm)
pnpm setup:local   # uma vez: baixa SeaweedFS e Mailpit para .local/bin (conferidos por SHA-256)
pnpm dev           # sobe tudo (banco, storage, e-mail, api e web); Ctrl+C desliga
pnpm stop          # desliga o ambiente local se o terminal do pnpm dev foi fechado (só processos desta pasta)
pnpm typecheck     # confere os tipos de todos os apps
pnpm test          # testes automáticos da API (precisa do pnpm dev ligado; usa o banco circle_of_life_test)
pnpm db:studio     # abre uma tela no navegador para ver as tabelas do banco
pnpm push:keys     # gera as chaves VAPID das notificações no celular (copie para o .env)
pnpm db:seed       # recria os dados de exemplo (usuários de teste etc.)
pnpm db:reset      # apaga o banco local inteiro e recria (migrations + seed)
pnpm --filter @circle/api db:migrate --name descricao   # cria uma migration nova (com o banco ligado)
```

- Na primeira vez, o `pnpm dev` cria o `.env` a partir do `.env.example` e cria o banco em `.local/postgres`.
- Endereços locais: site `http://localhost:3000`, API `http://localhost:4000/api/health`, storage S3 `http://localhost:8333`, Mailpit `http://localhost:8025`.
- Ferramentas: Node 24, pnpm 12 (instalado para o usuário com `npm i -g pnpm`), TypeScript 6 (a versão que o Nest CLI suporta). A API compila com o `tsc` (o SWC não funciona nesta máquina por permissão de pasta).
- Versões das bibliotecas são **fixas** (sem `^`). Prefira versões publicadas há pelo menos duas semanas, **exceto correções de segurança**: rode `pnpm audit` ao adicionar ou atualizar bibliotecas.
- O pnpm só deixa rodar scripts de instalação dos pacotes listados em `allowBuilds` no `pnpm-workspace.yaml`. Confira o que o script faz antes de liberar um novo.
- Testes da API: `node:test` do próprio Node, sobre o código compilado pelo `tsc` (o Nest precisa dos metadados de tipos que só o `tsc` gera). Ficam em `apps/api/test/*.spec.ts`; cada arquivo roda num processo separado. Toda regra de negócio nova ganha teste.
- Rotas da API: toda rota exige login por padrão (guarda global). Use `@Public()` para abrir e `@AdminOnly()` para restringir a administradores. Pegue o usuário com `@CurrentUser()`.
- Para desligar o ambiente fora do terminal, use `pnpm stop` (encerra **só os processos desta pasta**), nunca todos os `node.exe` do computador. Se o dono estiver com o `pnpm dev` aberto no terminal dele, não desligue sem avisar.
- Pastas novas no site às vezes não são vistas pelo Tailwind do `next dev` já ligado (classes faltando na tela): reinicie o ambiente.
- O `next dev` gera o `apps/web/AGENTS.md`, que aponta para a documentação do Next.js instalada em `node_modules/next/dist/docs/`. Consulte essa documentação antes de usar APIs do Next.js.

O computador do dono tem 8 GB de memória e 2 núcleos: prefira soluções leves e evite processos desnecessários rodando ao mesmo tempo.
