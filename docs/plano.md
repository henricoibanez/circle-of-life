# Plano de construção — Circle of Life

Este documento descreve **como** o app será construído: arquitetura, modelo de dados, endpoints da API, estrutura de pastas e a ordem das etapas. O **porquê** e as regras gerais estão no [CLAUDE.md](../CLAUDE.md). A referência de visual e comportamento é `referencia/prototipo/circle-of-life.html`, com as mudanças listadas no CLAUDE.md em "Diferenças em relação ao protótipo".

> Status: **versão 5, com todas as respostas do dono incorporadas**. Etapa 0 concluída em 24/10/2026; próxima: etapa 1 (aguardando aprovação).

---

## 1. Visão geral da arquitetura

```
 Navegador / app instalado no celular (PWA)
    │  só fala com o endereço do web (localhost:3000 / app.dominio.com)
    ▼
 apps/web  (Next.js)
    │  /api/*  → repassado ao Nest (rewrite do Next)
    ▼
 apps/api  (Nest.js) ──► Postgres (Prisma)
    │                ──► Storage S3 (gera URLs pré-assinadas)
    │                ──► SMTP (Mailpit local)
    │                ──► IA (simulada ou Claude)
    │                ──► Web Push (só se as chaves VAPID existirem)
    │                ──► tarefas agendadas (ex.: checar tarefas atrasadas)
    ▼
 O navegador envia/baixa arquivos direto do Storage S3 usando a URL pré-assinada
```

Em palavras simples:

- O navegador **só conversa com o site** (web). Quando a tela precisa de dados, ela chama `/api/...` no próprio site, e o Next repassa o pedido para a API. Assim o cookie de login funciona igual no computador local e na produção, sem configurar CORS. O endereço da API vem da variável `API_INTERNAL_URL`.
- Para **arquivos**, a API só dá uma "autorização temporária" (URL pré-assinada, válida por poucos minutos). O navegador envia a foto direto para o storage. A API guarda apenas a referência do arquivo.
- **Regras de negócio ficam na API** (XP, sprint, compra de trilha, visibilidade, notificações). O web só mostra e envia ações.

### App de celular (PWA)

- O web tem um **manifesto** (nome, ícone, cores) e um **service worker** (um pequeno programa que roda no fundo do navegador). Com isso, a pessoa pode "Adicionar à tela inicial" e o app abre em tela cheia, como um app comum.
- **Notificações no celular** usam o padrão **Web Push**: a pessoa autoriza, o navegador gera uma "inscrição" que a API guarda, e a API envia avisos com a biblioteca `web-push` e as chaves `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. No iPhone isso só funciona com o app adicionado à tela inicial (iOS 16.4 ou mais novo).
- Sem as chaves VAPID (o normal no ambiente local), o push fica desligado e as notificações aparecem só no sino.

### Login, convites e sessão

1. **Acesso por convite**: só entra quem tem convite ou já tem conta. **Só administradores criam convites.** Um convite é um link enviado por e-mail (`/convite/{token}`). Ao abrir o link, a pessoa entra com Google (ou, em desenvolvimento, já fica liberada) e a conta é criada. Variável `SIGNUP_MODE=invite` (no futuro, `open` libera o cadastro para todos).
   - O convite vale para o e-mail digitado pelo admin: a pessoa precisa entrar com a conta Google desse mesmo e-mail.
   - Participantes comuns não convidam nesta versão.
2. **Google**: o botão leva a `/api/auth/google` → Google → volta em `/api/auth/google/callback`. O Nest (Passport, estratégia Google) encontra o usuário pelo ID Google ou pelo e-mail. Se o e-mail não tem conta nem convite válido, mostra "Acesso só por convite".
3. A API cria um **JWT** (validade configurável, padrão 30 dias) e grava no cookie `col_session` com `httpOnly`, `SameSite=Lax`, `Secure` em produção, `Path=/`. Domínio do cookie opcional por `COOKIE_DOMAIN`.
4. Toda rota protegida lê o cookie (estratégia JWT do Passport) e carrega o usuário.
5. **Sair**: `POST /api/auth/logout` apaga o cookie.
6. **Login de desenvolvimento**: o módulo `DevAuthModule` só é **registrado** quando `NODE_ENV=development`. Ele expõe `GET /api/auth/dev/users` e `POST /api/auth/dev/login`. Fora de desenvolvimento essas rotas não existem (404).
7. O login é organizado em "provedores" (Google, desenvolvimento) para que, no futuro, seja fácil acrescentar cadastro com e-mail e senha.

### Storage (S3)

- SDK `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, configurado só por variáveis: `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.
- `S3_PUBLIC_ENDPOINT` é o endereço do storage que o **navegador** usa (as URLs pré-assinadas são geradas com ele). No `pnpm dev` ele é igual ao `S3_ENDPOINT` (`http://localhost:8333`); no `docker-compose` a API usa o nome interno do serviço e o navegador usa `localhost`.
- Storage local: **SeaweedFS** (o MinIO deixou de publicar versões gratuitas em 2025).
- Fluxo de envio: `POST /api/uploads` (tipo, tamanho, finalidade) → API valida (só imagens, limite de tamanho por finalidade), cria o registro `File` como `pending` e devolve a URL de envio → navegador faz `PUT` direto → `POST /api/uploads/:id/confirm` → API confere que o arquivo existe e marca `ready`.
- Leitura: bucket **privado**; a API devolve URLs de leitura pré-assinadas de curta duração junto com os dados.
- As imagens são reduzidas no navegador antes do envio (como o protótipo faz: ~900 px, JPEG).
- Ao iniciar, o script de desenvolvimento (e o `docker-compose`) cria o bucket e configura o CORS automaticamente.

