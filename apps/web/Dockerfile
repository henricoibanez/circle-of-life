# =====================================================================
# Imagem de produção do site (Next.js), usada na AWS.
# Monte a partir da RAIZ do projeto:
#   docker build -f apps/web/Dockerfile -t circle-web .
# Na AWS o site e a API rodam juntos, na mesma "task" (mesma máquina
# virtual): por isso o site repassa /api/* para http://localhost:4000.
# =====================================================================

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.10.1

# Primeiro só as listas de dependências (o Docker reaproveita esta etapa).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@circle/web..."

COPY packages/shared packages/shared
COPY apps/web apps/web
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://localhost:4000
RUN pnpm --filter @circle/shared build && pnpm --filter @circle/web build

FROM node:24-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
