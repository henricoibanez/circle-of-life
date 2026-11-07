# Regras de negócio do Circle of Life

Versão de 06/11/2026. Conferida no código da API (`apps/api/src`) e nos testes automáticos (`apps/api/test`).

## Como ler

- Cada regra tem um código (ex.: **RN-XP-03**) para facilitar conversas e pedidos de mudança. O prefixo diz o assunto.
- Cada regra é uma frase curta e, quando precisa, os detalhes: valores, condições, exceções e quem pode fazer.
- A fonte da verdade é o código da API. Quando o `CLAUDE.md` diz uma coisa e o código faz outra, vale o código, e a diferença está listada no fim, em **Divergências encontradas**.
- Regras marcadas com **(provisória)** podem mudar. Todas as regras de **XP** e de **Círculos** são provisórias: o dono ainda vai definir a regra definitiva da pontuação.
- "Dono do item" é a pessoa que criou aquilo (a tarefa, o post, o sonho). "Admin do app" é um administrador do Circle of Life. "Gestor" é quem administra um grupo. São papéis diferentes.
- Quando uma regra diz "é recusado", a pessoa vê uma mensagem em português explicando o motivo e nada é gravado.

## Glossário

| Termo | O que é |
|---|---|
| **Área da vida** | Uma das 10 áreas da Roda da Vida: Lazer, Relacionamento amoroso, Financeira, Família e amigos, Intelectual, Espiritual, Sociedade, Física, Emocional, Profissional e carreira. Não existe área "Outros". |
| **Iniciativa** | Objetivo de alto nível (ex.: "Vida longa e próspera"). Guarda épicos. Pode ser marcada como **Objetivo Master**. |
| **Épico** | Conjunto de entregas dentro de uma iniciativa (ex.: "Comprar uma casa"). Guarda tarefas. A primeira das suas áreas é a **área principal**. |
| **Tarefa** | Ação concreta dentro de um épico (ex.: "Visitar imóveis"). Tem status, prioridade, prazo, checklist, anexos e histórico. |
| **Backlog** | A lista de tudo que a pessoa planejou e ainda não está no quadro. Também é o primeiro status de uma tarefa. |
| **Quadro (Board)** | O Kanban da sprint, com as colunas A Fazer, Fazendo e Pronto. |
| **Sprint** | Período de trabalho numerado (Sprint 1, 2, 3…), com nome, objetivo e duração. Nasce "em planejamento" e só começa quando a pessoa aperta "Iniciar sprint". |
| **Trilha** | Um épico pronto, com as tarefas, que outras pessoas importam para o próprio backlog. Pode ser **da loja** (todos veem) ou **do grupo** (só membros veem). |
| **Jornada** | O caminho guiado de primeiro acesso, em 7 fases. Enquanto a pessoa está nele, parte do app fica trancada. |
| **Minha vida** | As 4 primeiras fases da Jornada (Roda da Vida, Maslow, Quadro de visualização e Necrológio). |
| **XP** | Experiência. Mostra o quanto a pessoa já fez no app. Só cresce com ações e só diminui com estornos (ex.: reabrir uma tarefa pronta). **XP nunca é gasto.** |
| **Círculos** | A moeda do app. Ganha-se na Jornada, na sprint 100% concluída e na ofensiva; gasta-se comprando trilhas pagas e liberando a rede social antes da hora. |
| **Ofensiva** | Sequência de dias seguidos em que a pessoa abre o app. Rende Círculos. |
| **Gestor** | Administrador de um grupo. Quem cria o grupo é gestor e escolhe outros gestores. |
| **Admin do app** | Administrador do Circle of Life: convida pessoas, aprova trilhas da loja e não tem limite de análises. |
| **Extrato** | A lista de todos os ganhos e estornos de XP e, separadamente, de todos os ganhos e gastos de Círculos. |
| **Fuso da pessoa** | O fuso horário guardado na conta. O padrão é `America/Sao_Paulo` e, nesta versão, não há tela para mudá-lo. |

---

## 1. Tempo, datas e fuso (RN-TEMPO)

- **RN-TEMPO-01** — "Dia" é sempre o dia no fuso da pessoa (padrão `America/Sao_Paulo`). Vale para "primeiro post/story/comentário do dia", para o XP diário da Roda da Vida, para a ofensiva e para os avisos de atraso.
- **RN-TEMPO-02** — A semana vai de **segunda a domingo** (usada na ofensiva).
- **RN-TEMPO-03** — Uma tarefa está **atrasada** quando tem prazo, o dia do prazo já terminou (23:59:59) e ela ainda não está Pronta.
- **RN-TEMPO-04** — Datas nas planilhas de importação usam o formato **dd/mm/aaaa**.

## 2. Acesso, login e convites (RN-ACESSO)

### Quem entra

- **RN-ACESSO-01** — Nesta versão o acesso é **só por convite**: só cria conta quem tem um convite válido para aquele e-mail.
  - Exceção 1: e-mails listados na variável `ADMIN_EMAILS` criam conta sem convite e já entram como **admin do app**. Se a conta já existia, ela vira admin no próximo login.
  - Exceção 2: com a variável `SIGNUP_MODE=open`, qualquer pessoa pode criar conta (o padrão é `invite`, só por convite).
  - Sem convite, a pessoa vê: "O Circle of Life está em fase de testes e o acesso é só por convite."
- **RN-ACESSO-02** — Há duas formas de entrar: **conta Google** e **e-mail e senha**. O login foi feito para aceitar outras formas no futuro.
- **RN-ACESSO-03** — Toda rota da API exige login, exceto: login, cadastro, códigos de senha, consulta de convite, health check, a tarefa diária agendada e (só em desenvolvimento) o login de teste.
- **RN-ACESSO-04** — A sessão fica num cookie que o JavaScript da página não consegue ler e dura **30 dias** por padrão (`SESSION_DAYS`).
- **RN-ACESSO-05** — O **login de teste** (entrar com um clique como usuário de exemplo) só existe com `NODE_ENV=development`. Em qualquer outro ambiente a rota não existe. Ele só aceita usuários marcados como de teste.

### Login com Google

- **RN-ACESSO-06** — Conta Google com e-mail **não verificado** é recusada.
- **RN-ACESSO-07** — Se já existe conta com aquele e-mail (criada com senha), o Google é ligado a essa mesma conta.
- **RN-ACESSO-08** — Se a pessoa abriu o link de um convite e entrou com uma conta Google de **outro e-mail**, ela recebe um aviso específico ("convite de outro e-mail") e não entra.