### Rodar localmente sem Docker

- `pnpm setup:local` baixa, uma vez, para `.local/bin/` (fora do git), com versões fixas e conferência do arquivo:
  - **SeaweedFS** para Windows (`weed.exe`, ~46 MB), do GitHub `seaweedfs/seaweedfs`;
  - **Mailpit** para Windows (`mailpit.exe`, ~10 MB), do GitHub `axllent/mailpit`.
- O **PostgreSQL** vem pelo pacote npm `embedded-postgres` (binários oficiais do Postgres 17, a mesma versão principal do Supabase, ~105 MB), instalado junto com as outras bibliotecas.
- `pnpm dev` roda um pequeno orquestrador (`scripts/dev.ts`) que: inicia o Postgres (dados em `.local/postgres`), o SeaweedFS (dados em `.local/storage`) e o Mailpit; espera cada um responder; aplica as migrations; e então inicia a API e o web, com os registros de cada um identificados por cor. `Ctrl+C` desliga tudo.
- Os endereços e senhas locais vêm do `.env` (copiado do `.env.example`), como em qualquer ambiente.

### E-mail

`nodemailer` por SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Local: Mailpit. Usos: convite de acesso, convite de amizade, aviso de solicitação de amizade. Modelos em português.

### Notificações

- Toda notificação é gravada no banco (aparece no sino) e, se a pessoa ativou e o push está configurado, também vai para o celular.
- Tipos: pedido de amizade recebido, amizade aceita, curtida (post ou story), comentário, tarefa atrasada, alguém baixou sua trilha (+10 XP), trilha aprovada ou recusada, alguém entrou no seu grupo, nova trilha no grupo. Só para administradores: trilha aguardando aprovação.
- Curtidas no mesmo post são agrupadas ("Julia e mais 3 pessoas curtiram…") para não lotar o sino.
- **Tarefas atrasadas**: uma tarefa agendada na API (`@nestjs/schedule`) roda todo dia de manhã (horário configurável, fuso da pessoa) e avisa uma vez por tarefa no dia seguinte ao prazo vencido.
- Na tela de configurações a pessoa liga/desliga o push do celular.

### IA (Análise inteligente)

- Interface `AiProvider` com duas implementações escolhidas por `AI_MODE`:
  - `mock`: devolve um relatório realista montado a partir dos dados reais do usuário, com pequeno atraso simulado. Nenhuma chamada externa.
  - `anthropic`: chama a API do Claude (`ANTHROPIC_API_KEY`, `AI_MODEL`, padrão `claude-sonnet-5-5`) e valida a resposta em JSON.
- A pessoa escolhe **quais fontes** entram (Necrológio, Roda, Pirâmide, Quadro, Tarefas); só essas são enviadas.
- A resposta traz índice de alinhamento, análise por área, insights e **1 a 3 trilhas sugeridas** (iniciativa → épicos → tarefas). A pessoa vê cada cascata, pode desmarcar itens e importa para o backlog.
- Limite de frequência por usuário (ex.: 1 relatório a cada 5 minutos).

### XP

- Extrato (`XpEvent`) com cada ganho (+), estorno (−) e gasto (−). Ganho soma em `xpTotal` (e, portanto, no disponível); estorno tira de `xpTotal`; gasto soma em `xpSpent`. **XP disponível = xpTotal − xpSpent**, nunca negativo.
- Cada ação só rende XP uma vez enquanto estiver valendo (concluir, reabrir e concluir de novo a mesma tarefa não acumula).
- Post, story e comentário: só o **primeiro do dia** (fuso da pessoa) rende XP (+10, +10, +5). Apagar esse post não devolve a chance de ganhar de novo no mesmo dia.
- Concluir iniciativa: +100 XP só se ela tiver **mais de 5 tarefas concluídas** (6 ou mais); com menos, conclui sem XP. Reabrir a iniciativa estorna os 100.
- **Regras provisórias**: o dono vai definir a regra definitiva de XP depois. Toda regra fica num único `XpService` na API e numa única tabela em `packages/shared/src/xp.ts`, para que a troca seja feita em um só lugar.
- +10 XP por download de trilha: conta **uma vez por pessoa que baixou** e não conta quando o próprio autor importa. O preço de uma trilha paga só é debitado do comprador; **não vai para o autor**.

---

## 2. Estrutura de pastas

