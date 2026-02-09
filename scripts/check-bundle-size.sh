#!/bin/bash
set -euo pipefail

# Script para verificar tamanho do bundle antes do deploy
# Uso: ./scripts/check-bundle-size.sh

LIMIT_MB=250
TARGET_PATH=""
TARGET_LABEL=""

echo "🔍 Verificando tamanho do bundle..."
echo ""

echo "🧹 Limpando build anterior..."
rm -rf .output .nuxt .vercel/output

echo "📦 Gerando build..."
if ! npm run build; then
    echo "❌ Erro no build!"
    exit 1
fi

if [ -d ".output/server" ]; then
    TARGET_PATH=".output/server"
    TARGET_LABEL="Nuxt server bundle (.output/server)"
elif [ -d ".vercel/output/functions" ]; then
    TARGET_PATH=".vercel/output/functions"
    TARGET_LABEL="Vercel functions bundle (.vercel/output/functions)"
else
    echo "❌ Nenhum diretório de saída encontrado (.output/server ou .vercel/output/functions)"
    exit 1
fi

SERVER_SIZE=$(du -sh "$TARGET_PATH" | cut -f1)
SERVER_SIZE_MB=$(du -sm "$TARGET_PATH" | cut -f1)

echo ""
echo "📊 Resultados:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Alvo analisado: $TARGET_LABEL"
echo "📁 Tamanho total: $SERVER_SIZE (${SERVER_SIZE_MB}MB)"

if [ "$SERVER_SIZE_MB" -lt "$LIMIT_MB" ]; then
    echo "✅ Bundle total abaixo do limite de ${LIMIT_MB}MB"
else
    echo "❌ Bundle total acima do limite de ${LIMIT_MB}MB"
fi

if [ "$TARGET_PATH" = ".vercel/output/functions" ]; then
    LARGEST_FUNC="$(find .vercel/output/functions -mindepth 1 -maxdepth 1 -type d -name "*.func" -exec du -sm {} + 2>/dev/null | sort -nr | head -1 || true)"
    if [ -n "$LARGEST_FUNC" ]; then
        LARGEST_FUNC_MB="$(echo "$LARGEST_FUNC" | awk '{print $1}')"
        LARGEST_FUNC_PATH="$(echo "$LARGEST_FUNC" | awk '{print $2}')"
        echo "📦 Maior function: $LARGEST_FUNC_PATH (${LARGEST_FUNC_MB}MB)"
        if [ "$LARGEST_FUNC_MB" -lt "$LIMIT_MB" ]; then
            echo "✅ Maior function abaixo do limite de ${LIMIT_MB}MB"
        else
            echo "❌ Maior function acima do limite de ${LIMIT_MB}MB"
        fi
    fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📈 Top 10 maiores arquivos no bundle:"
find "$TARGET_PATH" -type f -exec du -h {} + 2>/dev/null | sort -rh | head -10 || true

echo ""
echo "✨ Análise completa!"
