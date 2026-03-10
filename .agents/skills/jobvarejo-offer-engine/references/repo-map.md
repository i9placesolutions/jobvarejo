# Repo Map

Ler este arquivo quando precisar localizar rapidamente onde o JobVarejo trata ingestao, editor, imagem e persistencia.

## Nucleo comercial

- [server/api/parse-products.post.ts](/Users/rafaelmendes/Documents/jobvarejo/server/api/parse-products.post.ts)
  - extracao de produtos a partir de texto, PDF, XLSX, CSV e imagem
  - prompt com semantica de atacarejo, limites e colunas de preco

- [types/product-zone.ts](/Users/rafaelmendes/Documents/jobvarejo/types/product-zone.ts)
  - contrato de `Product`, `ProductZone`, `GlobalStyles` e `Splash`
  - principal fonte de verdade para campos de produto e zona

- [utils/product-zone-helpers.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/product-zone-helpers.ts)
  - parse e formatacao de preco
  - grid layout
  - migracao de formatos legados
  - heuristicas de card e zona

## Imagem de produto

- [server/api/process-product-image.post.ts](/Users/rafaelmendes/Documents/jobvarejo/server/api/process-product-image.post.ts)
  - orquestra cache, busca externa, validacao por IA, registry e upload final

- [server/utils/product-image-pipeline.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-pipeline.ts)
  - pipeline de download, remocao de fundo, upload, deduplicacao e cache

- [server/utils/product-image-matching.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-matching.ts)
  - normalizacao, chaves deterministicas e match

- [server/utils/product-image-cache.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-cache.ts)
  - reuso de resultados anteriores

- [server/utils/product-image-registry.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-registry.ts)
  - aprovacao e rastreio de imagem por identidade de produto

## Editor

- [components/EditorCanvas.vue](/Users/rafaelmendes/Documents/jobvarejo/components/EditorCanvas.vue)
  - nucleo do editor
  - produto, zona, label template, autosave, export e historico vivem aqui
  - tratar como area de alto risco para regressao

- [components/LabelTemplatesDialog.vue](/Users/rafaelmendes/Documents/jobvarejo/components/LabelTemplatesDialog.vue)
  - entrada principal para gestao de modelos de etiqueta

- [pages/editor/[id].vue](/Users/rafaelmendes/Documents/jobvarejo/pages/editor/[id].vue)
  - pagina do editor

## Persistencia e projeto

- [types/project.ts](/Users/rafaelmendes/Documents/jobvarejo/types/project.ts)
  - contrato de pagina, tipo de pagina e linha de projeto

- [ANALISE_PERSISTENCIA.md](/Users/rafaelmendes/Documents/jobvarejo/ANALISE_PERSISTENCIA.md)
  - resumo de persistencia de canvas, viewport, templates e thumbnails

- [ANALISE_EDITOR_DIAGNOSTICO_2026-02-17.md](/Users/rafaelmendes/Documents/jobvarejo/ANALISE_EDITOR_DIAGNOSTICO_2026-02-17.md)
  - historico de riscos, regressao e areas sensiveis

## Regra pratica

Antes de implementar qualquer automacao nova:
1. confirmar se o campo ja existe em `Product`
2. confirmar se a zona ou splash ja suporta o caso
3. confirmar se a persistencia atual ja cobre o payload
4. evitar duplicar regra de negocio fora desses arquivos
