# Diagnostico do Editor - 2026-02-17

## Resumo executivo
O app esta funcional e buildavel, mas o nucleo do editor ainda concentra complexidade excessiva em poucos arquivos, o que aumenta risco de regressao e dificulta manutencao.

## Metricas atuais (codigo local)
- `components/EditorCanvas.vue`: 30.049 linhas
- `components/LabelTemplateMiniEditor.vue`: 4.768 linhas
- `components/ProductReviewModal.vue`: 1.548 linhas
- `composables/useProject.ts`: 1.037 linhas
- `composables/useProductLayout.ts`: 649 linhas
- `composables/useProductProcessor.ts`: 461 linhas

### Indicadores de tipagem fraca (ocorrencias de `any`/`as any`/`@ts-ignore`)
- `components/EditorCanvas.vue`: 2.326
- `components/LabelTemplateMiniEditor.vue`: 230
- `components/ProductReviewModal.vue`: 34
- `composables/useProject.ts`: 33
- `composables/useProductLayout.ts`: 30
- `composables/useProductProcessor.ts`: 13

## Melhorias ja aplicadas nesta rodada

### 1) Correcao de bug de ciclo de vida no editor
- Corrigido timer de coalescencia de `saveState` que podia disparar apos unmount.
- Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz risco de persistencia tardia e estado inconsistente na navegacao/fechamento.

### 2) Refatoracao do endpoint de processamento de imagens
- Extraida logica de matching/fuzzy para util dedicado:
  - `server/utils/product-image-matching.ts`
- Extraido pipeline de processamento/upload/cache para util dedicado:
  - `server/utils/product-image-pipeline.ts`
- Endpoint principal reduzido para orquestracao:
  - `server/api/process-product-image.post.ts` (agora 329 linhas)

### 3) Ajustes de robustez de matching
- Inclusao de variante `lactose` na validacao de produto para reduzir falso positivo em fuzzy match.
- Arquivo: `server/utils/product-image-matching.ts`

### 4) Contrato de resposta mais consistente
- `ProcessProductImageResponse.url` atualizado para aceitar `null`.
- Remocao de `url: null as any` no endpoint.

### 5) Modularizacao incremental do save-state do editor
- Extraida preparacao pre-serializacao (normalizacao de frames, ids persistentes e limpeza de `clipPath` de zonas):
  - `utils/editorCanvasPreSerialize.ts`
- Extraida geracao de thumbnail offscreen com sanitizacao recursiva de `clipPath`/`_frameClipOwner`:
  - `utils/editorThumbnail.ts`
- `components/EditorCanvas.vue` atualizado para orquestrar via helpers, com reducao de bloco inline no `setupHistory/saveState`.
- Remocao de variavel morta (`missingFramesLogged`) sem referencias.

### 6) Consolidacao da persistencia de pagina no save-state
- Extraida a sincronizacao do JSON com o store (update, fingerprint, autosave e validacao de contagem) para helper dedicado:
  - `utils/editorPagePersistence.ts`
- Centralizada a regra de janela minima para geracao de thumbnail:
  - `utils/editorSavePolicy.ts` (`canGenerateThumbnailNow`)
- `components/EditorCanvas.vue` simplificado para orquestracao desse fluxo.

### 7) Lookup de pagina por id centralizado
- Extraido helper reutilizavel para resolver indice de pagina por `id` com fast-path da pagina ativa:
  - `utils/editorPageLookup.ts`
- Aplicado no fluxo de recovery (`recoverLatestNonEmptyForActivePage`) e no `saveState`.

### 8) Correcao de historico (redo) + hardening de listeners
- Corrigido bug em que o `redo` podia ser descartado mesmo sem nova entrada valida no historico.
  - Implementado append atomico de historico em `utils/editorHistoryState.ts`.
- `saveState` agora usa append atomico (`appendHistoryEntry`) para somente truncar `redo` quando houver novo snapshot persistido.
- Adicionado teardown explicito dos listeners de historico (`object:added/modified/removed`) para evitar duplicidade caso `setupHistory` seja reinvocado.

### 9) Unificacao de fluxo de undo/redo + rollback seguro de indice
- Consolidada a rotina de restauracao de snapshot de historico em funcao compartilhada (`applyHistoryNavigation`) no `EditorCanvas`.
- Eliminada duplicacao entre blocos de `undo` e `redo` para:
  - validacao do estado,
  - fallback para estado nao-vazio,
  - restauracao de viewport,
  - reparos pos-load,
  - refresh reativo do canvas.
- Correcao de robustez: quando a restauracao falha (estado invalido/erro de load), o indice de historico volta ao valor anterior para nao "consumir" uma entrada invalida.

### 10) Extracao de helpers puros de navegacao do historico
- Movidos helpers de parse/preparo/busca de estado nao-vazio para:
  - `utils/editorHistoryNavigation.ts`
