# Relatório de Performance do Editor JobVarejo — Abril 2026

## Resumo Executivo

O editor está funcional e buildável, mas acumula **20 gargalos de performance** distribuídos em 5 áreas: renderização, autosave/persistência, undo/redo, product zones e exportação. Os problemas mais críticos estão no caminho quente de renderização (`after:render` handlers redundantes), no consumo de memória do history stack (~80MB), e no pipeline de exportação que dobra o pico de memória.

---

## Linha do Tempo do Diagnóstico

| Métrica | Fev/2026 | Abr/2026 | Delta |
|---------|----------|----------|-------|
| Linhas `EditorCanvas.vue` | 30.049 | ~40.938 | +36% |
| Linhas `useProject.ts` | 1.037 | ~1.816 | +75% |
| Maior chunk client (gzip) | 213 KB | ~213 KB | estável |
| `any`/`as any`/`@ts-ignore` no EditorCanvas | 2.326 | estimado >2.800 | +20% |
| Entradas de history | 50 | 50 | estável |
| Arquivos utils extraídos do monolito | 0 | 20+ | — |

O editor cresceu ~36% desde fevereiro, mas as extrações para utils e a bridge de performance (`window.__editorPerf`) são pontos positivos.

---

## 1. Renderização e Viewport (5 gargalos)

### 1.1 `after:render` handlers executam trabalho pesado em TODO frame [ALTA]

Os 3 handlers de `after:render` executam a cada frame (60x/s):

| Handler | Custo | Problema |
|---------|-------|----------|
| `throttledUpdateScrollbars` | `getBoundingRect(true,true)` em todos objetos | Mesmo cálculo do viewport culling, sem gate de objeto mínimo |
| `afterRenderFrameLabels` | Manipulação de DOM overlay | Cria/atualiza elementos HTML sobre o canvas |
| `handleAfterRenderPerf` | Cálculo de delta-time FPS | Leve, mas é +1 handler |

**Impacto**: Para um canvas com 300 objetos, `updateScrollbars` varre 300 objetos chamando `getBoundingRect(true,true)` (recursivo em grupos). Isso sozinho pode consumir 2-5ms por frame.

**Recomendação**: Consolidar os 3 handlers em um único com early-exit baseado em dirty flags. Compartilhar cache de bounds entre viewport culling e scrollbars.

### 1.2 `getBoundingRect(true, true)` chamado redundantemente [ALTA]

Tanto o viewport culling quanto o `updateScrollbars` chamam `getBoundingRect(true, true)` em todos os objetos. Para objetos dentro de grupos, esse cálculo é recursivo e caro.

**Impacto**: O mesmo cálculo de bounds é feito **duas vezes por frame**, duplicando o custo O(n).

**Recomendação**: Criar um cache de bounds por frame (Map<objectId, BoundingRect>) compartilhado entre culling e scrollbars. Invalidar no início de cada frame.

### 1.3 `purgeInvalidRecursive` sem circuit breaker [MÉDIA]

O monkey patch `patchCanvasRenderSafety` (linha ~392-549) varre recursivamente todos objetos filtrando inválidos quando um erro de render ocorre. É O(n*m) e síncrono.

**Impacto**: Se um objeto corrompido disparar recovery toda frame, o FPS cai drasticamente. Não há limite de tentativas.

**Recomendação**: Adicionar circuit breaker — máximo 1 recovery a cada 2 segundos.

### 1.4 `findTarget` monkey patch com segunda passada O(n) [MÉDIA]

A cada `mouse:down`, após o `findTarget` nativo do Fabric, há fallback iterando `getObjects()` reverso com `containsPoint` e `getBoundingRect`.

**Impacto**: Em canvas com 2000+ objetos, adiciona 1-3ms por clique.

**Recomendação**: Limitar o fallback a executar apenas quando o Fabric nativo retorna null ou targetIsZone, evitando a segunda varredura completa.

### 1.5 Culling seta `dirty = true` em todos objetos alterados [BAIXA-MÉDIA]

Cada objeto culled/restaurado tem `dirty = true` setado, forçando `setCoords` e cache de render. Com centenas de objetos alterados por pan, o overhead acumula.

**Recomendação**: Avaliar se `setCoords` pode ser postergado via `requestIdleCallback` para objetos culled (que não são visíveis).