### Cadastro com e-mail e senha

- **RN-ACESSO-09** — O cadastro tem dois passos: (1) nome, e-mail, senha e aceite dos **termos de uso**; (2) um **código de 6 números** chega por e-mail. A conta só é criada depois que o código é confirmado.
  - Nome: 2 a 80 caracteres. Senha: **mínimo de 8 caracteres**. Aceitar os termos é obrigatório.
  - Se já existe conta com o e-mail, o cadastro é recusado e a pessoa é orientada a entrar ou usar "Esqueci minha senha".
  - O convite é conferido de novo no passo 2.
- **RN-ACESSO-10** — A senha é guardada só como um resumo (scrypt); nunca a senha em si.
- **RN-ACESSO-11** — Login com senha errada responde só "E-mail ou senha incorretos", sem dizer se o e-mail existe. Se a conta só entra com o Google, a mensagem explica como criar uma senha.
- **RN-ACESSO-12** — **Trava contra força bruta:** até **10 tentativas por e-mail a cada 10 minutos**. Um login certo zera o contador.
- **RN-ACESSO-13** — "Esqueci minha senha" manda um código **só se a conta existir**, sem contar a quem pergunta. O código permite criar uma senha nova (serve também para quem só entrava com o Google). A senha antiga deixa de valer.
- **RN-ACESSO-14** — Sem servidor de e-mail configurado (`SMTP_HOST`), o cadastro com senha e o "Esqueci minha senha" ficam indisponíveis; o login com Google continua valendo.

### Códigos por e-mail

| Regra | Valor |
|---|---|
| Tamanho do código | 6 números |
| Validade | 15 minutos |
| Tentativas erradas permitidas | 5 (depois disso, é preciso pedir outro) |
| Intervalo mínimo para pedir outro | 1 minuto |
| Máximo de códigos por e-mail | 10 por dia |
| Pedir um código novo | cancela o anterior |

### Convites

- **RN-ACESSO-15** — **Só admins do app** listam, criam, reenviam e cancelam convites. Participantes comuns não convidam (o pedido de amizade não é convite de acesso).
- **RN-ACESSO-16** — O convite vale por **7 dias** (`INVITE_DAYS`). Situações possíveis: pendente, aceito ou expirado.
- **RN-ACESSO-17** — Não dá para convidar quem **já tem conta**, nem criar um segundo convite pendente para o mesmo e-mail (use "Reenviar").
- **RN-ACESSO-18** — "Reenviar" gera um link novo (o anterior deixa de valer) e renova a validade. Convite já aceito não pode ser reenviado nem cancelado.
- **RN-ACESSO-19** — Se o e-mail do convite não puder ser enviado, o convite é desfeito e o admin vê o erro. Sem e-mail configurado, o convite vale mesmo assim: a pessoa entra com o Google daquele e-mail.
- **RN-ACESSO-20** — Ao criar a conta, todos os convites pendentes daquele e-mail ficam marcados como aceitos.
- **RN-ACESSO-21** — Toda conta nova, **inclusive de admin**, começa pela **Jornada**. Quem já usava o app antes da Jornada existir fica fora dela (tudo liberado).

## 3. Perfil, preferências e conta (RN-CONTA)

- **RN-CONTA-01** — O **ID** (@) é criado sozinho a partir do nome (sem acento, minúsculo, só letras e números; se repetir, ganha um número: "maria", "maria2"…).
- **RN-CONTA-02** — A pessoa pode trocar o ID: de **3 a 30** caracteres, só letras minúsculas, números, ponto ou sublinhado, e **único** no app (repetido é recusado).
- **RN-CONTA-03** — Nome: 1 a 80 caracteres. Bio: até 300 caracteres. Trocar ou tirar a foto apaga a foto antiga do storage.
- **RN-CONTA-04** — Preferências: paleta (Natureza, Serenity, Soft, Dourado, Mindfulness, Premium), modo aleatório, aparência (automática, clara, escura) e **visibilidade padrão** dos posts e stories (Todo mundo, Somente amigos, Privado; o padrão é Todo mundo).
- **RN-CONTA-05** — **Excluir minha conta** exige digitar **DELETAR** (a API confere; maiúsculas e minúsculas não importam). É definitivo e:
  - apaga todos os dados da pessoa e todos os arquivos dela no storage;
  - apaga os **convites e códigos** daquele e-mail, para que um admin possa convidar de novo e a pessoa recomece do zero;
  - encerra a sessão.

## 4. Jornada de primeiro acesso (RN-JOR)

A Jornada é o centro do app: guia a pessoa pelos exercícios até a primeira sprint.

- **RN-JOR-01** — São **7 fases, em ordem**. Uma fase só conta como feita se todas as anteriores também estiverem feitas.

| # | Fase | Fica feita quando |
|---|---|---|
| 1 | Roda da Vida | as **10 áreas** têm nota |
| 2 | Pirâmide de Maslow | pelo menos **1 item** marcado |
| 3 | Quadro de visualização | pelo menos **1 sonho** cadastrado |
| 4 | Necrológio | pelo menos **100 caracteres** de texto (sem contar a formatação; espaços repetidos contam como um) |
| 5 | Backlog | existe ao menos 1 iniciativa, 1 épico e 1 tarefa, e pelo menos 1 tarefa saiu do backlog (está no quadro ou numa sprint) |
| 6 | 1ª sprint | alguma sprint foi iniciada |
| 7 | Concluir minha jornada | a pessoa apertou "Concluir minha jornada" |

- **RN-JOR-02** — As fases 1 a 4 formam **Minha vida**. Enquanto Minha vida não estiver completa, ficam **trancados** (erro 403 com a mensagem "Complete Minha vida…"):
  - mover tarefa para A Fazer, Fazendo ou Pronto (voltar para o backlog é sempre permitido);
  - criar tarefa direto na sprint;
  - iniciar sprint;
  - as ações em massa "Para a sprint" e "Concluir".
  - Na importação por planilha, tarefas marcadas como A Fazer ou Fazendo entram no backlog.
  - O backlog em si (criar iniciativa, épico e tarefa) fica livre.
