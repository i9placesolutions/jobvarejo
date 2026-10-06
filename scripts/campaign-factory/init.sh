#!/bin/bash
# Cria um lote novo de campanhas a partir desta fábrica: copia os scripts para output/<lote>,
# troca o caminho fixo do lote original e instala o leitor de PSD (ag-psd) só no lote.
# Uso (na raiz do repositório): bash scripts/campaign-factory/init.sh campanhas-<tema>-AAAA-MM-DD
set -e
LOTE="$1"
[ -z "$LOTE" ] && { echo "Uso: bash scripts/campaign-factory/init.sh <nome-do-lote>"; exit 1; }
DEST="output/$LOTE"
[ -e "$DEST" ] && { echo "Já existe: $DEST"; exit 1; }
mkdir -p "$DEST"
SRC="$(cd "$(dirname "$0")" && pwd)"
for f in "$SRC"/*; do
  case "$(basename "$f")" in init.sh|README.md) continue;; esac
  cp -R "$f" "$DEST/"
done
# Caminho do lote original → lote novo (scripts rodam a partir da raiz ou da pasta do lote).
sed -i '' "s#output/campanhas-magnific-2026-10-06#$DEST#g" "$DEST"/*.mjs "$DEST"/*.sh "$DEST"/test/*.mjs
# ids.json é por lote: o lote novo começa sem IDs (projetos novos).
(cd "$DEST" && npm i ag-psd --no-audit --no-fund >/dev/null)
# Runtime do renderizador de prévia (rodapé, validade, pagamentos, contorno sticker da logo) com o código atual do app.
npx esbuild "$DEST/runtime.ts" --bundle --format=esm --platform=browser --outfile="$DEST/runtime.mjs" --log-level=warning
echo "Lote criado em $DEST — edite campaigns.mjs (campanhas, paletas, DECOR, LOOK, VIDEO_FX) antes de rodar."
