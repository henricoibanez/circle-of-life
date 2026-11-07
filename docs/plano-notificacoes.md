# Plano: evolução das notificações

> **Status: as 7 etapas foram implementadas em 07/11/2026** (o dono pediu para fazer tudo de uma vez e testar localmente). Ainda não foram publicadas.
> Ajustes feitos na implementação das etapas 3 a 7:
> - O aviso da Jornada (`jornada_parada`) sai aos **2, 5 e 10 dias** sem avançar (um em cada marco) e fica na categoria **Alertas**.
> - **Novidades sem imagem** nesta versão e com **texto simples** (linha em branco separa parágrafos; "- " vira lista), em vez da barra de formatação do necrológio. Abrem numa **tela** (`/novidades/ID`), não numa folha.
> - **"Lembra disso?"** abre uma **tela** (`/lembranca`), não uma folha.
> - **Pesquisas** mostram os comentários **sem nomes**. A pessoa pode mudar a nota e o comentário enquanto a pesquisa estiver aberta (os círculos saem uma vez só).
> - O **convite para ligar o celular** fica no topo do **Board**.
> - Localmente, uma só tarefa agendada (de hora em hora) roda primeiro os alertas e depois os avisos de engajamento, para os alertas terem prioridade no limite do dia.
> Notas da etapa 1: as **curtidas já eram agrupadas** (no sino, um aviso por post enquanto não lido, e só o primeiro vai ao celular), então nada mudou nelas. A tarefa atrasada **continua usando** o campo `overdueNotifiedAt` para saber quais já entraram num resumo (é zerado quando o prazo muda); o `notification_log` guarda o resumo do dia. Os avisos automáticos sempre chegam ao sino; ao celular, só fora do silêncio da pessoa.
> Escrito em 07/11/2026.

## O princípio

As notificações existem para **lembrar a pessoa de priorizar a própria vida**, não para chamar atenção a qualquer custo. Por isso:

1. **Pouco e certeiro.** Um limite por dia e por semana para tudo que o app manda "por iniciativa própria" (alertas automáticos, dicas, lembranças).
2. **Nunca o mesmo aviso duas vezes** (o app guarda o que já mandou, mesmo que a pessoa limpe o sino).
3. **Na hora certa**, no fuso da pessoa, e nunca durante o horário de silêncio dela.
4. **A pessoa manda**: ela escolhe o que quer receber, se vai para o celular e quanto.

## O que existe hoje (conferido no código)

- `NotificationsService.notify()` cria o aviso do sino e, se a pessoa ligou, manda para o celular (Web Push). Não há limite, nem horário de silêncio, nem preferência por tipo: o celular recebe **tudo** ou **nada**.
- 22 tipos (`NotificationType`): amizade, curtidas, comentários, tarefa atrasada, sprint iniciada, prazo da sprint, trilhas e grupos.
- Tarefas automáticas: **tarefa atrasada** (um aviso por tarefa) e **prazo da sprint**, de hora em hora no computador local e **uma vez por dia na Vercel** (às 8h de Brasília, `0 11 * * *` em `apps/api/vercel.json`).
- No celular (`sw.js`): título, texto e link. Sem imagem e sem botões.
- Em Perfil/Configurações: só o liga/desliga do celular neste aparelho.
- Não há tela de administração além de **Convites**.

## 1. As categorias

Todo tipo de notificação passa a ter uma **categoria**. A categoria decide se conta no limite, se pode ir para o celular e o que a pessoa pode desligar.

| Categoria | Exemplos | Conta no limite? | Vai para o celular? |
|---|---|---|---|
| **Atividade** (o que já existe) | pedido de amizade, curtida, comentário, grupos, trilhas | Não (é resposta a algo que alguém fez) | Sim, fora do horário de silêncio. Curtidas são **agrupadas** ("Ana e mais 3 curtiram seu post") |
| **Alertas** | tarefa atrasada, prazo da sprint, épico concluído sem próximo passo, épico sem tarefas | Sim | Sim |
| **Dicas** | área da vida parada, volte para o app, convite para um grupo, "aconteceu algo bom?" | Sim | Sim (é onde o push mais ajuda: quem esqueceu o app não abre o sino) |
| **Lembranças** | "Lembra disso?" | Sim | Sim, com foto quando o aparelho mostra |
| **Novidades** | nova versão do app | Não (só quando o admin publica) | Sim, se a pessoa deixou ligado |
| **Pesquisas** | "O que está achando do app?" | Não (no máximo 1 a cada 30 dias por pessoa) | Sim, mas a nota é dada no app (veja o item 6) |

## 2. Limites, repetição e horário

**Limite padrão** (só Alertas, Dicas e Lembranças):