- `EditorCanvas` passou a consumir esses helpers por injecao de `prepareCanvasDataForLoad`, reduzindo logica utilitaria inline e mantendo o comportamento existente.

### 11) Extracao dos listeners de historico para util dedicado
- Movido o bloco de handlers `object:added/modified/removed` para:
  - `utils/editorHistoryListeners.ts`
- `setupHistory` no `EditorCanvas` agora registra/limpa listeners por uma chamada unica (`registerHistorySaveListeners`), reduzindo acoplamento e tamanho do bloco local.
- Mantido comportamento de cascade delete de cards vinculados a zonas e debounce de persistencia sem alteracao funcional.

### 12) Hardening adicional do append de historico
- Ajustado `appendHistoryEntry` para normalizar `historyIndex` fora de faixa antes de qualquer comparacao/append.
  - Arquivo: `utils/editorHistoryState.ts`
- Impacto: evita propagacao de indice invalido em cenarios de corrupcao parcial de estado (ex.: indice legado > tamanho do stack), reduzindo chance de falha silenciosa em undo/redo.

### 13) Correcao de leak de memoria na exportacao
- `downloadFile` agora libera `blob:` URL apos o click (`URL.revokeObjectURL`) com atraso curto de seguranca.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: evita crescimento de memoria em sessoes longas com exportacoes repetidas.

### 14) Remocao de `alert()` bloqueante no EditorCanvas
- Substituido `alert()` por notificacao nao-bloqueante via toast no fluxo do editor (`notifyEditorError`/`notifyEditorInfo`).
  - Arquivo: `components/EditorCanvas.vue`
- `aiToast` ampliado para suportar `info` alem de `success`/`error`.
- Impacto: elimina interrupcao modal da UI em fluxos criticos (export/share/remocao de fundo/produto), mantendo feedback ao usuario.

### 15) Correcao de fallback silencioso em export/share por frame selecionado
- Ajustado `performExport` para nao cair no export do canvas inteiro quando `exportScope === 'selected-frame'` sem `selectedFrameId` valido.
- Ajustado `performShare` para nao cair no share do canvas inteiro quando `shareScope === 'selected-frame'` sem selecao valida.
- Em ambos os casos, o usuario agora recebe feedback explicito via toast `info`.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: evita saida inesperada (canvas completo) quando o usuario escolheu fluxo de frame especifico.

### 16) Hardening de falha no preparo de arquivo para Web Share
- `shareFile` agora trata excecoes do `fetch(dataURL)`/blob conversion e retorna `false` em falha controlada.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: evita quebra do fluxo de compartilhamento quando a conversao do arquivo falha, mantendo fallback de download.

### 17) Extracao do transporte de arquivo (export/share)
- Movidas funcoes de transferencia de arquivo para util dedicado:
  - `utils/editorFileTransfer.ts`
  - `downloadFile`
  - `downloadMultipleFiles`
  - `shareFileFromDataUrl`
- `EditorCanvas` passou a consumir essas funcoes por import, removendo implementacao inline.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz acoplamento no modulo do editor e centraliza regras de download/share/revoke de blob URL em um unico ponto.

### 18) Extracao de snapshot/metadata de selecao para util dedicado
- Movidos helpers de selecao e rich-text para:
  - `utils/editorSelectionSnapshot.ts`
  - `isTextStyleObject`
  - `TEXT_OBJECT_STYLE_PROPS`
  - `TEXT_SELECTION_STYLE_PROPS`
  - `getTextSelectionRange`
  - `snapshotForPropertiesPanel`
- `EditorCanvas` passou a importar esses helpers, removendo bloco local extenso e acoplado.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz tamanho do monolito do editor e centraliza regras de snapshot/metadata usadas pelo `PropertiesPanel`.

### 19) Extracao de runtime de selecao (refresh/toolbar/zone-config)
- Movidos helpers de runtime de selecao para:
  - `utils/editorSelectionRuntime.ts`
  - `refreshSelectedRefWithRecovery`
  - `syncSelectionCoords`
  - `ensureActiveZoneFlagsForSelection`
  - `shouldShowPenContextualToolbar`
  - `getSelectedObjectFloatingPos`
  - `buildZoneSelectionConfig`
- `EditorCanvas` passou a consumir esses helpers no fluxo de `refreshSelectedRef` e `updateSelection`.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz acoplamento do fluxo de selecao e facilita evolucao/testes do comportamento de selecao sem tocar no monolito inteiro.

### 20) Extracao da sincronizacao de estado de dominio da selecao (zona/card)
- Movido bloco de sincronizacao de selecao (estado da zona e estilos da zona pai do card selecionado, incluindo trigger de recovery de imagem ausente) para helper dedicado:
  - `syncSelectionDomainState` em `utils/editorSelectionRuntime.ts`
