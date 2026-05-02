#!/bin/bash
set -euo pipefail

# Verifica o maior chunk JS do client.
# Suporta tanto a saída do Vercel quanto o build local do Nuxt.
# Uso:
#   ./scripts/check-client-chunk-size.sh
#   MAX_CLIENT_CHUNK_KB=500 ./scripts/check-client-chunk-size.sh
#   CLIENT_ASSETS_DIR=node_modules/.cache/nuxt/.nuxt/dist/client/_nuxt ./scripts/check-client-chunk-size.sh

MAX_CLIENT_CHUNK_KB="${MAX_CLIENT_CHUNK_KB:-500}"
ASSETS_DIR="${CLIENT_ASSETS_DIR:-}"

if [ -z "$ASSETS_DIR" ]; then
  for candidate in \
    ".vercel/output/static/_nuxt" \
    ".output/public/_nuxt" \
    "node_modules/.cache/nuxt/.nuxt/dist/client/_nuxt"
  do
    if [ -d "$candidate" ]; then
      ASSETS_DIR="$candidate"
      break
    fi
  done
fi

if [ ! -d "$ASSETS_DIR" ]; then
  echo "❌ Diretório de assets não encontrado"
  echo "   Procurados:"
  echo "   - .vercel/output/static/_nuxt"
  echo "   - .output/public/_nuxt"
  echo "   - node_modules/.cache/nuxt/.nuxt/dist/client/_nuxt"
  echo "   Ou informe CLIENT_ASSETS_DIR=/caminho/_nuxt"
  echo "   Rode primeiro: npm run build"
  exit 1
fi

largest_size_bytes=0
largest_file=""

while IFS= read -r file; do
  size_bytes="$(wc -c < "$file")"
  if [ "$size_bytes" -gt "$largest_size_bytes" ]; then
    largest_size_bytes="$size_bytes"
    largest_file="$file"
  fi
done < <(find "$ASSETS_DIR" -maxdepth 1 -type f -name "*.js" | sort)

if [ -z "$largest_file" ]; then
  echo "❌ Nenhum chunk JS encontrado em $ASSETS_DIR"
  exit 1
fi

largest_size_kb="$(( (largest_size_bytes + 1023) / 1024 ))"

echo "📦 Maior chunk client:"
echo "   arquivo: $largest_file"
echo "   tamanho: ${largest_size_kb}KB"
echo "   limite : ${MAX_CLIENT_CHUNK_KB}KB"

if [ "$largest_size_kb" -le "$MAX_CLIENT_CHUNK_KB" ]; then
  echo "✅ Dentro do limite"
  exit 0
fi

echo "❌ Acima do limite"
exit 1