```
CircleOfLife/
├── CLAUDE.md
├── docs/
│   ├── plano.md                  ← este arquivo
│   └── deploy.md                 ← (última etapa) como publicar em produção
├── referencia/                   ← material de referência (não alterar)
├── docker-compose.yml            ← alternativa com Docker: web, api, postgres, seaweedfs, mailpit (não testável no PC do dono)
├── scripts/
│   ├── setup-local.ts            ← baixa SeaweedFS e Mailpit para .local/bin
│   └── dev.ts                    ← `pnpm dev`: sobe banco, storage, e-mail, api e web
├── .local/                       ← programas e dados locais (fora do git)
├── .env.example
├── package.json                  ← scripts do monorepo
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   └── shared/
│       └── src/
│           ├── areas.ts          ← 10 áreas (id, nome, ícone, cor, perguntas, slogan, ilustração)
│           ├── maslow.ts         ← níveis e itens da pirâmide
│           ├── xp.ts             ← tabela de XP
│           ├── palettes.ts       ← 6 paletas
│           ├── info.ts           ← textos dos botões "i"
│           └── types.ts          ← tipos das respostas da API
├── apps/
│   ├── api/
│   │   ├── Dockerfile            ← imagem de produção
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── main.ts, app.module.ts
│   │   │   ├── config/           ← leitura e validação das variáveis de ambiente
│   │   │   ├── prisma/
│   │   │   ├── common/           ← guards, decorators, filtros de erro
│   │   │   ├── auth/             ← Google, JWT em cookie, logout
│   │   │   ├── dev-auth/         ← login de teste (só development)
│   │   │   ├── invites/          ← convites de acesso
│   │   │   ├── users/            ← perfil, preferências
│   │   │   ├── uploads/
│   │   │   ├── mail/
│   │   │   ├── notifications/    ← sino, push, tarefa agendada de atrasadas
│   │   │   ├── initiatives/, epics/, tasks/, sprints/
│   │   │   ├── xp/               ← extrato, total e disponível, atividade recente
│   │   │   ├── roda/, maslow/, necrologio/, dreams/
│   │   │   ├── reports/
│   │   │   ├── trilhas/          ← publicar, loja, comprar, importar
│   │   │   ├── social/           ← amizades
│   │   │   ├── groups/
│   │   │   ├── feed/             ← posts, curtidas, comentários, salvos
│   │   │   ├── stories/          ← (depende da pergunta Q1)
│   │   │   ├── analysis/         ← provedores mock/anthropic
│   │   │   └── health/
│   │   └── test/
│   └── web/
│       ├── Dockerfile
│       ├── .env.example
│       ├── next.config.ts        ← rewrite /api/* → API_INTERNAL_URL
│       ├── components.json       ← shadcn/ui
│       ├── public/               ← ícones do app, manifest
│       └── src/
│           ├── app/
│           │   ├── layout.tsx, globals.css   ← tokens do protótipo (claro/escuro, 6 paletas)
│           │   ├── sw.ts                     ← service worker (push)
│           │   ├── login/page.tsx
│           │   ├── convite/[token]/page.tsx
│           │   └── (app)/                    ← área logada, com barra inferior
│           │       ├── feed/, board/, backlog/, mais/, notificacoes/
│           │       ├── necrologio/, roda/, maslow/, quadro/
│           │       ├── analise/, relatorios/, loja/
│           │       ├── grupos/, grupos/[id]/
│           │       ├── perfil/
│           │       └── admin/convites/       ← só administradores
│           ├── components/
│           │   ├── ui/           ← shadcn com o tema do protótipo
│           │   ├── icons/, art/  ← SVGs do protótipo
│           │   ├── sheets/       ← folhas: tarefa, épico, iniciativa, sprint, sonho, post, publicar trilha…
│           │   └── …             ← Ring, Bar, Radar, AreaIcon, Avatar, Chips, Seg…
│           ├── lib/              ← cliente da API, upload, formatação pt-BR, push
│           └── hooks/
└── (mais tarde) .github/workflows/
```

Bibliotecas principais previstas (versões estáveis mais recentes na etapa 0): pnpm (ativado pelo Corepack do Node), Node 24 LTS (já instalado no PC do dono), embedded-postgres, Next.js, React, Tailwind, shadcn/ui, TanStack Query, Serwist (service worker do PWA), Nest.js, `@nestjs/schedule`, Prisma, Passport (`passport-google-oauth20`, `passport-jwt`), class-validator, sanitize-html, nodemailer, web-push, AWS SDK v3, SDK da Anthropic, Vitest/Jest e Playwright. Fontes via `@fontsource` (servidas localmente).

---

## 3. Modelo de dados (Prisma)

Convenções: ids `cuid`, datas em UTC (`createdAt`, `updatedAt`), exclusão em cascata a partir do usuário. Áreas da vida guardadas como enum `Area`.

### Enums

```prisma
enum Area { lazer amor financas familia intelectual espiritualidade sociedade saude emocional profissional }
enum TaskStatus { backlog todo doing done }
enum Priority { alta media baixa }
enum ThemeMode { auto light dark }
enum Palette { natureza serenity soft dourado mindful premium }
enum UserRole { member admin }
enum Visibility { publico amigos privado }          // "Todo mundo", "Somente amigos", "Privado"
enum InitiativeSource { manual trilha ia duplicada }
enum FilePurpose { avatar dream task post story group trilha }
enum FileStatus { pending ready }
enum XpReason { task check epic iniciativa sprint roda sonho post story comentario trilha_download trilha_compra }
enum PostKind { post conquista }
enum FriendshipStatus { pending accepted }
enum GroupRole { admin member }
enum TrilhaStatus { pendente aprovada recusada despublicada }
enum NotificationType { amizade_pedido amizade_aceita curtida curtida_story comentario tarefa_atrasada trilha_baixada trilha_aprovada trilha_recusada trilha_pendente grupo_entrada grupo_trilha }
enum AiMode { mock anthropic }
```

### Usuário, convites e preferências

