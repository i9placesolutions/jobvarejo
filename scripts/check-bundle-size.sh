#!/bin/bash

# Script para verificar tamanho do bundle antes do deploy
# Uso: ./scripts/check-bundle-size.sh

echo "🔍 Verificando tamanho do bundle..."
echo ""

# Limpar build anterior
echo "🧹 Limpando build anterior..."
rm -rf .output .nuxt

# Build do projeto
echo "📦 Gerando build..."
npm run build

# Verificar se build foi bem sucedido
if [ $? -ne 0 ]; then
    echo "❌ Erro no build!"
    exit 1
fi

# Calcular tamanho do .output/server
if [ -d ".output/server" ]; then
    SERVER_SIZE=$(du -sh .output/server | cut -f1)
    SERVER_SIZE_MB=$(du -sm .output/server | cut -f1)
    
    echo ""
    echo "📊 Resultados:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📁 Tamanho do /server: $SERVER_SIZE (${SERVER_SIZE_MB}MB)"
    
    # Verificar se está abaixo do limite
    if [ $SERVER_SIZE_MB -lt 250 ]; then
        echo "✅ Bundle está ABAIXO do limite de 250MB"
        echo "✅ Pronto para deploy na Vercel!"
    else
        echo "❌ Bundle está ACIMA do limite de 250MB"
        echo "⚠️  Deploy na Vercel vai FALHAR!"
        echo ""
        echo "Sugestões:"
        echo "1. Verifique se todas as otimizações estão aplicadas"
        echo "2. Considere mover APIs pesadas para edge functions"
        echo "3. Veja VERCEL_OPTIMIZATION.md para mais detalhes"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Mostrar os 10 maiores arquivos
    echo ""
    echo "📈 Top 10 maiores arquivos no bundle:"
    find .output/server -type f -exec du -h {} + | sort -rh | head -10
    
else
    echo "❌ Diretório .output/server não encontrado!"
    exit 1
fi

echo ""
echo "✨ Análise completa!"