- **RN-JOR-03** — Depois que Minha vida fica completa **uma vez**, o quadro **não tranca mais**, mesmo que a pessoa apague algo depois.
- **RN-JOR-04** — **Durante a Jornada nada rende XP nem Círculos** (tarefa, checklist, roda, sonho, sprint, posts, ofensiva…). O acesso diário é contado, mas não rende Círculos. **(provisória)**
- **RN-JOR-05** — "Concluir minha jornada" só funciona depois da fase 6. Rende, **uma vez só**, **+1.000 XP e +1.000 Círculos**. A partir desse momento, XP e Círculos voltam a valer normalmente. **(provisória)**
- **RN-JOR-06** — Concluir a Jornada **não libera** a rede social sozinho. A pessoa escolhe:
  - **liberar agora pagando 500 Círculos** (sem saldo, é recusado); ou
  - **esperar 7 dias** contados de "Concluir minha jornada"; depois disso, liberar é de graça.
  - Liberar antes de concluir a Jornada é recusado; liberar de novo também.
- **RN-JOR-07** — Até liberar, ficam trancados (erro 403 com a mensagem "Isso abre quando você concluir a sua Jornada…"): **feed e posts, stories, amigos, grupos, fórum e mini-perfis/bloqueio** de pessoas.
- **RN-JOR-08** — Na **loja**, durante a Jornada a lista de trilhas aparece, mas só a trilha oficial **"Primeiros passos"** pode ser aberta, favoritada e importada. As outras ficam trancadas até liberar.
- **RN-JOR-09** — "Primeiros passos" é uma trilha oficial e grátis, com **uma tarefa em cada área da vida** (10 tarefas), cada uma com descrição e área próprias.
- **RN-JOR-10** — Ao liberar, a Jornada está **concluída de vez**: vira a conquista **"Jornada concluída"**, que conta em **todas as 10 áreas** em Minhas conquistas (só para quem fez a Jornada). O troféu de comemoração aparece **uma vez** e só depois da liberação.
- **RN-JOR-11** — O app guarda até qual fase o pop-up de parabéns já apareceu e se a pessoa já viu as boas-vindas, para não repetir.

## 5. XP e Círculos (RN-XP e RN-CIR)

Todas as regras desta seção são **provisórias**. Os valores ficam num único lugar (`packages/shared/src/xp.ts`) e as regras num único serviço da API.

### XP

- **RN-XP-01** — XP é experiência: **só se ganha**, nunca se gasta. Diminui apenas por estorno (quando a ação que rendeu XP é desfeita).
- **RN-XP-02** — Cada coisa (uma tarefa, um item de checklist, um épico…) rende XP **uma vez enquanto estiver valendo**. Concluir, reabrir e concluir de novo não acumula.
- **RN-XP-03** — Todo ganho e todo estorno ficam no **extrato de XP**.
- **RN-XP-04** — Durante a Jornada nada rende XP (ver RN-JOR-04).

| Ação | XP | Condições e estornos |
|---|---|---|
| Concluir tarefa | +10 | Só com a **sprint iniciada**. Sem sprint iniciada, conclui com 0. Reabrir (sair de Pronto) ou excluir a tarefa tira os 10. |
| Marcar item de checklist | +2 | Desmarcar ou excluir o item tira os 2; excluir a tarefa, o épico ou a iniciativa também tira. |
| Encerrar épico | +50 | Reabrir o épico, reabrir uma tarefa dele ou excluí-lo tira os 50. |
| Concluir iniciativa | +100 | Só se tiver **6 ou mais** tarefas concluídas (mais de 5). Com menos, conclui sem XP. Reabrir ou excluir tira os 100. |
| Encerrar sprint com todas as tarefas prontas | +100 | A sprint precisa ter pelo menos 1 tarefa. |
| Registrar avaliação da Roda da Vida | +20 | **Uma vez por dia**: registrar de novo no mesmo dia não rende. |
| Realizar um sonho | +30 | Excluir o sonho tira os 30. |
| Primeiro post do dia | +10 | Os outros posts do dia não rendem. Excluir o post não tira nem devolve a chance. |
| Primeiro story do dia | +10 | Idem. |
| Primeiro comentário do dia | +5 | Em qualquer post. |
| Alguém importar sua trilha **da loja** | +10 | Uma vez por pessoa que importou (qualquer versão da trilha). Trilhas de grupo não dão XP. O autor importando a própria não ganha. O aviso "Baixaram sua trilha" só fala em XP quando o autor ganhou. |
| Concluir minha jornada | +1.000 | Uma vez só. É o único XP que nasce durante a Jornada. |

### Círculos

- **RN-CIR-01** — Círculos são a moeda do app, com **saldo e extrato próprios**, separados do XP.
- **RN-CIR-02** — O saldo **nunca fica negativo**: gastar exige saldo suficiente; sem saldo, a compra é recusada com "Círculos insuficientes para essa compra." A conferência é feita na hora de descontar (duas compras ao mesmo tempo não furam o saldo).
- **RN-CIR-03** — Cada ganho acontece uma vez só por motivo (a mesma sprint, o mesmo dia de ofensiva).
- **RN-CIR-04** — Durante a Jornada não se ganha Círculos, exceto o prêmio da própria Jornada.

| Movimento | Círculos |
|---|---|
| Concluir minha jornada | **+1.000** (uma vez) |
| Encerrar sprint com todas as tarefas prontas (e pelo menos 1) | **+50** |
| Ofensiva: abrir o app num dia | **+10 a +40** (tabela abaixo) |
| Comprar trilha paga na loja | **− preço da trilha** (o valor **não** vai para o autor) |
| Liberar a rede social antes dos 7 dias | **− 500** |

- **RN-CIR-05** — Concluir tarefas, checklist, épicos, iniciativas, sonhos, posts e comentários **não** rende Círculos.

### Ofensiva (acessos)

- **RN-OFE-01** — Cada dia em que a pessoa abre o app conta **uma vez** (no fuso dela). Só o primeiro acesso do dia rende Círculos.
- **RN-OFE-02** — O prêmio depende dos **dias seguidos dentro da semana** (segunda a domingo). Pulou um dia ou começou uma semana nova, volta para 10.

| Dia seguido na semana | 1º | 2º | 3º | 4º | 5º | 6º | 7º |
|---|---|---|---|---|---|---|---|
| Círculos | 10 | 15 | 20 | 25 | 30 | 35 | 40 |

- **RN-OFE-03** — A **ofensiva** mostrada no perfil é a sequência total de dias seguidos (não zera na segunda-feira). O perfil mostra também os dias seguidos na semana, os acessos no mês, os dias da semana com acesso e quanto rende voltar amanhã. Se a pessoa ainda não abriu hoje, vale a sequência que terminou ontem.

