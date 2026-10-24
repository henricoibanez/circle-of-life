# Como publicar o Circle of Life

Este guia explica, passo a passo, como colocar o app no ar. Ele foi escrito para quem não é programador: cada termo técnico vem explicado na primeira vez que aparece.

> **Situação atual:** o app roda 100% no computador local. Os passos abaixo ainda **não foram executados** de verdade; a imagem Docker da API também não foi testada (o computador do projeto não tem Docker). Faça a primeira publicação com calma, de preferência acompanhado.

## 1. As peças

O app tem três partes que vão para lugares diferentes:

| Peça | O que é | Onde fica em produção |
|---|---|---|
| **Site** (`apps/web`) | As telas que a pessoa usa no celular ou no computador. | **Vercel** |
| **API** (`apps/api`) | O "cérebro": regras de XP, sprints, login, permissões. O site conversa só com ela. | Um **host de contêiner** (um serviço que roda programas empacotados em Docker; por exemplo Render, Railway, Fly.io ou Google Cloud Run). |
| **Banco de dados e arquivos** | Onde ficam os dados (Postgres) e as fotos (storage S3). | **Supabase** (Postgres e Storage) |

Também são necessários: um **servidor de e-mail** (SMTP) para os convites, as **credenciais do Google** para o login e, se quiser a IA de verdade, uma **chave da API do Claude**.

O site repassa tudo que começa com `/api/` para a API. Por isso o navegador só enxerga um endereço (o do site) e o cookie de login funciona sem configuração extra.

## 2. Banco de dados (Supabase Postgres)