- `updateSelection` no `EditorCanvas` agora delega esse trecho para uma chamada unica, reduzindo ramificacao inline.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: simplifica o fluxo de `updateSelection` e reduz risco de regressao ao evoluir regras de zona/card.

### 21) Extracao da derivacao do estado de UI da selecao
- Movida derivacao de estado de UI da selecao (id selecionado, snapshot para `PropertiesPanel` e estado da toolbar contextual da caneta) para helper dedicado:
  - `deriveSelectionUiState` em `utils/editorSelectionRuntime.ts`
- `updateSelection` no `EditorCanvas` agora consome esse helper em vez de montar o estado inline.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz duplicacao no fluxo de selecao e deixa o `updateSelection` mais declarativo.

### 22) Extracao das operacoes de texto da selecao
- Movidas operacoes de edicao de texto para util dedicado:
  - `utils/editorSelectionTextOps.ts`
  - `replaceObjectInContext`
  - `convertStaticTextToIText`
  - `applySelectionTextStyle`
- `EditorCanvas` passou a chamar essas operacoes por import, mantendo a orquestracao local.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz bloco de logica de rich-text no monolito e centraliza regras de conversao/estilo de texto selecionado.

### 23) Extracao da montagem de payload de sincronizacao da selecao
- Criado helper unico para preparar sincronizacao de selecao:
  - `buildSelectionSyncPayload` em `utils/editorSelectionRuntime.ts`
- O helper encapsula:
  - leitura de `active` no canvas,
  - refresh de coords (`setCoords`),
  - aplicacao de flags/sanity para zona selecionada,
  - derivacao do estado de UI da selecao,
  - calculo da posicao flutuante do objeto selecionado.
- `updateSelection` em `EditorCanvas` agora delega esse trecho para uma chamada unica e aplica o payload retornado.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto: reduz ramificacao local em `updateSelection` e concentra regras de sincronizacao de selecao em um unico ponto testavel.

### 24) Correcao de leak de memoria no preview do modal de IA
- `AiImageStudioModal` agora revoga `objectURL` de preview ao:
  - trocar arquivo base,
  - resetar/fechar modal,
  - desmontar componente.
- Implementado ciclo explicito de `createObjectURL`/`revokeObjectURL` para o preview local.
  - Arquivo: `components/AiImageStudioModal.vue`
- Impacto: evita vazamento de memoria em sessoes longas com multiplas trocas de imagem base no fluxo de edicao por IA.

### 25) Remocao de `alert()` bloqueante no dialogo de prompt IA
- `AIPromptDialog` deixou de usar `alert()` nas validacoes de upload da imagem de referencia.
- Validacoes agora exibem feedback inline (`referenceUploadError`) sem bloquear o fluxo da UI.
  - Arquivo: `components/AIPromptDialog.vue`
- Impacto: melhora UX no fluxo de IA e evita interrupcoes modais desnecessarias durante o preenchimento do prompt.

### 26) Remocao de `alert()` bloqueante no painel de assets
- `AssetsPanel` deixou de usar `alert()` em fluxos de:
  - deletar (pasta/arquivo),
  - renomear (pasta/arquivo),
  - criar pasta,
  - mover (pasta/arquivo),
  - persistencia de pasta do upload.
- Erros agora sao exibidos no feedback inline ja existente (`uploadError`) sem bloquear a interacao.
  - Arquivo: `components/AssetsPanel.vue`
- Impacto: remove interrupcoes modais no fluxo de gerenciamento de assets e deixa erros consistentes no mesmo canal visual do painel.

### 27) Correcao critica de persistencia/layout no Mini Editor de etiqueta
- Corrigido bug de reaplicacao de template que perdia a ancora manual (`left/top`) da etiqueta:
  - `applyLabelTemplateToCard` agora preserva `left/top` apos `layoutPriceGroup` quando o template e manual/custom.
  - Arquivo: `components/EditorCanvas.vue`
- Fortalecida persistencia do Mini Editor para evitar perda apos reload:
  - `handleUpdateTemplateFromMiniEditor` agora salva estado com `skipCoalesce` e executa `flushAutoSave()` apos re-aplicar o template nas zonas.
  - Arquivo: `components/EditorCanvas.vue`
- Ajustada classificacao de variante para valores com 3 digitos inteiros (ex: `129,99`) para comportamento `large`:
  - reduz risco de sobreposicao/desalinhamento em templates com regras por variante.
  - Arquivo: `components/EditorCanvas.vue`
- Impacto esperado:
  - edicoes do Mini Editor passam a se manter nos cards apos salvar/recarregar,
  - menor incidencia de desorganizacao visual nos valores maiores.

