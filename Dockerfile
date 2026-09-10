# syntax=docker/dockerfile:1

# Pinned to match .nvmrc (Node 24, the current LTS line) rather than the
# Node 22 LTS PLAN.md sketched before that decision was made.
ARG NODE_VERSION=24-slim

# ---- deps: install once, reused by the build stage --------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile, then prune devDependencies out of node_modules ---
FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: nothing but the compiled app and prod deps --------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production

# dumb-init reaps zombies and forwards SIGTERM as PID 1 would otherwise
# fail to — without it, app.enableShutdownHooks() (src/app.module.ts) never
# fires and containers stop only after the orchestrator's kill timeout.
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

# Hits the liveness route (no upstream dependency) with Node's own http
# client, so the image needs no curl/wget.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
