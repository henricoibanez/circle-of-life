# Como publicar o Circle of Life

## Produção na AWS (desde 11/2026)

O endereço oficial é **https://circleoflife.labzz.studio**, na conta AWS da Labzz/Eduzz. Quem cuida da
infraestrutura é o time da Labzz; o código da infra e o manual de operação ficam no repositório
`eduzz-aws`, pasta `infra/circle-of-life`.

**Para publicar, basta enviar o código para a branch `master`.** O GitHub avisa o Jenkins na hora (webhook), e o Jenkins (https://ci.labzz.studio)
monta o site e a API, publica a versão nova sem tirar o app do ar e confere se ela está funcionando.
Se a versão nova não subir, a anterior continua no ar e o build fica vermelho no Jenkins. As
migrations do banco rodam sozinhas quando a API nova inicia.

| Peça | Onde fica na AWS |
|---|---|
| Site e API | ECS (contêineres `web` e `api` juntos), imagens `apps/web/Dockerfile` e `apps/api/Dockerfile` |
| Banco de dados | PostgreSQL no RDS, com backup automático de 7 dias |
| Arquivos (fotos, vídeos, documentos) | Amazon S3, bucket privado `circle-of-life-prod-media` |
| Variáveis secretas | AWS Secrets Manager (`circle-of-life-prod`); peça ao time da Labzz para trocar alguma |

Para acompanhar cada publicação (etapas e log ao vivo): https://ci.labzz.studio/job/circle-of-life/job/deploy/
(entre com o login do GitHub). Uma publicação leva de 2 a 4 minutos do push até o ar, sem tirar o app do ar.

Na AWS, a API não usa `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`: ela acessa o bucket pela permissão
do próprio servidor, sem chave guardada. No computador local e na Vercel, as chaves continuam
valendo como antes.

### Desligando a publicação antiga (Vercel + Supabase)

Os dados já foram levados para a AWS. Para quem abrir o endereço antigo cair no novo:

1. **Site antigo (projeto `circle-web` na Vercel):** em Settings → Environment Variables, crie
   `MOVED_TO_URL` = `https://circleoflife.labzz.studio` (Production) e faça um Redeploy. Toda página
   do endereço antigo passa a levar para a mesma página no novo.
2. **API antiga (projeto `circle-api`):** apague a variável `CRON_SECRET` e faça um Redeploy. Assim as
   tarefas diárias param e ninguém recebe avisos repetidos tirados do banco antigo. (Ou exclua o projeto.)
3. **Supabase:** mantenha o banco e os arquivos por algumas semanas, como cópia de segurança; depois, pode excluir.

O restante deste guia descreve a publicação antiga, na Vercel + Supabase.

---

# Publicação na Vercel + Supabase (beta)

Este guia explica, passo a passo, como colocar o beta no ar usando só dois serviços: **Supabase** (banco de dados e fotos) e **Vercel** (site e API). Cada termo técnico vem explicado na primeira vez que aparece.

O código continua sem nada específico desses serviços: tudo vem de variáveis de ambiente. Trocar de provedor no futuro é trocar variáveis (veja a seção 9).

## Situação atual (25/10/2026)

O beta está no ar:

| Peça | Projeto na Vercel | Endereço |
|---|---|---|
| Site | `circle-of-life-app` (Root Directory `apps/web`) | https://circle-of-life-app.vercel.app |
| API | `circle-of-life` (Root Directory `apps/api`) | https://circle-of-life-three.vercel.app |

Banco e fotos no Supabase (região São Paulo). A API roda na Vercel também em São Paulo (`"regions": ["gru1"]` em `apps/api/vercel.json`): perto do banco, cada consulta leva milissegundos; com a API nos EUA, cada ida ao banco custava ~120 ms e operações grandes (importar trilha com dezenas de tarefas) passavam do tempo limite. E-mail desligado. Os commits deste projeto usam o e-mail pessoal do dono (a Vercel só publica commits de autor ligado à conta).

**Na Vercel, a API roda a partir de um arquivo único** (`dist/vercel.cjs`, gerado por `apps/api/scripts/vercel-bundle.mjs`): o carregador de funções da Vercel não aceita os pacotes do Nest 12 separados.

## 1. As peças

| Peça | O que é | Onde fica |
|---|---|---|
| **Site** (`apps/web`) | As telas do app. | Projeto **circle-web** na Vercel |
| **API** (`apps/api`) | As regras (XP, sprints, login, permissões). O site conversa só com ela. | Projeto **circle-api** na Vercel, como "função" (um programa que liga sozinho quando chega um pedido) |
| **Banco de dados** | Onde ficam os dados. | **Supabase** (Postgres) |
| **Fotos** | Fotos de perfil, stories, posts, sonhos, capas. | **Supabase Storage**, pelo protocolo S3 |

O site repassa tudo que começa com `/api/` para a API. O navegador só enxerga o endereço do site, e o cookie de login funciona sem configuração extra.

**E-mail:** nesta primeira publicação o envio de e-mails fica **desligado**. Os convites continuam funcionando: você convida o e-mail na tela de Convites e avisa a pessoa para entrar no site com a conta Google daquele e-mail.

**Tarefas agendadas:** no plano grátis da Vercel, elas rodam **uma vez por dia** (por volta das 8h de Brasília): aviso de tarefas atrasadas, limpeza de avisos antigos e das fotos de stories vencidos. Os stories somem da tela após 24h de qualquer jeito.

## 2. Código no GitHub

A Vercel publica a partir do GitHub.

1. No GitHub, crie um repositório **privado** chamado `circle-of-life` (sem README, sem .gitignore).
2. Envie o código (o Claude pode rodar estes comandos; o GitHub vai pedir login numa janela):

```bash
git remote add origin https://github.com/SEU-USUARIO/circle-of-life.git
git push -u origin master
```

A pasta `referencia/` e os arquivos `.env` nunca vão para o GitHub.

## 3. Banco de dados (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com). Região: **South America (São Paulo)**. Guarde a senha do banco.
2. Clique em **Connect** (no topo) e copie a conexão **Session pooler** (formato `postgresql://postgres.xxxx:SENHA@aws-...pooler.supabase.com:5432/postgres`). Troque `[YOUR-PASSWORD]` pela senha. Esse é o `DATABASE_URL`.
   - Use o **Session pooler**: a conexão direta não funciona a partir da Vercel.
3. Não crie tabelas: a cada publicação, a Vercel aplica as "migrations" (os passos de mudança do banco guardados no código).

**Nunca rode o seed em produção.** Ele só existe para os dados de exemplo do computador local.

## 4. Fotos (Supabase Storage)

1. No Supabase, vá em **Storage → New bucket**, nome `circle-of-life`, **privado** (Public bucket desligado).
2. Em **Project Settings → Storage → S3 Connection**: ligue **Enable connection via S3 protocol**. Anote o **Endpoint** e a **Region**.
3. Em **S3 Access Keys → New access key**: anote o **Access key ID** e o **Secret access key** (o segredo só aparece uma vez).
4. **Vídeos e documentos** (decisão do dono de 07/11/2026): os maiores arquivos aceitos têm **50 MB** (vídeo de post e de anexo). Confira em **Storage → Settings** se o **limite de tamanho por arquivo** do Supabase é de pelo menos 50 MB e, no bucket, se não há restrição de tipos (o app já confere os tipos). O plano grátis tem pouco espaço para arquivos: acompanhe o uso em **Usage**, porque vídeos enchem rápido.

## 5. API na Vercel (projeto circle-api)

1. Na Vercel: **Add New → Project**, escolha o repositório `circle-of-life`.
2. **Project Name**: `circle-api`. **Root Directory**: `apps/api`. **Framework Preset**: Other. (Os comandos de instalar e montar já estão no arquivo `apps/api/vercel.json`.)
3. Em **Environment Variables**, cole as variáveis abaixo e clique **Deploy**.

| Variável | Valor |
|---|---|
| `WEB_URL` | endereço do site (passo 6), ex.: `https://circle-of-life-app.vercel.app`. Na primeira vez, coloque o endereço que a Vercel vai dar ao site (`https://circle-of-life-app.vercel.app`) e confira depois. |
| `DATABASE_URL` | do passo 3 |
| `DATABASE_POOL_MAX` | `3` |
| `S3_ENDPOINT` e `S3_PUBLIC_ENDPOINT` | o Endpoint do passo 4 (os dois iguais) |
| `S3_REGION` | a Region do passo 4 |
| `S3_BUCKET` | `circle-of-life` |
| `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` | a chave do passo 4 |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_CREATE_BUCKET` | `false` |
| `S3_CORS_ORIGINS` | endereço do site |
| `JWT_SECRET` | um texto aleatório e longo (40+ caracteres), ex.: gerado em [1password.com/password-generator](https://1password.com/password-generator) |
| `SIGNUP_MODE` | `invite` |
| `ADMIN_EMAILS` | o seu e-mail do Google (você entra sem convite e vira administrador) |
| `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` | do passo 7 (pode deixar para depois e publicar de novo) |
| `CRON_SECRET` | outro texto aleatório (a Vercel usa para chamar as tarefas diárias) |
| `DISABLE_SCHEDULE` | `true` |
| `AI_MODE` | `afl` para o "Me analise" de verdade (ou `mock` para a IA simulada) |
| `AFL_API_URL` | `https://app.agentsforlife.org/api/mcp/hub` |
| `AFL_API_KEY` | chave do Agents for Life criada só para o app (no site deles, em /api-tokens, só com permissão de conversar com agentes). Nunca reaproveite a chave pessoal |
| `AFL_AGENT_ID` | id do agente "Circle of Life — Me analise" |
| `AI_INTERVAL_DAYS` | `30` (uma análise por mês por pessoa) |

Deixe vazias as variáveis de e-mail (`SMTP_*`): o envio fica desligado.

Teste: `https://circle-of-life-three.vercel.app/api/health` deve responder com `"status":"ok"` (e mostra se o banco e o storage estão acessíveis).

## 6. Site na Vercel (projeto circle-web)

1. **Add New → Project** de novo, o mesmo repositório.
2. **Project Name**: `circle-web`. **Root Directory**: `apps/web`. **Framework Preset**: Next.js (os comandos estão em `apps/web/vercel.json`).
3. Variável: `API_INTERNAL_URL` = endereço da API, ex.: `https://circle-of-life-three.vercel.app` (sem barra no final).
4. **Deploy**. Se o endereço final do site for diferente do que você colocou em `WEB_URL` e `S3_CORS_ORIGINS` na API, corrija lá e publique a API de novo (**Deployments → ⋯ → Redeploy**).

## 7. Login com Google

1. No [Google Cloud Console](https://console.cloud.google.com): **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**.
2. **Origens JavaScript autorizadas**: o endereço do site. **URIs de redirecionamento autorizados**: `https://ENDERECO-DO-SITE/api/auth/google/callback`.
3. Copie o **ID do cliente** e a **Chave secreta** para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no projeto **circle-api** e publique a API de novo.
4. Na **Tela de consentimento OAuth**, preencha nome do app e e-mail de suporte. Enquanto estiver "Em teste", só entram os e-mails cadastrados em **Usuários de teste**; para liberar, clique em **Publicar app**.

## 8. Conferência final

- [ ] `https://circle-of-life-three.vercel.app/api/health` responde com `"status":"ok"`.
- [ ] Entrar com o Google usando o e-mail de `ADMIN_EMAILS`.
- [ ] A tela de login **não** mostra usuários de teste.
- [ ] Enviar uma foto de perfil (confere o storage).
- [ ] Criar uma tarefa, mover para Pronto e ver o XP.
- [ ] Convidar um e-mail e entrar com ele (a tela avisa que o e-mail está desligado).
- [ ] Na Vercel, projeto circle-api → **Settings → Cron Jobs**: aparece `/api/cron/daily`.

## 9. Outras opções (para o futuro)

- **E-mail:** preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` (Resend, Brevo, e-mail da empresa…) e publique de novo.

## Ligar o Google Agenda (opcional)

Quando a pessoa põe uma data numa tarefa, o app pode criar o evento na Google Agenda dela (se ela conectar nas Configurações). Usa as **mesmas credenciais do login com Google**; só falta liberar o calendário no Google Cloud:

1. **APIs e serviços → Biblioteca →** ative a **Google Calendar API**.
2. **Tela de consentimento OAuth → Editar →** na etapa de escopos, adicione `.../auth/calendar.events`. Salve.
3. **Usuários de teste:** enquanto o app não é verificado pelo Google, só e-mails adicionados como **usuários de teste** (até 100) conseguem conectar. Adicione os participantes.
4. **Credenciais →** no **ID do cliente OAuth** do login, em **URIs de redirecionamento autorizados**, adicione:
   `https://circle-of-life-app.vercel.app/api/calendar/google/callback` (troque pelo seu domínio do site).

Sem `GOOGLE_CLIENT_ID`/`SECRET`, a opção de agenda nem aparece. O escopo `calendar.events` é "sensível" (não "restrito"), então não exige a verificação de segurança completa; só o aviso de "app não verificado" até você publicar.

## Ligar o envio de e-mails pelo Gmail

Sem e-mail, a tela de login mostra só o Google. Com e-mail ligado, aparecem o cadastro com senha e o "Esqueci minha senha", e os convites chegam por e-mail. O Gmail manda até ~500 e-mails por dia, de graça.

1. Na conta Google que vai mandar os e-mails, ligue a **verificação em duas etapas** (myaccount.google.com → Segurança).
2. Abra **myaccount.google.com/apppasswords**, dê um nome (ex.: "Circle of Life") e clique em **Criar**. Copie a senha de 16 letras que aparece (ela só aparece uma vez).
3. Na Vercel, no projeto da **API** → Settings → Environment Variables, crie:

| Variável | Valor |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | o Gmail completo (ex.: `voce@gmail.com`) |
| `SMTP_PASS` | a senha de app de 16 letras (sem espaços) |
| `SMTP_FROM` | `Circle of Life <voce@gmail.com>` (o mesmo Gmail) |

4. Em Deployments, no último, clique em **⋯ → Redeploy** para valer.
5. Teste: crie uma conta com senha usando um e-mail convidado e veja se o código chega (olhe também o spam).
- **Notificações no celular:** rode `pnpm push:keys` e cadastre `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` na API.
- **API sempre ligada** (tarefas de hora em hora): o arquivo `apps/api/Dockerfile` monta a API para qualquer host de contêiner (ainda não testado). Nesse caso, `DISABLE_SCHEDULE=false` e `CRON_SECRET` vazio.

## 10. Segurança — o que já está feito

- Sessão em cookie `httpOnly`, `SameSite=Lax` e `Secure` em `https`.
- Login de teste só existe com `NODE_ENV=development` (a Vercel usa `production`).
- Toda rota exige login, exceto login, convite, health check e a rota diária (que exige o `CRON_SECRET`).
- Fotos em bucket privado, com endereços temporários. O projeto da API não publica nenhum arquivo do código (pasta `public` vazia).
- Cabeçalhos de segurança básicos no site e na API.
