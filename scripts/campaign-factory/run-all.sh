#!/bin/bash
# Pipeline completo das 10 campanhas (fundos desenhados, encartes, catálogo, cartazes e vídeos).
set -e
cd "$(dirname "$0")"
node prepare.mjs
node video-bg.mjs
cd ../..
node --env-file=.env output/campanhas-magnific-2026-10-06/build.mjs
node output/campanhas-magnific-2026-10-06/integrate.mjs
node --env-file=.env scripts/video-studio/migrate-catalog-to-wasabi.mjs --upload --archive | tail -1
node output/campanhas-magnific-2026-10-06/render-posters.mjs
for s in mega-oferta-estrelas aqui-tem-super-ofertas fim-de-semana-imbativel quinta-da-carne-brasa clube-de-descontos super-economia promocao-do-dia super-promocao-preto mega-promocao promocao-da-semana; do
  SLUG=$s node --env-file=.env output/campanhas-magnific-2026-10-06/render-video.mjs --stills --mp4 2>&1 | grep -E "^mp4|Error" || true
  echo "video $s"
done
echo PIPELINE-OK