---

## 2. Autosave e Persistência (5 gargalos)

### 2.1 Serialização completa no caminho quente [ALTA]

A cada ciclo de coalesced save (80-600ms após última edição), `saveState` executa:
- `canvas.toJSON([...CANVAS_CUSTOM_PROPS])` — 50-200ms para 1000+ objetos
- `computeCanvasFingerprint(json)` — segundo `JSON.stringify` completo

**Impacto**: Durante edição ativa, a cada pausa de 80ms, o main thread é ocupado por serialização.

**Recomendação**: Cache do fingerprint por página, invalidado por `__savedAt`. Evita o segundo `JSON.stringify` se a página não foi alterada.

### 2.2 Timer periódico de 90s — janela longa de perda [MÉDIA]

O único mecanismo de upload remoto durante edição é um timer de 90 segundos. Entre ciclos, edições só existem em memória + localStorage.

**Impacto**: Crash do browser pode perder até 90s de trabalho (mitigado parcialmente por drafts locais).

**Recomendação**: Reduzir para 30-45s. O upload só ocorre se `hasUnsavedChanges`, então o custo é pago apenas quando há alterações.

### 2.3 Thumbnails em PNG ao invés de JPEG [BAIXA]

`editorThumbnail.ts:82-84` gera thumbnails em PNG. Para um thumbnail de 480px, JPEG qualidade 0.75 seria ~80% menor.

**Recomendação**: Migrar para JPEG com qualidade 0.7-0.8.

### 2.4 `estimateJsonBytes` no caminho quente [BAIXA-MODERADA]

Chamado em todo coalesced save via `writeDraft`. Usa sampling (não `JSON.stringify` completo), mas o volume de chamadas é alto.

**Recomendação**: Usar `requestIdleCallback` para postergar `estimateJsonBytes`.

### 2.5 Canvas muito grandes (>2000 objetos) [BAIXA — prevenção]

`toJSON()` escala linearmente com o número de objetos. Para encartes com 2000+ objetos, a serialização pode levar 200ms+.

**Recomendação**: Monitorar. Considerar serialização incremental ou Web Worker no futuro.

---

## 3. Undo/Redo e Sistema de Histórico (5 gargalos)

### 3.1 Duas stacks de undo/redo independentes e dessincronizadas [ALTA]

O canvas Fabric.js (`editorHistoryState.ts`) e a Product Zone (`useProductZone.ts`) mantêm stacks separadas. Ctrl+Z reverte objetos Fabric mas o estado reativo da zona (`products[]`, `splashes[]`) permanece onde estava.

**Impacto**: Divergência de estado entre canvas visual e dados reativos. O `repairZoneCardsAfterHistoryRestore()` é paliativo.

**Recomendação**: Unificar as stacks. O canvas history já captura o estado completo (inclui cards renderizados). A Product Zone deveria derivar seu estado do canvas, não manter undo/redo próprio.

### 3.2 50 entradas de JSON completo = ~80MB em memória [ALTA]

Cada entrada armazena `JSON.stringify` completo do canvas (~500KB-2MB). 50 entradas = 50-100MB. A Product Zone adiciona mais 50 snapshots (~2.5-4MB).

**Impacto**: Para um projeto típico, 55-80MB só para undo/redo. Soma-se o canvas ativo e texturas, o heap facilmente ultrapassa 150MB.

**Recomendação**: Reduzir para 25 entradas. Ou comprimir entradas em memória com `CompressionStream` (já usado no upload), reduzindo 80MB para ~12-15MB.

### 3.3 Re-hidratação do canvas faz 5+ passadas O(n) [ALTA]

`applyHistoryStateToCanvas` executa: `loadFromJsonSafe` → `sanitizeAllClipPaths` → `rehydrateCanvasZones` → `repairZoneCardsAfterHistoryRestore` → `sanitizeAllClipPaths` → recalculo de texto → render.

**Impacto**: Para 200-300 objetos, undo/redo leva 115-295ms. O `rehydrateCanvasZones` é o mais caro (15-40ms).

**Recomendação**: Consolidar sanitização + reidratação em uma única passada. Remover a segunda chamada de `sanitizeAllClipPaths` (redundante após reidratação).