## 6. Backlog: iniciativas, épicos e tarefas (RN-BKL)

### Regras gerais

- **RN-BKL-01** — O backlog é **só do dono**. Ninguém vê nem altera o backlog de outra pessoa; um item de outra pessoa responde como "não encontrado".
- **RN-BKL-02** — Toda tarefa pertence a um épico e todo épico pertence a uma iniciativa.
- **RN-BKL-03** — Limites de texto: nome de 1 a 120 caracteres; descrição de iniciativa e épico até 2.000; descrição de tarefa até 4.000; item de checklist de 1 a 200.
- **RN-BKL-04** — **Áreas sem limite:** iniciativa, épico e tarefa aceitam de uma até todas as 10 áreas.
  - Épico novo sem áreas escolhidas usa as da iniciativa; tarefa nova sem áreas usa as do épico. É só o padrão: a pessoa pode trocar.
  - A **primeira área do épico é a principal** (cor, ícone e categoria da trilha).
  - O épico nunca fica sem área: se nem ele nem a iniciativa têm área, recebe "Lazer" (a primeira da lista).
- **RN-BKL-05** — Prioridades: Alta, Média (padrão) e Baixa. Prazo é opcional.
- **RN-BKL-06** — A ordem pode ser escolhida arrastando; "voltar à ordem padrão" zera as posições (o backlog volta à ordem alfabética).

### Iniciativas

- **RN-BKL-07** — **Concluir iniciativa** exige que ela tenha **pelo menos 1 épico** e que **todos estejam encerrados**. Já concluída, é recusada. Vira conquista (ver XP em RN-XP).
- **RN-BKL-08** — Uma iniciativa concluída **volta a ficar aberta** (e perde o XP da conclusão) quando: ganha épico ou tarefa nova, recebe um épico movido de outra iniciativa, tem um épico duplicado dentro dela, tem um épico reaberto ou tem uma tarefa tirada de Pronto.
- **RN-BKL-09** — Iniciativa **não** é publicada como trilha.

### Épicos

- **RN-BKL-10** — **Encerrar épico** exige **pelo menos 1 tarefa** e **todas prontas**. Já encerrado, é recusado. Vira conquista em todas as suas áreas.
- **RN-BKL-11** — Não dá para criar, duplicar ou mover tarefa para dentro de um **épico encerrado**: é preciso reabri-lo antes.
- **RN-BKL-12** — Tirar uma tarefa de Pronto reabre o épico dela (se estava encerrado) e a iniciativa (se estava concluída), tirando o XP dos dois.

### Tarefas e status

- **RN-BKL-13** — Status da tarefa: **Backlog → A Fazer → Fazendo → Pronto**. O quadro mostra só A Fazer, Fazendo e Pronto.
- **RN-BKL-14** — Ao entrar no quadro, a tarefa é ligada à **sprint aberta** (iniciada ou em planejamento). Ao voltar para o backlog, desliga.
- **RN-BKL-15** — Ir para Pronto marca a data de conclusão. Com a sprint **iniciada**, rende XP; **sem sprint iniciada**, conclui sem XP e o app avisa **só na 1ª vez** em cada intervalo entre sprints.
- **RN-BKL-16** — Toda mudança de status, item de checklist marcado/desmarcado e anexo incluído ou removido fica no **histórico** da tarefa.
- **RN-BKL-17** — A tarefa nova pode nascer no backlog ou direto em A Fazer (na sprint atual), respeitando a trava da Jornada.

### Duplicar e excluir

- **RN-BKL-18** — Duplicar copia o item com " (cópia)" no nome. Duplicar iniciativa copia todos os épicos e tarefas; duplicar épico copia as tarefas. Nas cópias, **todas as tarefas voltam para o backlog**, o checklist vem **desmarcado** e não vêm anexos nem histórico. Iniciativa duplicada não vem como Objetivo Master.
- **RN-BKL-19** — Excluir iniciativa apaga os épicos e tarefas dela; excluir épico apaga as tarefas. O XP de tudo que foi apagado é **estornado** (para ninguém "fabricar" XP), e as imagens anexadas são apagadas do storage.

### Checklist e anexos

- **RN-BKL-20** — Anexos são imagens enviadas pela própria pessoa (ver RN-ARQ). Remover um anexo apaga a imagem do storage.

### Ações em massa

- **RN-BKL-21** — Com tarefas selecionadas (de 1 a 500), há três ações, aplicadas tarefa por tarefa com as regras normais:
  - **Para a sprint:** só as que estão no backlog vão para A Fazer; as que já estão no quadro ficam como estão.
  - **Concluir:** só as que ainda não estão prontas viram Pronto (com o XP de cada uma, se a sprint estiver iniciada).
  - **Excluir:** apaga todas as selecionadas e estorna o XP que rendiam. (A confirmação é pedida na tela.)
  - Tarefas de outra pessoa são ignoradas; se nenhuma for da pessoa, é recusado.

### Google Agenda (opcional)

- **RN-BKL-22** — Uma tarefa **com prazo** pode ser colocada na Google Agenda da pessoa (depois de conectar a agenda nas Configurações). Sem prazo, é recusado.
- **RN-BKL-23** — Mudar o prazo atualiza o evento; tirar o prazo tira o evento; excluir a tarefa apaga o evento. Problemas com a agenda nunca impedem a edição da tarefa.

### Exportar e importar planilha

- **RN-BKL-24** — **Exportar** gera as linhas no modelo do app antigo (área, iniciativa, descrição, épico, descrição, tarefa, descrição, previsão de entrega) mais status, prioridade e Objetivo Master. Primeiro vêm as iniciativas, depois os épicos, depois as tarefas.
- **RN-BKL-25** — **Importar** aceita até **3.000 linhas** e tem duas etapas: a **prévia** (mostra o que vai entrar, o que já existe, os problemas e o que falta completar, sem gravar) e a gravação.
- **RN-BKL-26** — A importação **junta sem duplicar**, comparando nomes sem acento e sem diferença de maiúsculas: iniciativa pelo nome; épico pelo nome dentro da iniciativa; tarefa pelo nome dentro do épico. O que já existe **não é alterado**; só entra o que é novo.
- **RN-BKL-27** — Regras de cada linha:
  - linha sem iniciativa é apontada como problema;
  - tarefa sem épico é apontada como problema;
  - área desconhecida é apontada (nomes do app antigo, como "saude_fisica" ou "carreira", são reconhecidos; uma célula pode ter várias áreas separadas por vírgula ou ponto e vírgula);
  - data inválida: a tarefa entra **sem prazo** e o problema é apontado;
  - épico novo sem área usa a primeira área da iniciativa; se a iniciativa também não tem, o épico é **ignorado** e apontado;
  - sem status, a tarefa entra no Backlog; sem prioridade, Média;
  - nomes muito longos são cortados em 200 caracteres.
