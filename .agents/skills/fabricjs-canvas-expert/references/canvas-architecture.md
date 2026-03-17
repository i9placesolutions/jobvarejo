# Arquitetura do Editor Canvas

## Arquivos principais

| Arquivo | Linhas | Funcao |
|---------|--------|--------|
| `components/EditorCanvas.vue` | 37,297 | Componente monolitico do editor |
| `utils/editorCanvasState.ts` | 142 | Fingerprint e viewport |
| `utils/editorCanvasPreSerialize.ts` | 72 | Pre-processamento antes de JSON |
| `utils/editorCanvasSerialize.ts` | 205 | Pos-serializacao e cleanup |
| `utils/editorHistoryState.ts` | 64 | Stack de historico |
| `utils/editorHistoryListeners.ts` | 120 | Listeners de save no historico |
| `utils/editorHistoryNavigation.ts` | 53 | Navegacao undo/redo |
| `utils/editorHistoryApply.ts` | 121 | Aplicacao de estado do historico |
| `utils/editorPageLookup.ts` | 20 | Busca de pagina por ID |
| `utils/editorPagePersistence.ts` | 78 | Persistencia por pagina |
| `utils/editorSavePolicy.ts` | 81 | Politica de quando salvar |
| `utils/editorExportPipeline.ts` | 265 | Export PNG/PDF/ZIP |
| `utils/editorFileTransfer.ts` | 121 | Download e share |
| `utils/editorThumbnail.ts` | 68 | Geracao de thumbnails |
| `utils/editorSelectionRuntime.ts` | 255 | Sync de selecao |
| `utils/editorSelectionSnapshot.ts` | 186 | Snapshot para painel props |
| `utils/editorSelectionTextOps.ts` | 174 | Operacoes de texto |
| `utils/canvasAssetUrls.ts` | 171 | Normalizacao de URLs |
| `composables/useProject.ts` | 1,816 | Estado do projeto e persistencia |
| `composables/useProductLayout.ts` | 649 | Criacao de cards de produto |
| `composables/useProductZone.ts` | 722 | Estado da zona de produto |
| `utils/product-zone-helpers.ts` | 659 | Calculo de grid |
| `utils/product-zone-diagnostics.ts` | 163 | Diagnostico de zonas |
| `utils/storageProxy.ts` | 267 | Proxy URLs Wasabi |

## Inicializacao do Canvas

No `onMounted` do EditorCanvas.vue:
1. Importa Fabric dinamicamente
2. Aplica monkey-patches (clipPath hardening, render safety)
3. Cria `fabric.Canvas` com config:
   - `preserveObjectStacking: true`
   - `subTargetCheck: true`
   - `enableRetinaScaling: true`
   - `selectionKey: null` (selecao custom)
4. Registra 40+ event handlers
5. Inicia watch de projeto/pagina
6. Carrega JSON inicial

## Ref principal

```ts
const canvas = shallowRef<fabric.Canvas | null>(null)
```

## Monkey-Patches aplicados

1. `_drawClipPath` context hardening - previne crash quando layerContext tem campos faltando
2. `patchCanvasRenderSafety` - wrapa renderAll/requestRenderAll com try-catch e purge de objetos invalidos
3. `findTarget` override - prefere product card groups no hit-testing
4. Touch tuning - aumenta touchCornerSize e targetFindTolerance

## Eventos registrados (~40+)

### Canvas events
- mouse:down, mouse:move, mouse:up, mouse:wheel, mouse:dblclick, mouse:out
- object:added, object:removed, object:modified, object:moving, object:scaling, object:rotating
- selection:created, selection:updated, selection:cleared
- text:selection:changed, text:editing:entered, text:editing:exited, text:changed
- after:render

### DOM events
- keydown, keyup (shortcuts: Ctrl+Z/Y, Delete, Ctrl+C/V, arrows)
- mouseup, pointerup, blur (release transforms)
- resize + ResizeObserver
- touch events (touchstart, touchmove, touchend, touchcancel)

## Cleanup no onUnmounted

- Dispose do canvas
- Remove todos event listeners globais
- Flush persistencia pendente
- Limpa timers, observers, RAF ids