```prisma
model User {
  id                    String     @id @default(cuid())
  email                 String     @unique
  googleId              String?    @unique
  role                  UserRole   @default(member)
  name                  String
  handle                String     @unique          // "ID: @henricoibanez"
  bio                   String     @default("")
  photoFileId           String?    @unique
  palette               Palette    @default(natureza)
  randomTheme           Boolean    @default(false)
  themeMode             ThemeMode  @default(auto)
  defaultPostVisibility Visibility @default(publico)   // vale para posts e stories
  timezone              String     @default("America/Sao_Paulo")
  xpTotal               Int        @default(0)      // cópia rápida da soma do extrato
  xpSpent               Int        @default(0)      // gasto em trilhas
  isTestUser            Boolean    @default(false)
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
}

model Invite {
  id          String    @id @default(cuid())
  email       String
  token       String    @unique
  invitedById String
  expiresAt   DateTime
  acceptedAt  DateTime?
  acceptedUserId String?
  createdAt   DateTime  @default(now())
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}
```

### Backlog e sprints

```prisma
model Initiative {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String   @default("")
  areas       Area[]
  isMaster    Boolean  @default(false)
  source      InitiativeSource @default(manual)
  trilhaId    String?                        // se veio de uma trilha (loja, grupo)
  completedAt DateTime?                      // concluída (todos os épicos encerrados) = conquista
  position    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Epic {
  id           String    @id @default(cuid())
  userId       String
  initiativeId String
  title        String
  description  String    @default("")
  area         Area
  closedAt     DateTime?
  position     Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Task {
  id          String     @id @default(cuid())
  userId      String
  epicId      String
  title       String
  description String     @default("")
  status      TaskStatus @default(backlog)
  priority    Priority   @default(media)
  dueDate     DateTime?  @db.Date
  doneAt      DateTime?
  archivedAt  DateTime?                      // saiu do quadro ao encerrar a sprint
  sprintId    String?
  overdueNotifiedAt DateTime?                // já avisou que está atrasada
  position    Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@index([userId, status])
}

model ChecklistItem  { id String @id @default(cuid()); taskId String; text String; done Boolean @default(false); position Int @default(0) }
model TaskAttachment { id String @id @default(cuid()); taskId String; fileId String @unique; createdAt DateTime @default(now()) }
model TaskLog        { id String @id @default(cuid()); taskId String; text String; createdAt DateTime @default(now()) }

model Sprint {
  id         String    @id @default(cuid())
  userId     String
  number     Int
  startAt    DateTime
  plannedEnd DateTime                         // startAt + 13 dias
  closedAt   DateTime?                        // nulo = sprint em andamento
  doneCount  Int?
  totalCount Int?
  @@unique([userId, number])
}
```

**Duplicar**: cópia com o título "(cópia)", tudo volta para o backlog, checklist desmarcado, sem anexos nem histórico. Duplicar iniciativa copia épicos e tarefas; duplicar épico copia as tarefas.

### XP e atividade

```prisma
model XpEvent {
  id        String   @id @default(cuid())
  userId    String
  amount    Int                                // +10, -10, -300 (compra)…
  reason    XpReason
  refId     String?                            // tarefa, épico, trilha… que gerou o lançamento
  createdAt DateTime @default(now())
}

model ActivityEvent {                          // "Atividade recente" do perfil
  id        String   @id @default(cuid())
  userId    String
  icon      String
  text      String
  link      String
  createdAt DateTime @default(now())
}
```

### Exercícios de reflexão

```prisma
model RodaScore    { userId String; area Area; score Int; updatedAt DateTime @updatedAt; @@id([userId, area]) }
model RodaSnapshot { id String @id @default(cuid()); userId String; scores Json; createdAt DateTime @default(now()) }

model MaslowCheck { userId String; itemKey String; checkedAt DateTime @default(now()); @@id([userId, itemKey]) }
model MaslowNote  { id String @id @default(cuid()); userId String; level String; text String; createdAt DateTime @default(now()) }

model Necrologio { userId String @id; html String @default(""); updatedAt DateTime @updatedAt }   // só o texto, sem seções

model Dream {
  id          String    @id @default(cuid())
  userId      String
  text        String
  area        Area
  imageFileId String?   @unique
  doneAt      DateTime?
  position    Int       @default(0)
  createdAt   DateTime  @default(now())
}
```

O "nível atual" da pirâmide é calculado: o nível mais alto em que todos os níveis abaixo estão pelo menos [regra a definir na etapa 9, sugestão: 70%] atendidos.

### Arquivos

```prisma
model File {
  id        String      @id @default(cuid())
  userId    String
  key       String      @unique               // users/{userId}/{purpose}/{id}.jpg
  mime      String
  size      Int
  purpose   FilePurpose
  status    FileStatus  @default(pending)
  createdAt DateTime    @default(now())
}
```

### Trilhas

Uma trilha publicada é uma **cópia congelada** da iniciativa no momento da publicação. Mudanças posteriores no backlog do autor não alteram a trilha; para atualizar, ele publica de novo (nova versão).

```prisma
model Trilha {
  id               String       @id @default(cuid())
  authorId         String?                         // nulo = trilha oficial do seed
  sourceInitiativeId String?
  title            String
  description      String
  category         String                          // relacionamento, financeira, saude, pessoal, hobbies, espiritualidade, estudos
  areas            Area[]
  coverFileId      String?      @unique            // ou ilustração do protótipo:
  art              String?
  color            String?
  priceXp          Int          @default(0)        // 0 = grátis
  status           TrilhaStatus @default(pendente)  // toda publicação passa pela aprovação de um admin
  reviewedById     String?
  reviewedAt       DateTime?
  rejectionReason  String?                          // motivo opcional mostrado ao autor
  version          Int          @default(1)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}
model TrilhaEpic { id String @id @default(cuid()); trilhaId String; title String; area Area; position Int }
model TrilhaTask { id String @id @default(cuid()); trilhaEpicId String; title String; position Int }
model TrilhaFavorite { userId String; trilhaId String; @@id([userId, trilhaId]) }
model TrilhaAcquisition {                         // compra ou download grátis; dá direito a importar de novo
  userId    String
  trilhaId  String
  xpPaid    Int      @default(0)
  createdAt DateTime @default(now())
  @@id([userId, trilhaId])
}
model TrilhaImport { id String @id @default(cuid()); userId String; trilhaId String; initiativeId String; createdAt DateTime @default(now()) }
```

