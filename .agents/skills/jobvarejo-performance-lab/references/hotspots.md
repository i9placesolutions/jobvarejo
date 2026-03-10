# Hotspots

Ler este arquivo quando precisar localizar rapidamente onde a performance do JobVarejo costuma degradar.

## Editor e render

- [components/EditorCanvas.vue](/Users/rafaelmendes/Documents/jobvarejo/components/EditorCanvas.vue)
  - principal hotspot do projeto
  - concentra render, historico, selecao, export, zona de produtos, templates, persistencia e metrics
  - possui bridge de perf em `window.__editorPerf`
  - contem viewport culling, caches de zona e medicao de FPS/cull

- [components/LabelTemplateMiniEditor.vue](/Users/rafaelmendes/Documents/jobvarejo/components/LabelTemplateMiniEditor.vue)
  - historico local, render queue, preview de template e patches em Fabric

- [components/ProductReviewModal.vue](/Users/rafaelmendes/Documents/jobvarejo/components/ProductReviewModal.vue)
  - fluxo pesado de review manual, thumbnails e cache de imagem

## Persistencia e autosave

- [composables/useProject.ts](/Users/rafaelmendes/Documents/jobvarejo/composables/useProject.ts)
  - draft local
  - comparacao remoto x local
  - save queue
  - payload limits
  - sincronizacao entre pagina, thumbnail e storage path

- [utils/editorSavePolicy.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/editorSavePolicy.ts)
  - throttle e skip rules para save e thumbnail

- [utils/editorPagePersistence.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/editorPagePersistence.ts)
  - sincronizacao do estado serializado com o store

- [utils/editorThumbnail.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/editorThumbnail.ts)
  - custo de thumbnail e sanitizacao

## Assets e storage

- [server/api/assets.get.ts](/Users/rafaelmendes/Documents/jobvarejo/server/api/assets.get.ts)
  - endpoint grande com cache, S3, Postgres e expansao via IA

- [server/utils/s3-object-cache.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/s3-object-cache.ts)
  - cache de listagem de objetos

- [server/api/storage/proxy.get.ts](/Users/rafaelmendes/Documents/jobvarejo/server/api/storage/proxy.get.ts)
  - proxy de leitura e cache-control

- [utils/storageProxy.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/storageProxy.ts)
  - normalizacao e memoizacao de URLs Wasabi/proxy

## Pipeline de imagem de produto

- [server/api/process-product-image.post.ts](/Users/rafaelmendes/Documents/jobvarejo/server/api/process-product-image.post.ts)
  - orquestracao de matching, busca externa, cache e upload

- [server/utils/product-image-pipeline.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-pipeline.ts)
  - download, processamento, background removal, upload e locks em memoria

- [server/utils/product-image-cache.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-cache.ts)
  - cache de resultados e retries

## Bundle e build

- [package.json](/Users/rafaelmendes/Documents/jobvarejo/package.json)
  - `check:bundle`
  - `check:client-chunk`

- [scripts/check-bundle-size.sh](/Users/rafaelmendes/Documents/jobvarejo/scripts/check-bundle-size.sh)
  - valida bundle total e maiores arquivos

- [scripts/check-client-chunk-size.sh](/Users/rafaelmendes/Documents/jobvarejo/scripts/check-client-chunk-size.sh)
  - valida maior chunk do client

## Riscos estruturais ja documentados

- [ANALISE_EDITOR_DIAGNOSTICO_2026-02-17.md](/Users/rafaelmendes/Documents/jobvarejo/ANALISE_EDITOR_DIAGNOSTICO_2026-02-17.md)
  - monolito grande no editor
  - tipagem fraca
  - poucas garantias automatizadas de regressao

## Regra pratica

Antes de alterar performance em qualquer area:
1. confirmar o hotspot no arquivo certo
2. checar se ja existe cache/debounce/bridge de medicao
3. medir antes de editar