1. Crie um projeto no [Supabase](https://supabase.com).
2. Em **Project Settings → Database → Connection string**, copie o endereço no formato `postgresql://...`. Esse é o valor de `DATABASE_URL`.
   - Use a conexão **direta** (porta 5432) ou a do *session pooler*. A do *transaction pooler* (porta 6543) não funciona bem com as migrations.
3. Não é preciso criar tabelas: a API cria e atualiza tudo sozinha ao iniciar (comando `prisma migrate deploy`, que aplica as "migrations", isto é, os passos de mudança do banco guardados em `apps/api/prisma/migrations`).

**Nunca rode o seed em produção.** O seed apaga e recria os usuários de teste; ele só existe para o ambiente local.

## 3. Arquivos (Supabase Storage via S3)

1. No Supabase, em **Storage**, crie um bucket **privado** (por exemplo `circle-of-life`).
2. Em **Project Settings → Storage → S3 Connection**, ative o acesso S3 e crie uma chave de acesso.
3. Anote:
   - `S3_ENDPOINT` e `S3_PUBLIC_ENDPOINT`: o endereço "Endpoint" mostrado (os dois iguais).
   - `S3_REGION`: a região mostrada.
   - `S3_BUCKET`: o nome do bucket.
   - `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`: a chave criada.
   - `S3_FORCE_PATH_STYLE=true`.
   - `S3_CREATE_BUCKET=false` (o bucket já existe).
4. **CORS** (permissão para o navegador enviar fotos direto ao storage): configure o bucket para aceitar `PUT` e `GET` vindos do endereço do site. Em `S3_CORS_ORIGINS` coloque o endereço do site (ex.: `https://circleoflife.com.br`).

As fotos nunca passam pela API: o navegador pede um endereço temporário à API e envia o arquivo direto para o storage.

## 4. E-mail (SMTP)

Qualquer serviço SMTP serve (Resend, Brevo, Amazon SES, o próprio e-mail da empresa…). Preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` (ex.: `Circle of Life <nao-responda@circleoflife.com.br>`).

## 5. Login com Google

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto e vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth** (tipo "Aplicativo da Web").
2. Em **URIs de redirecionamento autorizados**, coloque: `https://SEU-SITE/api/auth/google/callback`.
3. Copie o **ID do cliente** (`GOOGLE_CLIENT_ID`) e a **chave secreta** (`GOOGLE_CLIENT_SECRET`).
4. Na **Tela de consentimento OAuth**, preencha nome do app, e-mail de suporte e publique.

### O primeiro administrador

O acesso é só por convite, e só administradores convidam. Para o **primeiro acesso**, coloque o seu e-mail do Google em `ADMIN_EMAILS` (pode ser mais de um, separados por vírgula). Quem está nessa lista entra sem convite e já vira administrador. Depois disso, convide as outras pessoas pela tela **Mais → Convites**.

## 6. Notificações no celular (opcional)

Rode `pnpm push:keys` no computador. Ele mostra `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`. Coloque as duas na API, junto com `VAPID_SUBJECT=mailto:seu-email@exemplo.com`. Sem elas, só o sino dentro do app funciona.

## 7. Análise inteligente (opcional)

- `AI_MODE=mock`: relatório montado com regras simples, sem custo e sem serviço externo.
- `AI_MODE=anthropic`: usa o Claude. Crie uma chave no [Console da Anthropic](https://console.anthropic.com) e coloque em `ANTHROPIC_API_KEY`. O modelo fica em `AI_MODEL` (padrão `claude-opus-5-5`). Cada relatório tem custo; `AI_MIN_MINUTES` limita a frequência por pessoa (padrão: 1 a cada 5 minutos).

## 8. Publicar a API (contêiner)

A imagem é montada com o arquivo `apps/api/Dockerfile`, **a partir da raiz do projeto**:

```bash
docker build -f apps/api/Dockerfile -t circle-api .
```

A maioria dos hosts de contêiner faz isso sozinha ao ligar o repositório do GitHub: informe o caminho do Dockerfile (`apps/api/Dockerfile`) e a pasta de contexto (a raiz).

Ao iniciar, o contêiner aplica as migrations e sobe a API. Configure estas variáveis no painel do host:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` (desliga o login de teste: a rota nem existe) |
| `API_PORT` | a porta que o host espera (muitos usam `8080`; veja a documentação dele) |
| `WEB_URL` | endereço do site, com `https://` |
| `DATABASE_URL` | do passo 2 |
| `S3_*` | do passo 3 |
| `SMTP_*` | do passo 4 |
| `JWT_SECRET` | um texto aleatório e longo (40+ caracteres). Gere com `openssl rand -base64 48`. Nunca reutilize o do `.env.example` (a API se recusa a iniciar com ele). |
| `SESSION_DAYS` | dias que a pessoa fica logada (padrão 30) |
| `COOKIE_DOMAIN` | deixe vazio (o site repassa a API pelo mesmo endereço) |
| `SIGNUP_MODE` | `invite` |
| `ADMIN_EMAILS` | o seu e-mail do Google |
| `INVITE_DAYS` | validade dos convites (padrão 7) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | do passo 5 |
| `VAPID_*`, `OVERDUE_HOUR` | do passo 6 (opcional) |
| `AI_MODE`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_MIN_MINUTES` | do passo 7 |

Se faltar alguma variável, a API não inicia e mostra no log exatamente qual falta.

Teste: `https://ENDERECO-DA-API/api/health` deve responder com `"status":"ok"` (e mostra se o banco e o storage estão acessíveis).

> A API roda tarefas agendadas (aviso de tarefas atrasadas e limpeza de stories vencidos) a cada hora. Mantenha **uma instância sempre ligada**; hosts que "dormem" sem acesso atrasam esses avisos.

## 9. Publicar o site (Vercel)

1. Na [Vercel](https://vercel.com), importe o repositório do GitHub.
2. **Root Directory**: `apps/web`.
3. **Build Command**: `cd ../.. && pnpm --filter @circle/shared build && pnpm --filter @circle/web build`
4. **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
5. Variável de ambiente: `API_INTERNAL_URL` = endereço da API (ex.: `https://circle-api.onrender.com`), sem barra no final.
6. Publique e, se quiser, ligue o domínio próprio em **Settings → Domains**. Lembre de atualizar `WEB_URL`, `S3_CORS_ORIGINS` e o endereço de retorno do Google (passo 5) se o endereço mudar.

## 10. Conferência final

- [ ] `/api/health` responde.
- [ ] Entrar com o Google usando o e-mail de `ADMIN_EMAILS`.
- [ ] Mandar um convite para outro e-mail e ver se ele chega.
- [ ] Enviar uma foto de perfil (confere o storage e o CORS).
- [ ] Criar uma tarefa, mover para Pronto e ver o XP.
- [ ] A tela de login **não** mostra os usuários de teste.
- [ ] (Se ativou) gerar um relatório da análise inteligente.

## 11. Segurança — o que já está feito

- Sessão em cookie `httpOnly` (o JavaScript da página não lê), `SameSite=Lax` e `Secure` quando o site está em `https`.
- Login de teste só existe com `NODE_ENV=development`; em produção a rota não é registrada.
- Toda rota exige login, exceto login, convite e health check. Cada pessoa só vê os próprios dados; posts, stories e grupos respeitam amizade, grupo e visibilidade.
- Toda entrada é validada; o texto do necrológio é limpo no servidor antes de salvar.
- Fotos vão direto para um bucket privado, com endereços temporários.
- Convites guardam só o "resumo" (hash) do código, não o código.
- Cabeçalhos de segurança básicos no site e na API.
- `pnpm audit` sem vulnerabilidades conhecidas na data desta etapa.

**Pendente para o futuro:** limite de tentativas por IP nas rotas de login (hoje o Google já protege o login), política de segurança de conteúdo (CSP) no site e backups automáticos do banco (o Supabase faz backups diários nos planos pagos).