### 3.4 `saveState` chamado em todo evento de canvas [MÉDIA]

`object:modified` dispara `invokeSaveStateSafely` a cada pixel de arrasto (~60x/s durante drag). O coalescing mitiga, mas ~25 tentativas de save ocorrem para um arrasto de 2 segundos.

**Recomendação**: Adicionar guard clause early no listener — se `object:moving` está ativo, não agendar novo coalesced save até o movimento terminar.

### 3.5 `calculateGridLayout` chamado 2-3x em cascata por mutação [BAIXA-MODERADA]

Em `addProduct`, o grid é computado via `gridLayout.value` (computed) + `recalculateLayout()` que recalcula de novo.

**Recomendação**: Pular o primeiro cálculo. Usar apenas `recalculateLayout()` para posicionamento.

---

## 4. Exportação (5 gargalos)

### 4.1 `makeExportColorsVivid` dobra pico de memória [ALTA]

Após `toDataURL` (já ~124MB como base64 para 4x), a função desenha em canvas offscreen adicional para filtros CSS, criando segunda cópia integral dos pixels (~93MB buffer RGBA).

**Impacto**: Pico de ~217MB só nesse passo. Risco de OOM em dispositivos com pouca RAM.

**Recomendação**: Aplicar filtros via `filter` nativo do Fabric.js no próprio canvas antes do `toDataURL`, ou usar CSS `filter` no elemento canvas.

### 4.2 Multiplier ladder tenta até 6 resoluções [ALTA]

Para preset `ultra-600`, o ladder é `[4, 3.4, 2.88, 2.4, 2, 1]`. Cada tentativa chama `toDataURL` — operação cara com alocação de textura GPU e renderização completa.

**Impacto**: No pior caso, 6 renderizações caras com alocações progressivamente menores. Pode ultrapassar 30 segundos.

**Recomendação**: Reduzir para 3 degraus: `[safeStart * 0.5, safeStart * 0.25, 1]`. Ou detectar capacidade real do dispositivo.

### 4.3 `buildZipBlob` mantém todos blobs em memória simultaneamente [ALTA]

Todos os ArrayBuffers são acumulados em `entries: Record<string, Uint8Array>` antes da compressão.

**Impacto**: Para 10 frames a 4x (~8MB cada), pico de ~155MB.

**Recomendação**: Processar em batches de 3-5 frames.

### 4.4 `dataUrlToBlob` mantém base64 + ArrayBuffer simultaneamente [MÉDIA]

A string base64 (+33% vs binário) e o ArrayBuffer coexistem durante a conversão.

**Impacto**: Para 93MB raw, a string base64 ocupa ~124MB extra.

**Recomendação**: Usar `canvas.toBlob()` diretamente (retorna Blob sem passar por base64) quando disponível.

### 4.5 `toDataURL` a 4x limitado pela GPU [MÉDIA]

4320x5400 = 23.3M pixels = ~93MB framebuffer GPU. Muitos dispositivos mobile têm limite de textura em 4096px.

**Recomendação**: Detectar `maxTextureSize` via `gl.getParameter(gl.MAX_TEXTURE_SIZE)` e ajustar teto dinamicamente.

---

## 5. Bundle e Dependências

| Chunk | Raw | Gzip | Conteúdo provável |
|-------|-----|------|-------------------|
| `vendor-fabric` | 717 KB | 213 KB | Fabric.js 7 — inevitável |
| `vendor-icons` | 435 KB | 180 KB | lucide-vue-next — suspeito |
| `editor-canvas` | 308-309 KB | 81-94 KB | Editor principal |

### Recomendações de bundle:

1. **Auditar `lucide-vue-next`** — 435KB para ícones é excessivo. Verificar tree-shaking do Vite. Possível causa: importação dinâmica onde o bundler não consegue determinar quais ícones são usados.

2. **Garantir `pdf2json` e `xlsx` como lazy-load** — Se estiverem no bundle client (e não apenas server), movê-los para `await import()`.

3. **Considerar substituir `lucide-vue-next` por `@iconify/vue`** — ícones carregados sob demanda, sem bundle upfront.

---

## Resumo de Recomendações por Prioridade

### Prioridade Crítica (ganho alto, risco baixo)