As 8 trilhas do protótipo entram pelo seed como trilhas oficiais, grátis e já aprovadas. Publicar de novo (nova versão) também volta para "pendente"; enquanto isso, a versão aprovada anterior continua na loja.

### Social

```prisma
model Friendship {
  id          String   @id @default(cuid())
  requesterId String
  addresseeId String?
  inviteEmail String?
  status      FriendshipStatus @default(pending)
  createdAt   DateTime @default(now())
  acceptedAt  DateTime?
}

model Group {
  id          String   @id @default(cuid())
  name        String
  description String
  area        Area
  icon        String
  coverFileId String?  @unique
  art         String?
  createdById String
  createdAt   DateTime @default(now())
}
model GroupMember { groupId String; userId String; role GroupRole @default(member); joinedAt DateTime @default(now()); @@id([groupId, userId]) }
model GroupTrilha { groupId String; trilhaId String; addedById String; addedAt DateTime @default(now()); @@id([groupId, trilhaId]) }

model Post {
  id         String     @id @default(cuid())
  authorId   String
  kind       PostKind   @default(post)
  title      String     @default("")
  text       String
  area       Area?
  groupId    String?                           // post de grupo: visível para os membros
  visibility Visibility                        // vem da configuração padrão; pode mudar no post
  tags       String[]
  xpShown    Int?                              // "+10 XP" quando vem de uma conclusão
  taskId     String?                           // tarefa que originou o post
  createdAt  DateTime   @default(now())
}
model PostMedia { id String @id @default(cuid()); postId String; fileId String @unique; position Int }
model PostLike  { postId String; userId String; createdAt DateTime @default(now()); @@id([postId, userId]) }
model PostSave  { postId String; userId String; createdAt DateTime @default(now()); @@id([postId, userId]) }
model Comment   { id String @id @default(cuid()); postId String; authorId String; text String; createdAt DateTime @default(now()) }

model Story {
  id         String     @id @default(cuid())
  authorId   String
  fileId     String     @unique                // a foto
  areas      Area[]                            // de 1 a 3 áreas; ícones viram marca d'água
  caption    String     @default("")           // legenda curta (até 150 caracteres)
  visibility Visibility
  expiresAt  DateTime                          // createdAt + 24 horas
  createdAt  DateTime   @default(now())
}
model StoryLike { storyId String; userId String; createdAt DateTime @default(now()); @@id([storyId, userId]) }
model StoryView { storyId String; userId String; viewedAt DateTime @default(now()); @@id([storyId, userId]) }   // "Visto por" (só o autor vê)
```

Stories expirados somem do app e a foto é apagada do storage por uma limpeza periódica.

Quem vê um post: `publico` = todos os usuários do app; `amigos` = amigos do autor; `privado` = só o autor. Post em grupo = membros do grupo.

### Notificações

```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  body      String
  link      String                             // tela de destino
  actorId   String?                            // quem causou (curtiu, comentou…)
  refId     String?
  readAt    DateTime?
  createdAt DateTime         @default(now())
  @@index([userId, readAt])
}
```

"Limpar" apaga as notificações; notificações com mais de 90 dias são apagadas automaticamente.

### Análise inteligente

```prisma
model AnalysisReport {
  id          String   @id @default(cuid())
  userId      String
  mode        AiMode
  sources     String[]                          // fontes escolhidas
  geral       Int
  visao       String
  areas       Json                              // [{ area, pct, tag, texto }]
  insights    Json                              // [{ icon, titulo, texto }]
  suggestions Json                              // [{ iniciativa: {titulo, descricao, areas}, epicos: [{ titulo, area, tarefas: [titulo] }] }]
  imported    Json     @default("[]")           // o que já foi importado
  createdAt   DateTime @default(now())
}
```

---

## 4. Endpoints da API

Todos com prefixo `/api`, respostas em JSON, mensagens de erro em português. Todos exigem login, exceto os marcados como públicos. Listas que podem crescer usam paginação por cursor (`?cursor=&limit=`).

### Sistema, autenticação e convites

| Método | Rota | O que faz |
|---|---|---|
| GET | `/health` | Público. Verifica API, banco e storage. |
| GET | `/auth/providers` | Público. Quais formas de login estão disponíveis. |
| GET | `/auth/google` | Público. Inicia o login com Google (aceita `?invite=token`). |
| GET | `/auth/google/callback` | Público. Retorno do Google; confere conta ou convite; grava o cookie. |
| POST | `/auth/logout` | Sai da conta. |
| GET | `/auth/dev/users` | **Só development.** Lista usuários de teste. |
| POST | `/auth/dev/login` | **Só development.** Entra como um usuário de teste. |
| GET | `/invites/check/:token` | Público. Valida o convite e mostra para qual e-mail é. |
| GET | `/invites` | **Admin.** Convites enviados. |
| POST | `/invites` | **Admin.** `{ email }` → cria convite e envia e-mail. |
| DELETE | `/invites/:id` | **Admin.** Cancela convite não usado. |
| POST | `/invites/:id/resend` | **Admin.** Reenvia o e-mail do convite. |