| Escolha em Configurações | Por dia | Por semana |
|---|---|---|
| Pouco | 1 | 3 |
| **Normal (padrão)** | 2 | 6 |
| Mais | 3 | 10 |

- **Prioridade** quando passa do limite: Alertas primeiro, depois Lembranças, depois Dicas. O que não coube fica para o dia seguinte (se ainda fizer sentido) ou é descartado.
- **No máximo 1 dica por dia**, mesmo com limite sobrando.
- **Sem repetição**: cada aviso tem uma "chave" (ex.: `epico_vazio:<id do épico>`). A mesma chave não sai de novo. Dicas da mesma família (ex.: área parada) esperam pelo menos 14 dias para voltar, e com outra área.
- **Horário de silêncio** (padrão **22h às 8h**, ajustável; ou seja, avisos só **das 8h às 22h**): nada vai para o celular nesse intervalo. O aviso continua chegando ao sino. Avisos de Atividade que caem no silêncio ficam só no sino (não acumulam para disparar de manhã).
- **Tarefa atrasada revisada**: hoje sai um aviso **por tarefa**; com 5 atrasadas, são 5 avisos. Proposta: **um resumo por dia** ("Você tem 3 tarefas atrasadas"), contando como 1 aviso no limite. A mesma tarefa só volta a aparecer num resumo se o prazo mudar.

### E a Vercel, que roda só uma vez por dia?

- Na Vercel, as tarefas automáticas rodam **uma vez por dia às 8h de Brasília**. Então Alertas, Dicas e Lembranças saem todas de manhã. Funciona bem para quem está no Brasil.
- A tarefa diária fica **"retomável"**: processa as pessoas em lotes e anota o que já mandou. Se passar do tempo (60 segundos), a próxima chamada continua de onde parou sem duplicar.
- **Opcional, para depois**: se quisermos deixar a pessoa escolher o horário (manhã, almoço ou noite), o agendamento precisa rodar de hora em hora. Isso pede o plano pago da Vercel **ou** um agendador gratuito externo chamando a mesma rota protegida. Até lá, a preferência de horário não aparece na tela.

## 3. Os novos tipos

### 3.1 Alertas

| Tipo | Quando | Texto (rascunho) | Leva para |
|---|---|---|---|
| `tarefas_atrasadas` (substitui `tarefa_atrasada`) | Resumo diário, se há tarefa vencida e não pronta | "Você tem 3 tarefas atrasadas. Que tal rever os prazos?" | Board, com o aviso de atrasadas aberto |
| `epico_sem_proximo` | Todas as tarefas do épico prontas, épico não encerrado, nenhuma tarefa nova há **3 dias** | "Você concluiu tudo em “Comprar uma casa”. Encerre o épico ou planeje o próximo passo." | Épico no backlog |
| `epico_vazio` | Épico criado há **3 dias** ou mais e ainda sem nenhuma tarefa | "“Aprender inglês” ainda não tem tarefas. Qual é o primeiro passo?" | Épico no backlog, com "Nova tarefa" à mão |

Cada épico gera no máximo um aviso de cada tipo (se a situação mudar e voltar, pode avisar de novo depois de 14 dias).

### 3.2 Dicas e engajamento

| Tipo | Quando | Texto (rascunho) | Leva para |
|---|---|---|---|
| `area_parada` | Uma área da vida sem tarefa criada nem concluída há **30 dias**. Escolhe a área com nota mais baixa na Roda | "Que tal olhar seu backlog e pensar em algo para a vida financeira?" | Backlog filtrado pela área |
| `volte_ao_app` | Pessoa não abre o app há **3 dias** (e de novo aos 7; depois para) | "Sua vida não para. Que tal ver como está a sua sprint?" | Board |
| `grupo_sugerido` | A cada 30 dias no máximo: um grupo **público** de que a pessoa não participa, ligado às áreas que ela mais usa | "O grupo “Finanças em dia” tem 24 pessoas falando sobre isso. Quer conhecer?" | Página do grupo |
| `algo_bom` | A cada 14 dias no máximo, se a pessoa não postou nada nesse tempo | "Aconteceu algo bom que não estava planejado? Compartilhe com seus amigos." | Novo post |

**Jornada (decisão do dono):** durante a Jornada, os avisos automáticos são **só sobre a Jornada**: nada de alertas, dicas, lembranças nem pesquisas. Sai apenas o `jornada_parada`, quando a pessoa não avança há 2 dias, falando da fase em que ela parou ("Falta pouco para a sua Roda da Vida ficar completa."). Depois da Jornada, as dicas sociais ("grupo" e "algo bom") só saem com a rede social liberada.

