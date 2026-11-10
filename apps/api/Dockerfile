# =====================================================================
# Imagem de produção da API (Nest.js + Prisma).
#
# Usada na AWS (ECS). Monte a partir da RAIZ do projeto:
#   docker build -f apps/api/Dockerfile -t circle-api .
# Ao iniciar, aplica as migrations do banco e sobe a API na porta 4000.
# Todas as configurações vêm de variáveis de ambiente (veja docs/deploy.md).
# =====================================================================

FROM node:24-bookworm-slim AS build
WORKDIR /app
# O Prisma precisa do OpenSSL (conexão criptografada com o banco).
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.10.1

# Primeiro só as listas de dependências (o Docker reaproveita esta etapa).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@circle/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api
# O Prisma exige DATABASE_URL até para gerar o código; aqui ele não conecta, então um valor
# fictício basta (o de verdade só existe no servidor, ao iniciar). Vale só nesta etapa de montagem.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @circle/shared build && pnpm --filter @circle/api build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Certificados do banco gerenciado da AWS (RDS), para a conexão com o banco ser criptografada e
# conferida. Só valem se a variável NODE_EXTRA_CA_CERTS apontar para este arquivo.
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /tmp/rds.pem
RUN install -D -m 644 /tmp/rds.pem /etc/ssl/certs/rds-global-bundle.pem && rm /tmp/rds.pem
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 4000
# Chama o Prisma direto (o pnpm tentaria reinstalar as bibliotecas a cada início). O "exec" faz o
# aviso de parada chegar à API, que termina os pedidos em andamento antes de sair.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