- **RN-BKL-28** — Tarefas marcadas como **Pronto** na planilha entram como já entregues (fora do quadro) e **sem XP**. Tarefas em A Fazer ou Fazendo entram na sprint aberta (ou no backlog, se o quadro estiver trancado pela Jornada).
- **RN-BKL-29** — O relatório da importação lista o que falta completar: tarefas sem status, sem prioridade, sem prazo ou sem descrição; falta de Objetivo Master; iniciativas sem épico; épicos sem tarefa.

## 7. Sprints (RN-SPR)

- **RN-SPR-01** — Sempre existe uma sprint aberta. A primeira é a **Sprint 1**; cada nova recebe o número seguinte.
- **RN-SPR-02** — A sprint nasce **em planejamento** e só começa quando a pessoa aperta **"Iniciar sprint"**.
- **RN-SPR-03** — Na tela da sprint a pessoa define:
  - **nome** (até 60 caracteres; vazio = "Sprint N");
  - **objetivo** (até 1.000 caracteres, opcional);
  - **duração**: 7 dias (semanal), **14 dias (padrão)**, 30 dias (mensal) ou **sem prazo**.
- **RN-SPR-04** — **Iniciar sprint** exige pelo menos **1 tarefa em A Fazer** e Minha vida completa (Jornada). Sprint já iniciada não inicia de novo.
  - O fim previsto é o dia de início + duração − 1 (ex.: 14 dias começando dia 1 terminam dia 14). Sem prazo, não há fim previsto.
  - Tarefas que foram para Pronto **antes** de iniciar saem do quadro (continuam concluídas, sem XP), com registro no histórico.
  - Avisa no sino e no celular.
- **RN-SPR-05** — Mudar a duração de uma sprint já iniciada recalcula o fim previsto (e o aviso de prazo pode valer de novo).
- **RN-SPR-06** — Quando o prazo vence, o app **avisa uma vez** (no sino e no celular), no dia seguinte ao fim previsto, a partir das 8h no fuso da pessoa. **A sprint não é encerrada sozinha.**
- **RN-SPR-07** — **Encerrar a sprint** só é possível se ela foi iniciada. Ao encerrar:
  - tarefas **prontas** saem do quadro (arquivadas, vão para os relatórios);
  - tarefas em **A Fazer ou Fazendo** voltam para o **backlog**, com registro no histórico;
  - a sprint vai para o histórico com "prontas/total";
  - a próxima sprint nasce **em planejamento** e herda a duração.
- **RN-SPR-08** — Sprint **completa** = pelo menos 1 tarefa e **todas prontas**. Só ela rende **+100 XP e +50 Círculos** (provisória). Sprint vazia não conta como completa.
- **RN-SPR-09** — A sprint de uma pessoa nunca mexe nas tarefas de outra.

## 8. Exercícios de reflexão (RN-EXE)

### Roda da Vida

- **RN-EXE-01** — Cada uma das 10 áreas recebe uma nota **inteira de 0 a 10**. Dá para salvar só as áreas que mudaram. Nota fora da faixa ou área inexistente é recusada.
- **RN-EXE-02** — As notas salvam sozinhas. **"Registrar avaliação de hoje"** guarda uma foto das notas no histórico; exige que alguma nota tenha sido dada. Rende +20 XP **uma vez por dia** (provisória).
- **RN-EXE-03** — **Registro automático:** se a pessoa mexeu nas notas e não registrou, depois que o dia dela termina as notas viram um registro, com a data da última nota, **sem XP** e uma vez só. Se ela registrou depois da última nota, não há registro extra.
- **RN-EXE-04** — O equilíbrio geral é a média das 10 notas.

### Pirâmide de Maslow

- **RN-EXE-05** — A pessoa marca ou desmarca itens de uma lista fixa (cada um "Fora do trabalho" ou "No trabalho"), em 5 níveis: Fisiológicas, Segurança, Relacionamento, Estima e Autorrealização. Item fora da lista é recusado.
- **RN-EXE-06** — **Nível atual:** subindo da base para o topo, é o primeiro nível com **menos de 70%** dos itens marcados. Com todos acima disso, é Autorrealização.
- **RN-EXE-07** — Reflexões por nível: de 1 a 1.000 caracteres; só o dono apaga.

### Quadro de visualização (sonhos)

- **RN-EXE-08** — Cada sonho tem texto (1 a 300 caracteres), **uma** área da vida e imagem opcional.
- **RN-EXE-09** — No máximo **10 sonhos abertos**. Sonhos realizados não contam. O 11º é recusado ("Realize ou exclua um para abrir espaço").
- **RN-EXE-10** — **"Realizei"** marca o sonho como realizado e rende +30 XP (provisória). Sonho já realizado não é realizado de novo. Excluir o sonho tira o XP e apaga a imagem.

### Necrológio

- **RN-EXE-11** — É um único texto com formatação, salvo sozinho. Sem seções e sem percentual.
- **RN-EXE-12** — Antes de salvar, a API **limpa o texto**: só passam títulos, parágrafos, negrito, itálico, sublinhado, cor de destaque, listas e alinhamento; o resto (scripts, links, imagens) é removido. Tamanho máximo: 200.000 caracteres (com a formatação).
- **RN-EXE-13** — Para a Jornada, contam pelo menos **100 caracteres** de texto puro.

### Minhas conquistas

- **RN-EXE-14** — Por área da vida, contam: **épicos encerrados** (em todas as suas áreas), **iniciativas concluídas** (em todas as suas áreas) e a **Jornada concluída** (em todas as 10 áreas, só para quem fez a Jornada).

## 9. Trilhas (RN-TRI)

### Publicar

