# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-bookworm-slim AS builder

ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Dependencias nativas (sharp, canvas, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

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
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Runtime Python real: Chromium e BiRefNet fazem parte da imagem publicada.
ENV PRODUCT_IMAGE_PYTHON=/opt/image-worker/bin/python \
    U2NET_HOME=/opt/image-models \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    BIREFNET_MODEL=birefnet-general-lite \
    OMP_NUM_THREADS=6 \
    OPENBLAS_NUM_THREADS=6
RUN apt-get update && apt-get install -y --no-install-recommends curl python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY workers/requirements.txt /tmp/image-worker-requirements.txt
# Camadas independentes: falhar no modelo não refaz Python e Chromium.
RUN --mount=type=cache,target=/root/.cache/pip \
    python3 -m venv /opt/image-worker \
    && /opt/image-worker/bin/pip install -r /tmp/image-worker-requirements.txt
RUN /opt/image-worker/bin/python -m playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*
RUN /opt/image-worker/bin/python -m playwright install --only-shell chromium
COPY workers/download_model.py /tmp/download_model.py
ARG BIREFNET_MODEL_URL=https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx
RUN --mount=type=cache,target=/root/.cache/birefnet \
    mkdir -p /opt/image-models \
    && /opt/image-worker/bin/python /tmp/download_model.py "$BIREFNET_MODEL_URL" /root/.cache/birefnet/birefnet-general-lite.onnx \
    && cp /root/.cache/birefnet/birefnet-general-lite.onnx /opt/image-models/ \
    && /opt/image-worker/bin/python -c "from rembg import new_session; new_session('birefnet-general-lite', providers=['CPUExecutionProvider'])"


WORKDIR /app

# Instalar apenas dependencias exigidas pelo bundle Nitro + opcionais nativas.
COPY --from=builder /app/.output/server/package.runtime.json ./package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm install --omit=dev --include=optional --ignore-scripts

# Copiar output do build (self-contained)
COPY --from=builder /app/.output ./.output
COPY workers/ ./workers/
# Valida o motor isolado do Estúdio de Artes e suas fontes empacotadas.
RUN /opt/image-worker/bin/python workers/art_studio.py --self-test

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1

CMD ["sh", "workers/start-server.sh"]