### 3.3 "Lembra disso?"

- Quando (decisão do dono: **aleatório**): **no máximo 1 lembrança por semana**, sorteada entre as tarefas concluídas, épicos encerrados e iniciativas concluídas há **pelo menos 30 dias**. Sem preferência por foto. A mesma conquista não é sorteada de novo.
- Texto: "Lembra disso? Há 3 meses você concluiu “Correr 5 km”." Com a foto, quando houver (anexo da tarefa ou foto do post em que ela foi compartilhada).
- Ao tocar, abre uma **folha "Lembra disso?"** com a foto, a área, a data, o épico e a iniciativa, e o botão opcional **"Compartilhar"**.
- No celular a foto aparece no Android (Chrome). No iPhone, o push mostra só o texto; a foto aparece ao abrir.

### 3.4 Novidades (news)

- O admin escreve a novidade: **título**, **versão** (ex.: 1.4), **texto** (com a mesma barra de formatação do necrológio) e **imagem** opcional.
- Ao publicar, todo mundo recebe a notificação "Novidades no Circle of Life". **Por enquanto, só no sino** (decisão do dono): nada abre sozinho e não há tela em Mais. Tocar na notificação abre a folha com as novidades daquela versão.
- **Não vai para quem está na Jornada** (decisão do dono). Quem conclui a Jornada recebe só as novidades publicadas dali em diante.

### 3.5 Pesquisa rápida

- O admin cria a pergunta (ex.: "O que está achando do app?") e o período. Vai para todo mundo **fora da Jornada** (durante a Jornada só saem avisos dela).
- A pessoa responde **com nota de 1 a 5 direto no sino** (5 estrelas na própria notificação) e, se quiser, escreve um comentário curto depois de tocar a nota.
- **Limitação técnica do celular**: a notificação do celular aceita no máximo 2 botões (e o iPhone não mostra nenhum), então não cabem 5 notas. No celular, tocar na notificação abre o app direto na pergunta, com as 5 estrelas.
- Cada pessoa responde **uma vez**. Respondida, a notificação mostra "Obrigado!" e a nota dada.
- Ninguém recebe mais de **1 pesquisa a cada 30 dias**.
- **Responder rende +50 círculos** (decisão do dono), uma vez por pesquisa. O valor entra na tabela `GEMS` de `packages/shared/src/xp.ts` e no extrato (`gem_events`, motivo novo `pesquisa`). O comentário é opcional e não muda o prêmio.
- O admin vê os resultados: número de respostas, média, quantas notas de cada valor e os comentários, e pode **exportar para Excel** (já usamos Excel no backlog).

## 4. Modelo de dados (migrations novas)

> Mudança no modelo de dados: precisa da aprovação do dono antes de cada etapa.

| Tabela / campo | Para quê |
|---|---|
| Novos valores no `NotificationType`: `tarefas_atrasadas`, `epico_sem_proximo`, `epico_vazio`, `area_parada`, `volte_ao_app`, `grupo_sugerido`, `algo_bom`, `jornada_parada` (se aprovado), `lembranca`, `novidade`, `pesquisa` | Os novos tipos. A categoria de cada tipo fica numa tabela única em `packages/shared/src/notifications.ts`, junto com os limites (como o XP fica em `xp.ts`) |
| Campo `imageFileId` em `notifications` | A foto do "Lembra disso?" |
| Tabela **`notification_prefs`** (uma linha por pessoa) | Liga/desliga por categoria (sino e celular), quantidade (Pouco, Normal, Mais) e horário de silêncio. Sem linha = padrão |
| Tabela **`notification_log`** (pessoa, tipo, chave, categoria, data) | Guarda o que já foi mandado: garante "não repetir" e conta os limites, mesmo se a pessoa limpar o sino. Apagada depois de 1 ano |
| Tabela **`releases`** (versão, título, texto, imagem, quem publicou, quando) | Novidades |
| Novo motivo `pesquisa` no extrato de círculos (`GemReason`) | Os +50 círculos da pesquisa |
| Tabelas **`surveys`** (pergunta, público, início, fim, quem criou) e **`survey_responses`** (pesquisa, pessoa, nota 1–5, comentário, data; uma por pessoa) | Pesquisas e respostas para análise |

A **tarefa atrasada** deixa de usar o campo `overdueNotifiedAt` da tarefa e passa a usar o `notification_log`. O campo fica até a migração terminar e depois sai.

## 5. Tarefas agendadas

Tudo entra na **mesma rotina** que já existe (`hourly()` local e `/api/cron/daily` na Vercel), sem agendador novo:

1. Para cada pessoa (em lotes), calcula os **candidatos** do dia: alertas, lembranças e dicas.
2. Aplica as **preferências**, a **Jornada**, o **não repetir** e o **limite**, na ordem de prioridade.
3. Cria os avisos do sino e manda para o celular só se estiver fora do horário de silêncio dela.
4. Localmente, como roda de hora em hora, cada pessoa é processada **uma vez por dia**, na primeira rodada depois das 8h no fuso dela (mesma regra das atrasadas hoje).

Novidades e pesquisas **não** esperam o agendamento: saem na hora em que o admin publica (em lotes, para não estourar o tempo da Vercel).

Os avisos de **Atividade** continuam saindo na hora, como hoje, passando só pelo filtro de preferência e silêncio.

## 6. O que vai para o celular e o que fica só no app

| | Sino | Celular |
|---|---|---|
| Atividade | Sempre | Sim, se ligado e fora do silêncio (curtidas agrupadas) |
| Alertas | Sempre | Sim, se ligado e fora do silêncio |
| Dicas | Se a pessoa não desligou | Sim, se ligado e fora do silêncio |
| Lembranças | Se a pessoa não desligou | Sim, com foto no Android |
| Novidades | Sempre (só no sino, nada abre sozinho) | Sim, se ligado |
| Pesquisas | Sim, com as 5 estrelas | Sim, mas abre o app para responder |
| Pedido para ligar o celular | Só no app (um cartão, uma vez, depois da Jornada) | Não |

Hoje muita gente pode nem ter ligado o celular, e as dicas só funcionam bem por lá. Por isso a proposta inclui um **convite para ligar as notificações**, mostrado **uma vez** depois de concluir a Jornada (e de novo no máximo a cada 60 dias se a pessoa disser "agora não").

## 7. Telas

- **Sino**: separa em **Para você** (Alertas, Dicas, Lembranças, Novidades, Pesquisas) e **Atividade** (o que os outros fizeram). Pesquisa com as estrelas na própria notificação; lembrança com miniatura da foto.
- **Configurações → Notificações** (nova seção):
  - Liga/desliga do celular **neste aparelho** (já existe).
  - Para cada categoria: "Receber" e "No celular".
  - Quantidade: Pouco / Normal / Mais (com a explicação "até 2 avisos por dia e 6 por semana").
  - Horário de silêncio: de __ às __.
- **Folha "Lembra disso?"**: foto, detalhes e "Compartilhar".
- **Novidades**: folha que abre ao tocar na notificação (sem abrir sozinha e sem tela em Mais, por enquanto).
- **Admin** (junto de Convites, só para administradores): **Novidades** (escrever, pré-visualizar, publicar) e **Pesquisas** (criar, encerrar, ver resultados, exportar).

## 8. Ordem de implementação (etapas pequenas)

Cada etapa termina com testes automáticos, atualização de `docs/regras-de-negocio.md` (RN-NOT) e `docs/manual-funcionalidades.md`, e aprovação do dono antes da seguinte.

1. **Base**: categorias, `notification_prefs`, `notification_log`, limites, não repetir, horário de silêncio e a seção de Configurações. Tarefa atrasada vira resumo diário. Curtidas agrupadas no celular.
2. **Alertas de épico**: épico concluído sem próximo passo e épico vazio.
3. **Dicas e Jornada**: área parada, volte ao app, "aconteceu algo bom?", grupo sugerido e o aviso `jornada_parada`. Convite para ligar o celular.
4. **"Lembra disso?"**: sorteio semanal, foto na notificação, foto no push e a folha.
5. **Novidades**: tela do admin, notificação e a folha que abre pelo sino.
6. **Pesquisa rápida**: tela do admin, estrelas no sino, resposta pelo celular, +50 círculos e resultados com exportação.
7. **Sino em duas abas** (Para você / Atividade), quando já houver os tipos novos para separar.

## 9. Decisões do dono (07/11/2026)

1. **Limite padrão**: 2 por dia e 6 por semana. Aprovado.
2. **Horário**: avisos **das 8h às 22h**. Na Vercel, os automáticos saem às 8h; os de Atividade, na hora, dentro dessa janela. A pessoa não escolhe o horário.
3. **Jornada**: durante a Jornada, **só avisos sobre a Jornada** (`jornada_parada`).
4. **Tarefa atrasada**: vira **um resumo por dia**.
5. **"Lembra disso?"**: **aleatório**, no máximo 1 por semana, entre conquistas de pelo menos 30 dias.
6. **Pesquisa**: responder rende **+50 círculos**; comentário opcional.
7. **Novidades**: **só no sino**, por enquanto (nada abre sozinho), e **não vão para quem está na Jornada**.
8. **Silêncio**: padrão **22h às 8h**.
