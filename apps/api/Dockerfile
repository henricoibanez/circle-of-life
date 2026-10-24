# =====================================================================
# Imagem de produção da API (Nest.js + Prisma).
#
# ATENÇÃO: ainda não testado (o computador do projeto não tem Docker).
# Monte a partir da RAIZ do projeto:
#   docker build -f apps/api/Dockerfile -t circle-api .
# Ao iniciar, aplica as migrations do banco e sobe a API na porta 4000.
# Todas as configurações vêm de variáveis de ambiente (veja docs/deploy.md).
# =====================================================================

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.10.1

# Primeiro só as listas de dependências (o Docker reaproveita esta etapa).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@circle/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @circle/shared build && pnpm --filter @circle/api build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
RUN npm install -g pnpm@12.10.1
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["sh", "-c", "pnpm db:deploy && node dist/main.js"]
