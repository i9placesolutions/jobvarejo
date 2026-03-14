# ---- Build stage ----
FROM node:22-alpine AS builder

# Dependências nativas (sharp, canvas, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Instalar dependências (inclui opcionais: sharp, onnxruntime-node)
COPY package.json package-lock.json* patches/ ./
RUN npm ci --include=optional

# Copiar código fonte
COPY . .

# Build Nuxt — chama npx diretamente para evitar o prebuild env:check
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npx nuxt build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Reinstalar só dependências de produção + opcionais (sharp, etc. são externalizados do bundle)
COPY package.json package-lock.json* patches/ ./
RUN npm ci --omit=dev --include=optional --ignore-scripts

# Copiar output do build (self-contained)
COPY --from=builder /app/.output ./.output

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