### Usuário, perfil, XP

| Método | Rota | O que faz |
|---|---|---|
| GET | `/me` | Perfil, preferências, XP total e disponível, sprint atual, notificações não lidas. |
| PATCH | `/me` | Nome, handle, bio, foto. |
| PATCH | `/me/preferences` | Tema, aparência, visibilidade padrão dos posts e stories. |
| GET | `/me/usage` | Uso das ferramentas. |
| GET | `/me/activity` | Atividade recente. |
| GET | `/me/xp` | Extrato de XP. |
| DELETE | `/me` | Exclui a conta e todos os dados. |

### Arquivos

| Método | Rota | O que faz |
|---|---|---|
| POST | `/uploads` | `{ purpose, mime, size }` → `{ fileId, uploadUrl }`. |
| POST | `/uploads/:id/confirm` | Confirma o envio. |
| DELETE | `/uploads/:id` | Remove arquivo. |

### Notificações e push

| Método | Rota | O que faz |
|---|---|---|
| GET | `/notifications` | Lista (mais recentes primeiro). |
| GET | `/notifications/unread-count` | Número do sino. |
| POST | `/notifications/:id/read` | Marca uma como lida. |
| POST | `/notifications/:id/unread` | Marca como não lida. |
| POST | `/notifications/read-all` | Marca todas como lidas. |
| DELETE | `/notifications/:id` | Apaga uma. |
| DELETE | `/notifications` | Limpa todas. |
| GET | `/push/public-key` | Chave pública VAPID (ou "desligado"). |
| POST | `/push/subscriptions` | Ativa o push neste aparelho. |
| DELETE | `/push/subscriptions` | Desativa neste aparelho. |

### Backlog

| Método | Rota | O que faz |
|---|---|---|
| GET | `/backlog` | Árvore iniciativas → épicos → tarefas, com progresso. Filtros `?area=&q=`. |
| POST / PATCH / DELETE | `/initiatives`, `/initiatives/:id` | Criar, editar, excluir iniciativa. |
| POST | `/initiatives/:id/duplicate` | Duplicar com épicos e tarefas. |
| POST | `/initiatives/:id/complete` | Concluir (todos os épicos encerrados) → conquista, celebração; +100 XP se tiver mais de 5 tarefas concluídas. |
| POST | `/initiatives/:id/reopen` | Reabrir iniciativa concluída. |
| POST / PATCH / DELETE | `/epics`, `/epics/:id` | Criar, editar (inclusive mover), excluir épico. |
| POST | `/epics/:id/duplicate` | Duplicar com tarefas. |
| POST | `/epics/:id/close` | Encerrar (todas prontas) → +50 XP, celebração. |
| POST | `/epics/:id/reopen` | Reabrir (tira os 50 XP). |
| GET | `/tasks` | `?status=backlog|sprint|done&area=&q=`. |
| GET | `/tasks/overdue` | Tarefas atrasadas (aviso do Board). |
| GET / POST / PATCH / DELETE | `/tasks/:id`, `/tasks` | Detalhe, criar, editar, excluir. |
| POST | `/tasks/:id/duplicate` | Duplicar. |
| POST | `/tasks/:id/move` | `{ status, position? }` → histórico, XP; ao concluir, devolve o XP ganho e o rascunho do post para a pergunta "Quer compartilhar?". |
| POST / PATCH / DELETE | `/tasks/:id/checklist[/:itemId]` | Checklist (+2 XP ao concluir item). |
| POST / DELETE | `/tasks/:id/attachments[/:attId]` | Anexos. |

### Sprint e quadro

| Método | Rota | O que faz |
|---|---|---|
| GET | `/sprints/current` | Sprint atual com tarefas do quadro e contagens. |
| GET | `/sprints` | Histórico. |
| POST | `/sprints/current/close` | Encerra a sprint (+100 XP se tudo pronto) e abre a próxima. |

### Exercícios

| Método | Rota | O que faz |
|---|---|---|
| GET | `/roda` | Notas, média, histórico. |
| PUT | `/roda/scores` | Atualiza notas (também usado no "Me ajude a refletir"). |
| POST | `/roda/snapshots` | Registrar avaliação de hoje → +20 XP. |
| GET | `/maslow` | Marcados, percentuais, nível atual, "N de 32 itens", reflexões. |
| PUT | `/maslow/checks/:itemKey` | Marcar/desmarcar. |
| POST / DELETE | `/maslow/notes[/:id]` | Reflexões. |
| GET / PUT | `/necrologio` | Ler e salvar o texto. |
| GET / POST | `/dreams` | Sonhos (máximo 10 abertos). |
| PATCH / DELETE | `/dreams/:id` | Editar, excluir. |
| POST | `/dreams/:id/realize` | Realizei → +30 XP. |
| GET | `/conquistas` | Por área: número de épicos encerrados e iniciativas concluídas. |
| GET | `/conquistas/:area` | Lista dos épicos encerrados e iniciativas concluídas da área. |

### Relatórios e análise