- **RN-TRI-01** — Só se publica **um épico** como trilha (iniciativa não). O épico precisa ter **pelo menos 1 tarefa**. A trilha leva as tarefas com descrição e áreas.
- **RN-TRI-02** — Ao publicar a pessoa informa: nome (até 120; padrão é o nome do épico), **descrição de 10 a 600 caracteres**, **categoria** (Relacionamento, Financeira, Saúde e bem-estar, Pessoal, Hobbies, Espiritualidade, Estudos), capa opcional e **preço em Círculos** (inteiro de 0 a 100.000; 0 = grátis) e se vai para a loja ou para um grupo.
- **RN-TRI-03** — A trilha aparece em **todas as áreas do épico**; a primeira é a principal (cor e ilustração).

### Loja

- **RN-TRI-04** — Trilha publicada na loja fica **pendente** e **todos os admins do app são avisados**. Só aparece para os demais depois de **aprovada**.
- **RN-TRI-05** — Quem vê o quê na loja:
  - todos: trilhas aprovadas;
  - o autor: as suas pendentes ("Em análise") e recusadas (com o motivo);
  - admins do app: também todas as pendentes.
  - Trilhas de grupo nunca aparecem na loja.
- **RN-TRI-06** — **Só admins do app aprovam ou recusam** trilhas da loja, inclusive a própria (pode haver um único admin). Só trilhas pendentes podem ser revisadas. Recusar aceita um **motivo opcional** (até 500 caracteres) e o autor é avisado, para ajustar e publicar de novo. Aprovar também avisa o autor.
- **RN-TRI-07** — **Nova versão:** publicar de novo o mesmo épico cria uma nova versão pendente. A versão aprovada **continua na loja** até a nova ser aprovada; aí a antiga sai. Uma versão anterior ainda pendente ou recusada é substituída.
- **RN-TRI-08** — **Tirar da loja:** o autor ou um admin do app. Quem já importou continua com a cópia no backlog.

### Importar e comprar

- **RN-TRI-09** — Ao importar, a pessoa escolhe uma **iniciativa dela** ou dá nome a uma **nova** (até 200 caracteres). O épico entra nessa iniciativa com as tarefas (todas no backlog, na ordem da trilha, com descrição, áreas e histórico "Importada da trilha…"). A iniciativa escolhida ganha as áreas da trilha que ainda não tinha.
- **RN-TRI-10** — **Trilha paga:** na primeira importação, o preço é descontado dos **Círculos** de quem compra. Sem saldo suficiente, a compra é recusada. O preço **não vai para o autor**.
- **RN-TRI-11** — Quem já baixou ou comprou qualquer versão daquela trilha **importa de novo de graça**.
- **RN-TRI-12** — O **autor** importa a própria trilha sem pagar e sem ganhar XP.
- **RN-TRI-13** — Cada pessoa diferente que importa uma trilha **da loja** rende **+10 XP ao autor** (uma vez por pessoa) e um aviso para ele.
- **RN-TRI-14** — Downloads mostrados = quantidade de pessoas que adquiriram (mais um número inicial, usado nas trilhas de exemplo).
- **RN-TRI-15** — Favoritar exige poder ver a trilha.

### Trilhas do grupo

- **RN-TRI-16** — Trilha de grupo é **sempre grátis** (o preço é ignorado), só os **membros** veem e não dá XP de download.
- **RN-TRI-17** — Publicar no grupo exige ser membro:
  - **gestor** publica direto (já aprovada) e os membros são avisados;
  - **membro comum** só **sugere**: fica pendente e os gestores são avisados. O gestor aprova ou recusa (motivo opcional); o autor é avisado.
- **RN-TRI-18** — Membros veem as trilhas aprovadas. Gestores veem também todas as sugestões pendentes; o membro vê as próprias sugestões (pendentes ou recusadas).
- **RN-TRI-19** — **Trazer da loja:** só gestor, e só trilhas **aprovadas** da loja. Cria uma **cópia do grupo** (a da loja não muda). Se a trilha é paga, o gestor precisa já tê-la comprado (ou ser o autor). A mesma trilha não entra duas vezes no grupo.
- **RN-TRI-20** — **Editar** (nome, descrição, áreas e lista de tarefas): só gestores, e só trilhas do grupo. A trilha precisa ficar com pelo menos 1 tarefa; até 100 tarefas, cada uma com até 200 caracteres. Editar não muda o que já foi importado.
- **RN-TRI-21** — **Tirar do grupo:** o autor ou um gestor. Quem já importou continua com o épico.

## 10. Feed e posts (RN-FEED)

- **RN-FEED-01** — **Quem vê um post:**
  - o autor, sempre;
  - os **membros dos grupos** em que ele foi publicado;
  - mais o que a visibilidade libera: **Todo mundo** = todos; **Somente amigos** = amigos do autor; **Privado** = ninguém além dos anteriores.
  - Atenção: um post "Todo mundo" num grupo privado fica visível para todos; para ficar só no grupo, use "Privado".
- **RN-FEED-02** — Pessoas bloqueadas (em qualquer sentido) somem do feed uma da outra.
- **RN-FEED-03** — Post que a pessoa não pode ver responde como "não encontrado": não dá para curtir, comentar ou salvar.
- **RN-FEED-04** — Filtros: Para você (tudo que pode ver), Amigos, Grupos, Seguindo (amigos + grupos), Salvos, por área, por autor e por grupo. O feed vem em páginas de 20.
- **RN-FEED-05** — Criar post:
  - precisa de **texto ou título da conquista**;
  - título até 120 caracteres, texto até 3.000;
  - **até 8 imagens**; cada imagem só pode estar em um post;
  - áreas da vida **sem limite**;
  - **vários grupos**, mas só grupos de que a pessoa participa (senão, 403);
  - até 10 hashtags, cada uma até 30 caracteres (o "#" e as repetidas são retirados);
  - visibilidade: a escolhida ou a padrão das preferências.
- **RN-FEED-06** — Post de conclusão ("Quer compartilhar?") mostra o **XP que a pessoa ganhou e ainda vale** com aquele item (tarefa, épico, iniciativa, sprint ou sonho).
- **RN-FEED-07** — Só o autor **edita e exclui** o próprio post. Imagens retiradas na edição ou do post excluído são apagadas do storage.
- **RN-FEED-08** — **Curtidas:** uma por pessoa. O autor é avisado; várias curtidas no mesmo post viram **um aviso só** enquanto ele não for lido ("Ana e mais 2 pessoas curtiram…"). O post mostra até 3 pessoas em "Curtido por".
- **RN-FEED-09** — **Comentários:** de 1 a 1.000 caracteres; avisam o autor do post. Apagar: quem escreveu ou o autor do post.
- **RN-FEED-10** — **Reações em comentários:** uma por pessoa, entre 👍 Curtir, 👎 Não curti e ❤️ Amei. Dá para trocar ou tirar.
- **RN-FEED-11** — Salvar post é pessoal (aparece no filtro Salvos).

