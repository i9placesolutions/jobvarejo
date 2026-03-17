# Sistema de Historico (Undo/Redo)

## Arquitetura

Stack linear de JSON strings com indice ponteiro.

```
historyStack: string[]  // max 50 entradas
historyIndex: number    // posicao atual
```

## Arquivos

| Arquivo | Funcao |
|---------|--------|
| `editorHistoryState.ts` | appendHistoryEntry (stack management) |
| `editorHistoryListeners.ts` | registerHistorySaveListeners (canvas events) |
| `editorHistoryNavigation.ts` | parseHistoryStateJson, findPreparedNonEmptyHistoryState |
| `editorHistoryApply.ts` | applyHistoryStateToCanvas (full pipeline) |

## Captura de estado

`registerHistorySaveListeners()` registra handlers em:
- `object:added`
- `object:modified`
- `object:removed`

Cada handler:
1. Invalida cache de scrollbar bounds e containment zones
2. Chama `invokeSaveStateSafely()` (a menos que esteja em bulk mutation ou processando historico)
3. Cascade delete: remover zone remove seus cards filhos

## Append

`appendHistoryEntry()`:
1. Dedup contra entrada atual (string equality)
2. Trunca entradas futuras se indice nao esta no head
3. Enforce `maxEntries` (50)
4. Retorna `{ didAppend, historyStack, historyIndex }`

## Navegacao (Undo/Redo)

`findPreparedNonEmptyHistoryState()`:
- Caminha no stack na direcao dada (-1 undo, +1 redo)
- Pula estados vazios
- Retorna `{ index, state }` do primeiro estado preparado nao-vazio

## Aplicacao

`applyHistoryStateToCanvas()`:
1. Salva viewport transform atual
2. Desabilita `renderOnAddRemove` (performance)
3. `loadFromJsonSafe(state)` - carrega JSON no canvas
4. `sanitizeAllClipPaths()` - limpa clipPaths invalidos
5. `rehydrateCanvasZones()` - recria runtime state das zones
6. `repairZoneCardsAfterHistoryRestore()` - reconecta cards a zones
7. Restaura viewport (salvo, atual, ou zoom-to-fit fallback)
8. Limpa Fabric font cache
9. Recalcula dimensoes de texto (`initDimensions()`)
10. Descarta selecao ativa
11. Fallback: carrega state da pagina se loadFromJSON produziu 0 objetos

## Product Zone Undo/Redo

Separado do canvas, em `useProductZone.ts`:
- Stack proprio de 50 entradas
- Throttle de 400ms
- JSON serializado do estado de produtos e configuracao da zone

## Pausas no historico

O historico e pausado durante:
- Bulk product mutations (importar lista de produtos)
- Processamento de historico (undo/redo em andamento)
- Flags: `isHistoryProcessing`, `isBulkProductMutation`