| Método | Rota | O que faz |
|---|---|---|
| GET | `/reports/overview?days=7|30|90` | Concluídas, em andamento, atrasadas, total, taxa, áreas, iniciativas, dia da semana, épicos com mais entregas. |
| GET | `/reports/areas` | Por área. |
| GET | `/reports/evolution` | Média da roda, tarefas por semana, sprints. |
| GET | `/reports/deliveries?from=&to=&area=` | Entregas: data, tarefa, épico, área. |
| GET | `/analysis/latest` | Último relatório (ou exemplo) e fontes disponíveis. |
| POST | `/analysis` | `{ sources: [...] }` → gera relatório. |
| POST | `/analysis/:id/suggestions/:index/import` | Importa a trilha sugerida (com os itens marcados) para o backlog. |

### Loja de trilhas

| Método | Rota | O que faz |
|---|---|---|
| GET | `/trilhas?category=&q=&price=gratis|xp` | Lista com autor, preço, nº de tarefas, downloads, favorita, já adquirida. Usuário comum vê só aprovadas (e as próprias em análise); admin vê também as pendentes, marcadas para aparecer borradas. |
| GET | `/trilhas/:id` | Detalhe com épicos e tarefas. |
| POST | `/initiatives/:id/publish` | Publicar a iniciativa como trilha (título, descrição, categoria, capa, preço em XP) → fica **pendente** e avisa os admins. |
| POST | `/trilhas/:id/approve` | **Admin.** Aprova → aparece na loja; avisa o autor. |
| POST | `/trilhas/:id/reject` | **Admin.** Recusa (com motivo opcional); avisa o autor. |
| PATCH | `/trilhas/:id` | Editar dados da trilha (autor; volta para aprovação). |
| POST | `/trilhas/:id/republish` | Atualizar a trilha a partir da iniciativa (nova versão, volta para aprovação). |
| POST | `/trilhas/:id/unpublish` | Tirar da loja (quem já tem continua com a cópia no backlog). |
| POST | `/trilhas/:id/import` | Adquire (paga o XP se for paga) e importa para o backlog; +10 XP ao autor na primeira vez. |
| PUT / DELETE | `/trilhas/:id/favorite` | Favoritar. |
| GET | `/trilhas/mine` | Minhas trilhas publicadas e adquiridas. |

### Amigos e grupos

| Método | Rota | O que faz |
|---|---|---|
| GET | `/friends` | Amigos, recebidas, enviadas. |
| POST | `/friends/requests` | `{ email }` (ver Q2 para e-mails sem conta). |
| POST | `/friends/requests/:id/accept` | Aceitar. |
| DELETE | `/friends/requests/:id` | Recusar ou cancelar. |
| DELETE | `/friends/:userId` | Remover amigo. |
| GET | `/groups/mine`, `/groups/suggested` | Meus grupos e sugeridos. |
| GET | `/groups/:id` | Detalhe: descrição, membros, trilhas do grupo, posts. |
| POST / PATCH / DELETE | `/groups`, `/groups/:id` | Criar (vira administrador), editar, excluir. |
| POST | `/groups/:id/join` | Entrar. |
| DELETE | `/groups/:id/membership` | Sair. |
| GET | `/groups/:id/members` | Membros. |
| POST / DELETE | `/groups/:id/trilhas[/:trilhaId]` | **Administrador do grupo.** Pôr ou tirar uma trilha aprovada do grupo. |

### Feed e stories

| Método | Rota | O que faz |
|---|---|---|
| GET | `/feed?filter=para|amigos|grupos|seguindo&area=&author=&group=&cursor=` | Posts que a pessoa pode ver. |
| POST | `/posts` | Criar post (+10 XP se for o primeiro do dia). Aceita `taskId` quando vem de uma conclusão. |
| PATCH | `/posts/:id` | Mudar visibilidade ou texto (autor). |
| DELETE | `/posts/:id` | Excluir (autor). |
| PUT / DELETE | `/posts/:id/like`, `/posts/:id/save` | Curtir, salvar. |
| GET / POST | `/posts/:id/comments` | Comentários (+5 XP no primeiro comentário do dia). |
| DELETE | `/posts/:id/comments/:commentId` | Apagar o próprio comentário. |
| GET | `/stories` | Stories ativos (últimas 24h) que a pessoa pode ver, agrupados por autor. Não usa os filtros do feed. |
| POST | `/stories` | `{ fileId, areas (1 a 3), caption?, visibility? }` → +10 XP se for o primeiro do dia. |
| DELETE | `/stories/:id` | Apagar o próprio story. |
| PUT / DELETE | `/stories/:id/like` | Curtir / descurtir (stories não têm comentários). |
| POST | `/stories/:id/view` | Registra que a pessoa viu o story. |
| GET | `/stories/:id/viewers` | **Só o autor.** "Visto por", com quem curtiu marcado. |

---

## 5. Usuários de teste e seed

O seed cria (só para uso local):

- **Henrico Ibanez** (`henrico@teste.local`, administrador): o cenário do protótipo — iniciativas, épicos, tarefas, sprint 12 com histórico, XP, roda com registros anteriores, pirâmide, necrológio, sonhos, posts, amigos, grupos, uma trilha publicada paga em XP.
- **Julia Fernandes**, **Lucas Almeida**, **Tiago Moron**, **Bárbara Sajo**, **Vinícius Lima**: os amigos do protótipo, com posts, notificações e dados próprios.
- **Usuário novo** (`novo@teste.local`): conta vazia, para testar o primeiro uso.
- Um **convite pendente** para testar a tela de convite.
- Os grupos do protótipo e as 8 trilhas oficiais.