## 11. Stories (RN-STO)

- **RN-STO-01** — Story é **uma foto que some em 24 horas**.
- **RN-STO-02** — Exige **pelo menos 1 área da vida** (pode marcar todas), mostradas como marca d'água. Legenda opcional de **até 150 caracteres**.
- **RN-STO-03** — **Quem vê:** o autor; "Todo mundo" = todos; "Somente amigos" = amigos do autor; "Privado" = só o autor. Bloqueados não se veem. Os filtros do feed não se aplicam.
- **RN-STO-04** — Sem comentários. Cada pessoa tem **uma reação** (Curtir, Não curti ou Amei), que pode trocar ou tirar. O autor é avisado, com aviso agrupado como nos posts.
- **RN-STO-05** — Só o autor vê **"Visto por"**, o total de reações e quantas de cada tipo. A visualização do próprio autor não conta.
- **RN-STO-06** — Só o autor apaga o story (a foto é apagada; o XP do primeiro story do dia fica).
- **RN-STO-07** — Uma limpeza **de hora em hora** (e na tarefa diária) apaga os stories vencidos e as fotos.
- **RN-STO-08** — Ordem: os seus primeiro, depois quem tem story que você ainda não viu.

## 12. Amigos, bloqueio e perfis (RN-AMG)

- **RN-AMG-01** — Só dá para adicionar quem **já tem conta**. A busca é por **nome ou @ID** (mínimo 2 letras, até 8 resultados) e mostra a situação: amigo, pedido enviado, pedido recebido ou nenhuma. O e-mail das pessoas não aparece na busca.
- **RN-AMG-02** — Pedido de amizade: não dá para si mesmo, para quem não existe, para quem já é amigo, para quem já recebeu pedido seu, nem para bloqueados. O destinatário é avisado no sino e por e-mail.
- **RN-AMG-03** — Se a outra pessoa já tinha mandado pedido para você, pedir de volta vira **amizade na hora**.
- **RN-AMG-04** — Só quem **recebeu** aceita; aceitar avisa quem pediu. Recusar (quem recebeu) ou cancelar (quem mandou) apaga o pedido. Qualquer um dos dois pode desfazer a amizade.
- **RN-AMG-05** — **Bloqueio vale nos dois sentidos** e é completo: desfaz amizade e pedidos pendentes; a pessoa some do feed, dos stories, das buscas e dos convites de grupo; não dá para mandar pedido. No mini-perfil, somem as conquistas, as áreas, os amigos e grupos em comum e o botão de amizade (nome, @, bio, "membro desde" e XP total continuam aparecendo). Não dá para bloquear a si mesmo. Desbloquear volta ao normal (sem refazer a amizade).
- **RN-AMG-06** — O **mini-perfil** mostra nome, @, foto, bio, "membro desde", XP total, número de conquistas (épicos encerrados + iniciativas concluídas + Jornada concluída), até 3 áreas com mais conquistas, amigos em comum e até 5 grupos em comum.

## 13. Grupos e fórum (RN-GRP)

### Grupo

- **RN-GRP-01** — Qualquer pessoa (com a rede liberada) cria grupo: nome de 3 a 60 caracteres, descrição até 300, uma área da vida, capa opcional e se é **privado**. Quem cria vira **gestor**.
- **RN-GRP-02** — **Editar e excluir o grupo:** qualquer gestor.
- **RN-GRP-03** — **Grupo público:** entrar é na hora; os gestores são avisados.
- **RN-GRP-04** — **Grupo privado:**
  - quem está de fora vê só nome, descrição e capa (não vê membros nem trilhas);
  - "Entrar" vira um **pedido**, e os gestores são avisados; a pessoa pode cancelar;
  - o gestor **aprova** (a pessoa entra e é avisada) ou **recusa** com motivo opcional de até 300 caracteres (a pessoa é avisada e pode pedir de novo);
  - o gestor também pode **convidar** (busca por nome ou @, sem bloqueados); a pessoa aceita (entra) ou recusa; o gestor pode cancelar o convite;
  - convidar quem já pediu equivale a aprovar o pedido;
  - membro comum não aprova nem convida.
- **RN-GRP-05** — **Remover e banir:** só gestores; não vale para si mesmo, para o criador nem para outro gestor (tire de gestor antes). Removido pode voltar; **banido não entra, não pede e não é convidado** até um gestor desbanir.
- **RN-GRP-06** — **Escolher gestores:** só o **criador**; se o criador saiu do grupo, qualquer gestor. O criador continua **sempre gestor** e o grupo precisa ter **pelo menos 1 gestor**. Quem vira gestor é avisado.
- **RN-GRP-07** — **Sair:** se quem sai era o último gestor e ainda há membros, o **membro mais antigo vira gestor** sozinho.
- **RN-GRP-08** — Gestores cuidam das trilhas do grupo (ver RN-TRI-16 a 21) e moderam o fórum.

### Fórum

- **RN-GRP-09** — Só **membros** leem e escrevem no fórum.
- **RN-GRP-10** — Tópico: título de 3 a 120 caracteres e texto até 3.000. Resposta: 1 a 2.000. Tópico novo avisa os outros membros; resposta avisa o autor do tópico. A lista mostra os 100 tópicos com atividade mais recente.
- **RN-GRP-11** — Apagar tópico ou resposta: **quem escreveu ou um gestor**.

## 14. Análise inteligente — "Me analise" (RN-IA)

