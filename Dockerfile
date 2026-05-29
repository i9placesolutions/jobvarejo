# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder

ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Dependencias nativas (sharp, canvas, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Instalar dependencias (inclui opcionais: sharp, onnxruntime-node)
COPY package.json package-lock.json* patches/ ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --include=optional

# Copiar codigo fonte
COPY . .

# Build Nuxt: chama npx diretamente para evitar o prebuild env:check
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npx nuxt build

RUN node <<'NODE'
const fs = require('fs')
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
const runtimePkg = JSON.parse(fs.readFileSync('.output/server/package.json', 'utf8'))
const dependencies = { ...(runtimePkg.dependencies || {}) }

for (const name of Object.keys(rootPkg.optionalDependencies || {})) {
  const locked = lock.packages?.[`node_modules/${name}`]?.version
  dependencies[name] = locked || rootPkg.optionalDependencies[name]
}

runtimePkg.dependencies = dependencies
fs.writeFileSync('.output/server/package.runtime.json', JSON.stringify(runtimePkg, null, 2) + '\n')
NODE

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Instalar apenas dependencias exigidas pelo bundle Nitro + opcionais nativas.
COPY --from=builder /app/.output/server/package.runtime.json ./package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm install --omit=dev --include=optional --ignore-scripts

# Copiar output do build (self-contained)
COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