O seed pode ser rodado de novo para "zerar" o ambiente local.

---

## 6. Ordem de construção

Do essencial ao menos importante. Cada etapa termina com algo que dá para ver ou testar e **começa só depois da sua aprovação**.

| # | Etapa | Resultado visível para você |
|---|---|---|
| 0 | **Fundação** — monorepo, `pnpm setup:local`, `pnpm dev` (Postgres, SeaweedFS, Mailpit, api, web sem Docker), `docker-compose.yml` alternativo, `.env.example`, health check. | `pnpm dev` sobe tudo; página inicial e `/api/health` respondendo (com banco e storage ok); Mailpit abrindo. |
| 1 | **Banco e seed iniciais** — Prisma, usuários, convites, migration, seed. | Usuários de teste no banco. |
| 2 | **Login e convites** — login de desenvolvimento, Google, cookie, sair, convite por e-mail (só admin), tela "acesso só por convite", tela de convites do admin. | Entrar com um clique; enviar convite e ver o e-mail no Mailpit. |
| 3 | **Casca visual e PWA** — tema do protótipo (claro, escuro, 6 paletas), fontes, ícones, ilustrações, barra inferior, folhas, avisos, tela "Mais", manifesto para instalar no celular. | Navegar com o visual do protótipo; "instalar" o app no celular. |
| 4 | **Backlog** — iniciativas, épicos e tarefas, botão "+", abas, busca, filtro, encerrar épico, concluir iniciativa, **duplicar**. | Montar o backlog completo. |
| 5 | **Quadro e sprint** — Kanban com arrastar, lista, sprint de 14 dias, encerrar, histórico, **aviso de atrasadas**. | Planejar e executar uma sprint. |
| 6 | **XP e celebrações** — extrato, XP total e disponível, atividade recente, folhas de celebração. | Ganhar XP e ver o extrato. |
| 7 | **Detalhe da tarefa e arquivos** — checklist, histórico, storage com URL pré-assinada, anexos. | Anexar foto e vê-la no detalhe da tarefa (arquivo guardado no storage local). |
| 8 | **Roda da Vida** — notas, radar, "Me ajude a refletir" com nota, registrar avaliação. | Exercício completo. |
| 9 | **Pirâmide de Maslow** — itens, percentuais, nível atual, reflexões. | Exercício completo. |
| 10 | **Necrológio** — editor com formatação e salvamento automático. | Escrever e reabrir o texto. |
| 11 | **Quadro de visualização e Minhas conquistas** — sonhos com imagem, "Realizei"; conquistas por área (épicos encerrados, iniciativas concluídas). | Cadastrar e realizar sonhos; ver as conquistas por área. |
| 12 | **Perfil e configurações** — perfil e foto, XP, uso das ferramentas, tema, visibilidade padrão, sair, excluir conta. | Perfil igual ao protótipo, com as mudanças. |
| 13 | **Relatórios** — visão geral, por área, evolução, **entregas**. | Gráficos e lista de entregas. |
| 14 | **Notificações** — sino com todas as ações, push no celular (quando configurado), aviso diário de atrasadas. | Ver notificações chegando e limpar/ler. |
| 15 | **Loja de trilhas** — publicar a partir da iniciativa, aprovação pelo admin (pendentes borradas na loja), grátis ou paga em XP, comprar, importar, +10 XP ao autor, favoritos. | Publicar com um usuário, aprovar como admin e comprar com outro. |
| 16 | **Amigos e grupos** — amizades por e-mail, criar e entrar em grupos, trilhas do grupo (escolhidas pelo administrador do grupo), membros. | Criar grupo, pôr trilha nele. |
| 17 | **Feed** — posts, imagens, curtidas, comentários, salvos, visibilidade, pergunta "Quer compartilhar?" ao concluir tarefa, XP do primeiro post e comentário do dia. | Feed social entre os usuários de teste. |
| 18 | **Stories** — foto de 24 horas com legenda curta, 1 a 3 áreas e marca d'água dos ícones, visualizador, curtidas, "Visto por", XP do primeiro story do dia, limpeza dos expirados. | Publicar um story e curtir com outro usuário. |
| 19 | **Análise inteligente** — escolha de fontes, modo simulado e Claude, trilhas sugeridas importáveis. | Gerar relatório sem internet. |
| 20 | **Preparação para produção** — Dockerfile de produção, revisão de segurança, testes de ponta a ponta, `docs/deploy.md`. | Guia passo a passo de publicação. |

---

## 7. Fora desta versão (registrado para o futuro)

- **Migração do app antigo**: converter usuários e dados do app antigo para este. Por isso não haverá importação/exportação de Excel agora.
- Seções e progresso no necrológio.
- Nível e streak (até existirem regras definidas).
- Publicação na App Store e no Google Play (depois do beta). O app será empacotado a partir do mesmo código web.
- Discussões, desafios e eventos nos grupos; indicador "online".
- Cadastro aberto ao público e outras formas de login.
- Convites feitos por participantes comuns ("Convidar pelo WhatsApp" com pedido de acesso aprovado por um admin).
- Tarefas compartilhadas entre pessoas.

---

## 8. Perguntas pendentes

Nenhuma no momento. Todas as perguntas (P-1 a P-20 e Q1 a Q12) foram respondidas e estão incorporadas acima e no CLAUDE.md. Dúvidas que surgirem durante a construção serão feitas no início da etapa correspondente.