| # | Gargalo | Ação | Ganho estimado |
|---|---------|------|----------------|
| 1 | `after:render` handlers redundantes | Consolidar 3 handlers em 1, cache de bounds compartilhado | -2-5ms/frame |
| 2 | History stack ~80MB memória | Reduzir de 50 para 25 entradas | -25-40MB heap |
| 3 | Duas stacks undo/redo | Unificar — zona derivar do canvas | -4MB + elimina bugs de dessincronização |
| 4 | `makeExportColorsVivid` dobra memória | Usar filtro Fabric nativo ou CSS filter | -50% pico de memória no export |
| 5 | Multiplier ladder 6 níveis | Reduzir para 3 níveis | -50% tempo de export |

### Prioridade Alta (ganho moderado, risco baixo)

| # | Gargalo | Ação | Ganho estimado |
|---|---------|------|----------------|
| 6 | `getBoundingRect` chamado 2x/frame | Cache de bounds por frame | -1-3ms/frame |
| 7 | `findTarget` segunda passada O(n) | Limitar fallback a targetIsZone/null | -1-3ms/clique |
| 8 | `buildZipBlob` pico memória | Batch de 3-5 frames | -60% pico ZIP |
| 9 | `dataUrlToBlob` overhead base64 | Usar `canvas.toBlob()` | -33% memória na conversão |
| 10 | Serialização `toJSON` + fingerprint | Cache fingerprint por página | -50ms no caminho quente |

### Prioridade Média (ganho moderado, requer mais análise)

| # | Gargalo | Ação | Ganho estimado |
|---|---------|------|----------------|
| 11 | Timer periódico 90s | Reduzir para 30-45s | Menor janela de perda |
| 12 | Thumbnails PNG | Migrar para JPEG 0.75 | -80% tamanho upload |
| 13 | Re-hidratação 5 passadas O(n) | Consolidar em 2-3 passadas | -30ms por undo/redo |
| 14 | `purgeInvalidRecursive` sem circuit breaker | Máximo 1 recovery/2s | Previne FPS crash |
| 15 | `saveState` em cada event | Guard clause early no listener | -25 tentativas/drag |
| 16 | `calculateGridLayout` em cascata | Pular primeiro cálculo | -1 iteração/mutação |

### Prioridade Baixa (prevenção / longo prazo)

| # | Gargalo | Ação | Ganho estimado |
|---|---------|------|----------------|
| 17 | `vendor-icons` 435KB | Auditar tree-shaking lucide-vue-next | -200KB bundle |
| 18 | `dirty=true` em objetos culled | `requestIdleCallback` para setCoords | Micro-otimização |
| 19 | `estimateJsonBytes` no hot path | `requestIdleCallback` | Micro-otimização |
| 20 | `toDataURL` limitado por GPU | Detectar maxTextureSize dinâmico | Previne falha em mobile |

---

## O Que Já Está Bom (não mexer)

- **Render scheduler**: coalesce efetivo, único RAF por frame. Sem duplo render.
- **Viewport culling**: gate de 1200 objetos, rate-limit 140ms, signature short-circuit. Bem projetado.
- **Perf bridge** (`window.__editorPerf`): métricas relevantes, baixo overhead, `shallowRef` + commit throttled.
- **Lazy frames**: reduz objetos no load inicial em 40-70%. Enliven on-demand imperceptível.
- **Save policy**: `shouldSkipAutoSave` bloqueia uploads durante edição. Fingerprint dedup eficaz. Sem save storms.
- **Monkey patches**: escape hatches (`__patched*` flags), recoverable errors. Bem implementados.
- **Gzip compressão**: 70-80% redução de tráfego. `CompressionStream` nativa assíncrona. Melhor custo-benefício.
- **PDF/ZIP lazy imports**: `pdf-lib` e `fflate` carregados dinamicamente. Sem impacto no bundle inicial.

---

## Métricas de Referência para Validação

Após aplicar otimizações, validar com:

```bash
# Bundle
npm run build && npm run check:client-chunk

# FPS (via console no editor)
window.__editorPerf.snapshot
# Esperado: fpsAvg >= 50, cullDurationMs < 5

# Memória (via Chrome DevTools)
# Esperado: heap < 80MB para projeto típico (antes: ~150MB)

# Export
# Esperado: tempo de export 4x < 10s (antes: até 30s)
```