- **RN-IA-01** — A pessoa escolhe as **fontes**: Necrológio, Roda da Vida, Pirâmide, Quadro de visualização e Tarefas. Só aparecem ativas as fontes **com dados**; é preciso escolher pelo menos uma.
- **RN-IA-02** — **Uma análise a cada 30 dias** por pessoa (`AI_INTERVAL_DAYS`; com 0, sem limite). Antes disso, é recusada com a data da próxima. **Admins do app não têm limite.**
- **RN-IA-03** — **Tentativa que falha não conta:** o relatório só é guardado quando a IA responde bem.
- **RN-IA-04** — **Anonimização** antes de enviar para a IA: nome e sobrenome da pessoa viram `[PESSOA]` (com ou sem acento); e-mails, links, CPFs e telefones viram `[EMAIL]`, `[LINK]`, `[CPF]` e `[TELEFONE]`. A resposta volta com `[PESSOA]` trocado pelo **primeiro nome**. Nomes de outras pessoas não são detectados.
- **RN-IA-05** — O que vai para a IA tem limites: necrológio até 8.000 caracteres, até 20 tarefas por épico e as últimas 6 sprints encerradas.
- **RN-IA-06** — O relatório é ajustado antes de mostrar: índice de alinhamento de **0 a 100** (abaixo de 50 = baixo; 50 a 69 = médio; 70 ou mais = bom); até 5 itens em padrões, gaps, manter, ajustar, pausar e próximos 7 dias; até 4 padrões limitantes; até **4 sugestões**, cada uma com até 4 épicos e até 8 tarefas por épico; sugestões sem nome ou sem áreas válidas são descartadas.
- **RN-IA-07** — **Importar sugestão:** a pessoa marca os épicos e as tarefas que quer (pelo menos 1 épico). Cria uma **iniciativa nova** com a descrição e o "Por que é importante", e os épicos e tarefas vão para o backlog. Não passa pela loja.
- **RN-IA-08** — Sem nenhuma análise, a tela mostra um relatório de exemplo. Relatórios antigos abrem no formato novo.
- **RN-IA-09** — Modo simulado (`AI_MODE=mock`) monta um relatório com os dados da pessoa sem chamar serviço externo; o modo real (`AI_MODE=afl`) usa o agente do Agents for Life e exige endereço, chave e agente configurados.

## 15. Notificações (RN-NOT)

- **RN-NOT-01** — Ninguém recebe notificação das **próprias ações**.
- **RN-NOT-02** — Toda notificação vai para o **sino**. Vai também para o **celular** se a pessoa ativou e se as chaves de push (`VAPID_*`) estão configuradas; aparelhos que não aceitam mais são descartados.
- **RN-NOT-03** — No sino: lista das 50 mais recentes, contador de não lidas, marcar como lida ou não lida, marcar todas, apagar uma e limpar todas.
- **RN-NOT-04** — Notificações com mais de **90 dias** são apagadas automaticamente.
- **RN-NOT-05** — **Tarefa atrasada:** um aviso por tarefa, no **dia seguinte ao prazo**, a partir das **8h** no fuso da pessoa (`OVERDUE_HOUR`). Tarefa com prazo hoje não avisa. Mudar o prazo permite um novo aviso. Tarefas prontas ou arquivadas não avisam.
- **RN-NOT-06** — Motivos de notificação: pedido e aceite de amizade; curtida em post; reação em story; comentário; tarefa atrasada; sprint iniciada; prazo da sprint; trilha baixada, pendente (para admins), aprovada ou recusada; e, nos grupos, entrada, trilha nova, trilha sugerida, novo gestor, tópico, resposta, pedido para entrar, convite, pedido aprovado e pedido recusado.

## 16. Arquivos e imagens (RN-ARQ)

- **RN-ARQ-01** — Só imagens **JPG, PNG, WEBP ou GIF**.

| Uso | Tamanho máximo |
|---|---|
| Foto do perfil | 2 MB |
| Sonho, anexo de tarefa, post, story, capa de grupo, capa de trilha | 5 MB |

- **RN-ARQ-02** — O navegador envia a imagem direto para o storage; a API confere se ela chegou e o tamanho. Imagem grande demais é apagada e recusada.
- **RN-ARQ-03** — Cada imagem só pode ser usada pela **própria pessoa** e na **finalidade** para a qual foi enviada (uma foto de story não vira anexo de tarefa).
- **RN-ARQ-04** — Envios começados há mais de 1 dia e nunca confirmados são apagados.

## 17. Tarefas automáticas (RN-AUT)

- **RN-AUT-01** — Onde a API fica sempre ligada, estas tarefas rodam **a cada hora**: aviso de tarefas atrasadas, aviso de prazo de sprint, limpeza de notificações antigas, registro automático da Roda da Vida e limpeza de stories vencidos.
- **RN-AUT-02** — Na Vercel, as mesmas tarefas rodam **uma vez por dia** pela rota `/api/cron/daily`, protegida por `CRON_SECRET` (sem o segredo, a rota não existe). Ela também limpa os contadores de tentativas com mais de um dia.

---

## Divergências encontradas

Diferenças entre o `CLAUDE.md` e o código (o código é o que vale hoje). Círculos, ofensiva e reações já estão no `CLAUDE.md` desde 06/11/2026.

1. **Roda da Vida rende XP uma vez por dia.** O `CLAUDE.md` diz "+20 por avaliação registrada". O código dá +20 **só no primeiro registro do dia**.
2. **Áreas podem ficar vazias.** O `CLAUDE.md` diz que iniciativa e post aceitam "de uma até todas" as áreas. O código **não exige** área em iniciativa nem em post (zero é aceito). Num épico, se nem ele nem a iniciativa têm área, ele recebe "Lazer" sozinho.
3. **Loja trancada durante a Jornada.** O `CLAUDE.md` lista como trancados rede social, amigos, grupos, fórum, perfis e "Quer compartilhar?". O código também tranca **abrir, favoritar e importar trilhas da loja**, menos a "Primeiros passos" (a lista aparece).
4. **Pedido de amizade por e-mail.** O `CLAUDE.md` diz que adicionar amigo é pela busca por nome ou @ID, "não é campo livre". A API também aceita pedido pelo **e-mail** da pessoa (a busca continua só por nome e @ID).
5. **Saída do último gestor.** O `CLAUDE.md` diz que, se o criador sair, "os gestores escolhem". O código faz isso e, além disso, se **não sobrar nenhum gestor**, promove sozinho o membro mais antigo.
6. **Cadastro aberto já existe como opção.** O `CLAUDE.md` trata o cadastro aberto como futuro. O código já tem a chave `SIGNUP_MODE=open` (desligada por padrão).
7. **"Uma análise por mês" = 30 dias.** O limite é contado em 30 dias desde a última análise (configurável), não por mês do calendário.
8. **Visibilidade de stories.** O `CLAUDE.md` não fala em visibilidade de stories. O código usa as mesmas opções dos posts (padrão das preferências), e stories não são mostrados por grupo.

Pontos de atenção: os dois encontrados na revisão (XP do checklist ao excluir tarefa e o texto do aviso de trilha baixada) foram corrigidos em 07/11/2026.

