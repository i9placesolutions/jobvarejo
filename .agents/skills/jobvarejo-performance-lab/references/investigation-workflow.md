# Investigation Workflow

Ler este arquivo quando o pedido for diagnosticar ou corrigir um gargalo.

## Trilha 1: Editor com FPS ruim

1. Reproduzir a operacao exata:
   - pan
   - zoom
   - drag de card
   - aplicar template
   - recalcular zona
2. Ler o snapshot de `window.__editorPerf`.
3. Identificar:
   - `fps`, `fpsAvg`, `cullDurationMs`, `changedObjects`, `visibleObjects`
4. Procurar:
   - excesso de `renderAll`
   - invalidacao agressiva de cache
   - loops de re-layout
   - preview regeneration desnecessaria
5. Corrigir no menor ponto:
   - debounce
   - guard clause
   - memo/cache
   - lazy refresh

## Trilha 2: Autosave e persistencia custosos

1. Identificar o motivo do save:
   - `object:modified`
   - `global-style:*`
   - `history`
   - `lifecycle:*`
2. Conferir regras em [utils/editorSavePolicy.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/editorSavePolicy.ts).
3. Medir:
   - frequencia de save
   - tamanho do payload
   - tempo ate thumbnail
   - quantas vezes salva sem mudanca real
4. Corrigir:
   - coalesce delay
   - fingerprint short-circuit
   - skip de thumbnail
   - sync de pagina mais barata

## Trilha 3: Assets ou product-image lentos

1. Separar custo em:
   - listagem S3
   - Postgres
   - cache hit/miss
   - expansao por IA
   - busca externa
   - processamento de imagem
2. Conferir se o fluxo ja tem cache.
3. Corrigir primeiro o maior custo observavel:
   - query
   - numero de chamadas
   - memoizacao
   - lock de in-flight
   - fallback mais barato

## Trilha 4: Bundle ou chunk grandes

1. Rodar os checks do repo.
2. Localizar imports pesados ou eager.
3. Priorizar:
   - lazy imports
   - dynamic components
   - evitar puxar libs pesadas no client desnecessariamente
   - reduzir duplicacao entre rotas
4. Revalidar com o mesmo script.

## Formato de diagnostico recomendado

1. Sintoma observado
2. Passo de reproducao
3. Baseline numerica
4. Arquivo ou modulo hotspot
5. Hipotese principal
6. Mudanca minima sugerida
7. Como medir depois