### 28) Correcao de alinhamento do cifrao em etiqueta com circulo amarelo
- Ajustado o fitting manual de etiqueta simples para:
  - fixar o texto de moeda (`R$`) no centro do circulo de moeda quando o template possui `price_currency_bg`,
  - evitar encolher o `R$` junto com os numeros (somente a cadeia numerica passa por fit),
  - impedir sobreposicao entre circulo/cifrao e valor em precos longos (`126,99`, `129,99`).
- Arquivo: `components/EditorCanvas.vue` (funcao `fitManualSinglePriceValuesIntoTemplate`).
- Impacto esperado:
  - `R$` consistente em todas as etiquetas desse modelo,
  - melhoria visual uniforme entre valores curtos e longos.

### 29) Correcao de preview quebrado dos modelos apos reload
- Ajustado `renderLabelTemplatePreview` para sempre executar `layoutPriceGroup` na instancia de preview:
  - evita thumbnails minúsculos/deslocados em templates manuais apos recarregar.
- Adicionado controle de versao de render de preview (`LABEL_TEMPLATE_PREVIEW_RENDER_VERSION`) e refresh automatico em `ensureLabelTemplatesReady`:
  - se o preview estiver ausente ou com versao antiga, ele e regenerado.
- Arquivo: `components/EditorCanvas.vue`
- Impacto esperado:
  - cards de modelos (Atacarejo, Vermelho Explosao, Oferta etc.) deixam de voltar quebrados visualmente no modal apos reload.

### 30) Correcao de regressao no merge de templates (DB x override local)
- Identificada causa de "salvei e no reload voltou":
  - no merge entre templates vindos do banco e templates salvos no `canvasData` da pagina, o template do banco podia sobrescrever o override local.
- Ajustes aplicados:
  - `hydrateLabelTemplatesFromProjectJson`: agora prioriza entrada com `__localOverride` (projeto como source-of-truth).
  - `loadLabelTemplatesFromDb`: agora nunca sobrescreve override local existente com versao do banco.
- Arquivo: `components/EditorCanvas.vue`
- Impacto esperado:
  - edicoes dos 3 modelos permanecem apos recarregar a pagina/projeto.

### 31) Endurecimento extra de persistencia do Mini Editor (reload imediato)
- Corrigido merge de snapshots locais entre paginas para evitar que um override antigo com `__localOverride=true` sobrescreva outro mais novo:
  - nova regra compara tier (local x nao-local) e, dentro do mesmo tier, usa timestamp mais recente.
  - Arquivo: `components/EditorCanvas.vue` (`shouldUseIncomingTemplateSnapshot` + `hydrateLabelTemplatesFromProjectJson`).
- Fluxo de save do Mini Editor nao interrompe mais persistencia do projeto quando o upsert da biblioteca falha:
  - remove retorno antecipado em `handleUpdateTemplateFromMiniEditor` apos falha no endpoint de `label-templates`.
  - Arquivo: `components/EditorCanvas.vue`.
- `flushAutoSave` fortalecido para durabilidade:
  - agora aguarda save em andamento finalizar (`waitForSaveIdle`) e executa flush real antes de retornar.
  - Arquivo: `composables/useProject.ts`.
- Impacto esperado:
  - menor chance de "salvei e recarreguei, voltou tudo",
  - melhor consistencia quando ha save concorrente em andamento.

## Validacao
- `npm run check`: **passando**
- Maior chunk client: **479KB** (limite: 500KB)
- `nuxt typecheck`: nao finalizado por indisponibilidade de rede para baixar `typescript` (`ENOTFOUND registry.npmjs.org`)

## Principais riscos remanescentes
1. Monolito de logica em `EditorCanvas.vue` (eventos, persistencia, historico, renderizacao, zonas, import/export no mesmo arquivo).
2. Cobertura de tipos muito baixa no nucleo de edicao.
3. Alto numero de caminhos criticos marcados como "CRITICAL" no codigo, sinalizando historico de regressao.
4. Poucos testes automatizados para fluxos de editor (undo/redo, troca de pagina, persistencia, produto/zone).

## Plano recomendado (ordem de execucao)
1. Quebrar `EditorCanvas.vue` em modulos sem mudar comportamento:
   - `editor-history`, `editor-selection`, `editor-snapping`, `editor-zones`, `editor-clipboard`.
2. Tipar fronteiras publicas do editor:
   - payload de save/load, tipo de objeto serializado, eventos de toolbar/sidebar.
3. Criar testes de regressao dos fluxos criticos:
   - troca de pagina + autosave, undo/redo, importacao de template, produto com zonas.
4. Reduzir uso de `any` progressivamente com alvo inicial de 30% no nucleo.

## Criterios de pronto por fase
- Fase 1: build ok + funcionalidades atuais preservadas + diff sem regressao visual obvia.
- Fase 2: typecheck sem erros novos e reducao mensuravel de `any`.
- Fase 3: suite de regressao minima cobrindo fluxos criticos do editor.
