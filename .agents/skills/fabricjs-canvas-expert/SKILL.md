---
name: fabricjs-canvas-expert
description: "Especialista no editor Fabric.js 7 do JobVarejo. Use quando Codex precisar criar ou modificar objetos no canvas, serializacao/deserializacao, undo/redo, export PNG/PDF, multi-pagina, selecao, product zones, frames, clipping, sticker outline, thumbnails, monkey-patches, eventos de canvas, ou resolver bugs visuais e de persistencia do editor."
---

# Fabric.js Canvas Expert

## Objetivo

Operar sobre o nucleo visual do JobVarejo: o editor baseado em Fabric.js 7.1.0.
O editor esta concentrado em `EditorCanvas.vue` (37K linhas) e ~20 arquivos utils/composables auxiliares.
Preservar a estabilidade do editor e entender que qualquer mudanca tem risco de regressao.

## Inicio rapido

1. Ler o arquivo alvo e [references/canvas-architecture.md](references/canvas-architecture.md).
2. Classificar o pedido:
   - Objeto/visual: ler [references/object-model.md](references/object-model.md).
   - Serializacao/persistencia: ler [references/serialization-pipeline.md](references/serialization-pipeline.md).
   - Historico/undo: ler [references/history-system.md](references/history-system.md).
3. Validar que a mudanca nao quebra serializacao, undo/redo ou export.

## Regras de operacao

- `EditorCanvas.vue` e area de ALTO RISCO. Mudancas grandes requerem cautela extrema.
- NAO criar classes custom Fabric via `classRegistry`. O projeto usa runtime property flags em objetos standard.
- Toda propriedade custom deve ser adicionada a `CANVAS_CUSTOM_PROPS` para ser persistida.
- Monkey-patches em prototipos Fabric sao feitos no `onMounted`. Documentar o motivo.
- Nao desabilitar `preserveObjectStacking`, `subTargetCheck` ou `enableRetinaScaling` sem entender o impacto.
- Serializacao sempre passa por pre-serialize -> toObject -> finalize. Nao pular etapas.
- URLs de imagem sao normalizadas para `__originalSrc` na serializacao. Nunca persistir presigned/blob URLs.
- Zones usam clipPath em runtime que e removido antes de serializar.
- Sticker outline e um patch de `drawObject` que desabilita `objectCaching`. Cuidado com performance.
- Export usa multiplier ladder com fallback para canvases grandes (max 16384px / 140M pixels).

## Trilhas de uso

### Adicionar ou modificar objeto no canvas

1. Identificar o tipo Fabric correto (Rect, Text, Textbox, Image, Group, Path, etc).
2. Definir propriedades custom necessarias e adicionar a `CANVAS_CUSTOM_PROPS`.
3. Garantir que o objeto serializa e deserializa corretamente.
4. Testar undo/redo apos a mudanca.
5. Verificar se export funciona (nao bloqueia render).

### Modificar serializacao/persistencia

1. Ler o pipeline completo em [references/serialization-pipeline.md](references/serialization-pipeline.md).
2. Nao modificar `toObject()` diretamente. Usar os hooks de pre/post serializacao.
3. Normalizar URLs de imagem via `normalizePersistedImageUrls`.
4. Testar: salvar -> recarregar -> verificar integridade.

### Modificar undo/redo

1. Ler [references/history-system.md](references/history-system.md).
2. O historico e um stack de JSON strings com indice.
3. Aplicar estado via `applyHistoryStateToCanvas` que sanitiza clipPaths e reidrata zones.
4. Cuidado com bulk product mutations que pausam o historico.

### Modificar export

1. O pipeline usa multiplier ladder: tenta resolucao alta, fallback para mais baixa.
2. PDF usa pdf-lib com conversao px -> pt a 300 DPI.
3. ZIP usa fflate nivel 6.
4. Thumbnails sao gerados offline a 0.1x multiplier, JPEG 50%.

## Entregas obrigatorias

### Para mudancas de codigo

1. Tipo Fabric afetado
2. Custom props adicionadas/modificadas
3. Impacto em serializacao
4. Impacto em undo/redo
5. Impacto em export
6. Como validar (abrir editor, criar objeto, salvar, recarregar, undo, export)

### Para analise sem codigo

1. Diagnostico visual/funcional
2. Arquivo e funcao provavel
3. Risco de regressao
4. Acao recomendada

## Referencias

- [references/canvas-architecture.md](references/canvas-architecture.md): estrutura do editor e arquivos.
- [references/object-model.md](references/object-model.md): tipos de objeto, custom props e flags.
- [references/serialization-pipeline.md](references/serialization-pipeline.md): pipeline de save/load.
- [references/history-system.md](references/history-system.md): undo/redo e navegacao de historico.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual tipo Fabric foi afetado
- se a serializacao foi preservada
- se undo/redo continua funcional
- se export nao quebrou
- como validar visualmente no editor
