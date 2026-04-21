# Analise Completa do Editor — JobVarejo

**Data:** 2026-04-21  
**Versao base:** commit mais recente ate a data  
**Arquivos analisados:** `components/EditorCanvas.vue`, `composables/useProject.ts`, `composables/useProductZone.ts`, `utils/editor*`, `nuxt.config.ts`, `package.json` e referencias de skills.

---

## 1. Resumo Executivo

O editor do JobVarejo e funcional e entrega valor, mas opera sob **divida tecnica severa**. O nucleo `EditorCanvas.vue` cresceu de ~30K linhas (fev/2026) para **~40.758 linhas** (~1,75 MB), concentrando praticamente toda a logica de canvas, produto, historico, exportacao, IA, UI mobile e clipboard em um unico componente.

**Principais achados:**
- **Chunk client de 700 KB** — acima do limite de 500 KB, com warning do Vite.
- **~3.300 ocorrencias de `any`** no nucleo do editor — tipagem inexistente na pratica.
- **~750 funcoes** no componente principal — impossivel de revisar eficientemente.
- **180 chamadas de `requestRenderAll`** sem coalescimento global — risco de cascata de renders.
- **45+ comentarios `CRITICAL`** e 6 `BUG #N` documentados — codigo altamente defensivo.
- **Monkey-patches em runtime** no Fabric.js para evitar crashes de render.

O editor funciona, mas cada mudanca tem **alto risco de regressao**. A modularizacao incremental feita em fevereiro ajudou, mas foi insuficiente para reverter a tendencia de crescimento do monolito.

---

## 2. Arquitetura e Codigo

### 2.1. Monolito EditorCanvas.vue

| Metrica | Valor |
|---------|-------|
| Total de linhas | ~40.758 |
| Script (`<script setup>`) | ~39.813 linhas (~98%) |
| Template | ~903 linhas (~2%) |
| Style | ~41 linhas |

O componente e um **God Component** que gerencia:
- Canvas Fabric.js (criacao, render, eventos, viewport)
- Historico undo/redo (orquestracao)
- Selecao e propriedades (sync com sidebar)
- Product zones e cards (layout, re-layout, importacao)
- Clipboard (copy/paste cross-tab)
- Exportacao (PNG/JPG/PDF/ZIP)
- AI Image Studio (crop, geracao, edicao)
- Pen tool (vetores, path editing)
- Mobile UI (bottom sheet, touch gestures)
- Modais e overlays (layers, project manager, etc.)

### 2.2. Inventario de Reactividade

| Tipo | Quantidade |
|------|------------|
| `ref(` | 63 |
| `shallowRef(` | 1 |
| `computed(` | 21 |
| `watch` / `watchEffect` | 28 (19 no script + watchers dinamicos) |
| Funcoes nomeadas | ~71 |
| Arrow functions | ~683 |
| **Total de funcoes** | **~754** |

### 2.3. Tipagem

| Ocorrencia | Quantidade |
|------------|------------|
| `: any` | ~1.653 |
| `as any` | ~1.626 |
| Generics `<any>` | ~30 |
| `@ts-ignore` | 0 |

**Veredito:** o TypeScript esta sendo usado como "JavaScript com sintaxe de tipos". Nao ha garantia de seguranca de tipos no nucleo mais critico do projeto.

### 2.4. Utils Extraidos (Acoplamento 1:1)

A modularizacao feita em fevereiro extraiu ~15 arquivos util (`editorHistoryState.ts`, `editorExportPipeline.ts`, etc.), mas a grande maioria e consumida **apenas por EditorCanvas.vue**. Sao "fatias do monolito", nao modulos reutilizaveis.

### 2.5. Estado Global Acoplado

`useProductZone.ts` mantem `products`, `splashes`, `productZone`, `globalStyles` como `ref`s no **top-level do modulo** (singleton). Isso:
- Impede multiplas instancias do editor
- Dificulta testes unitarios
- Cria dependencia implicita entre paginas

### 2.6. Monkey-Patches em Runtime

`patchCanvasRenderSafety` (linhas ~397-556) sobrescreve `requestRenderAll` e `renderAll` do Fabric.js para:
- Filtrar objetos invalidos antes de renderizar
- Recuperar contextos 2D perdidos
- Prevenir crashes silenciosos

Isso e **sintoma de instabilidade no pipeline de dados**, nao solucao. O codigo admite em comentario que `purgeInvalidRecursive` "e pesado e causa flickering visivel".

### 2.7. Problemas Arquiteturais Especificos

1. **God Component:** logica de domino misturada com infraestrutura de canvas.
2. **Manipulacao insegura de objetos Fabric:** propriedades customizadas (`_customId`, `_clipboardCenterX`, `_sourceGroupRef`) sao adicionadas dinamicamente sem contrato.
3. **Falta de camada de servico/store:** estado espalhado entre refs locais, refs globais de composable e propriedades dinamicas em objetos Fabric.
4. **Clipboard cross-tab via `window._clipboard`:** dependencia de estado global do navegador.

---

## 3. Performance

### 3.1. Bundle e Build

| Metrica | Valor | Limite | Status |
|---------|-------|--------|--------|
| Server bundle total | 16 MB | 250 MB | ✅ |
| Maior chunk client JS | **700 KB** (`DTuM-t9Y.js`) | 500 KB | ❌ |
| 2º maior chunk | 435 KB | — | ⚠️ |
| 3º/4º maiores | 308 KB cada | — | ⚠️ |
| Entry CSS | 196 KB (gzip 27 KB) | — | — |
| Tempo build client | ~32 s | — | — |
| Tempo build server | ~13 s | — | — |

O Vite emitiu warning explicito: `Some chunks are larger than 500 kB after minification`.

O `nuxt.config.ts` ja possui `manualChunks` separando `editor-canvas`, `vendor-fabric`, etc., mas o chunk do editor ainda estoura o limite porque `EditorCanvas.vue` em si e monolitico demais.

### 3.2. Hotspots de Render

| Padrao | Quantidade | Risco |
|--------|------------|-------|
| `renderAll` / `requestRenderAll` | **180** | Cascata de renders |
| `watch` / `watchEffect` | **28** | Re-render excessivo |
| `setTimeout` / `setInterval` / `requestAnimationFrame` | **84** | Timers concorrentes |
| Loops (`for`, `while`, `forEach`, etc.) | **842** | Densidade alta |
| `loadFromJSON` / `enlivenObjects` | **72** | Desserializacao pesada |

### 3.3. Debounce/Throttle

Nao ha biblioteca dedicada (lodash/underscore). O debounce e **manual e inconsistente**:
- 150 ms para propriedades do canvas
- 100 ms para layout de pen/path
- `requestAnimationFrame` usado como throttle em ~15 locais
- Multiplos timers independentes de salvamento

### 3.4. Gargalos Identificados

1. **Cascata de renders:** `safeRequestRenderAll` e chamado em eventos de mouse, teclado, propriedades, undo/redo, carga de pagina, culling. Nao ha coalescimento global.
2. **`loadFromJSON` com fallbacks em cascata:** em cenarios de rede instavel, o pipeline tenta ate 3 vezes (com placeholder, sem imagens, etc.), triplicando o trabalho.
3. **Recursao pesada em JSON:**
   - `regenerateCustomIdsRecursive`: percorre toda arvore Fabric incluindo clipPaths.
   - `stripClipPathsRecursively` (thumbnail): percorre JSON inteiro.
   - `remapOrClearBindingsRecursive`: similar.
4. **Thumbnail generation:** clona JSON inteiro via `JSON.parse(JSON.stringify(...))`, remove clipPaths recursivamente, carrega em `StaticCanvas` offscreen. Timeout de 10s indica operacao reconhecidamente lenta.
5. **Viewport culling:** implementado com `requestAnimationFrame` + `setTimeout`; restauracao de objetos chama `safeRequestRenderAll` + `refreshCanvasObjects` — potencial duplo render.
6. **Dupla reatividade Fabric + Vue:** eventos Fabric atualizam estado Vue, que dispara `requestRenderAll` — risco de loop.

### 3.5. Bridge de Performance

`window.__editorPerf` (linhas ~6955-7062) expoe:
- FPS instantaneo, media, min, max
- Viewport culling duration (avg/max)
- Objetos visiveis/ocultos
- Contagem total de frames

Essa bridge e util para automatizacao de testes de performance, mas indica que a equipe ja precisou de instrumentacao para diagnosticar problemas.

---

## 4. Bugs e Problemas de Funcionalidade

### 4.1. Marcadores de Debito Tecnico

| Tipo | Quantidade | Observacao |
|------|------------|------------|
| `CRITICAL` | ~45 | Validacoes obrigatorias (ex: `_objects` sempre array, rehydrate de zonas) |
| `BUG #N` | 6 documentados | Mutex de save (BUG #30), cooldown undo/redo (BUG #29), cascata delete (BUG #7), clone JSON (BUG #13) |
| `WORKAROUND` | 1 | Esperar `mouse:up` para commitar mudancas e evitar loop |
| `FIXME` / `TODO` | 0 formais | A equipe nao usa marcadores padronizados |

### 4.2. Tratamento de Erro Fraco

1. **Try/catch vazios:** varias ocorrencias em remocao de listeners, remocao de objetos em loop, sync de frame clips.
2. **`saveProject`:** se `saveCurrentState` falha, ainda chama `saveProjectDB` com dados antigos — risco de persistencia inconsistente.
3. **`performShare`:** tem `try/finally` mas **sem `catch`**. Erro no export deixa feedback de loading preso.
4. **`applyHistoryNavigation`:** `applyHistoryStateToCanvas` chamado sem try/catch. Se falhar, o canvas fica em estado parcialmente aplicado.

### 4.3. Race Conditions

| Local | Problema |
|-------|----------|
| Save state (BUG #30) | Mutex `_isSaveInProgress` existe, mas timer de coalescimento pode disparar enquanto save anterior roda |
| Undo/redo (BUG #29) | Cooldown de 1000ms e workaround para relayout assincrono de zonas; se demorar mais, save "fantasma" ocorre |
| Troca de pagina | Varias checagens `isStaleLoad()`, mas sem lock exclusivo |
| Flush persistence | Verifica `_historyRestoreCooldownUntil` mas nao bloqueia atomicamente |
| Keyboard nudge | Flag `keyboardNudgeDirty` simples; rapid key presses + click podem perder save |
| Export/download | `downloadMultipleFiles` async sem controle de concorrencia — multiplos cliques iniciam downloads simultaneos |

### 4.4. Bugs Visuais/Funcionais Conhecidos

1. **Canvas fica preto:** multiplos patches defensivos indicam perda de contexto 2D em edge cases (resize rapido, drag, mouseup fora).
2. **Objetos invalidos em grupos/clipPaths:** rotinas defensivas (`sanitizeCanvasObjectStack`, `purgeInvalidRecursive`, `clearInvalidClipPath`) limpam objetos corrompidos antes de renderizar.
3. **Duplicatas de `_customId`:** logica de regeneracao de ID em vez de remocao indica que duplicatas ocorrem frequentemente apos `loadFromJSON`.
4. **Imagens com URL presignada expirada:** sistema de conversao `presigned -> permanent` indica problema recorrente.
5. **Flickering durante render:** comentario "FIX FLICKERING" admite que purga de objetos invalidos causava flickering visivel quando executada a cada render.

---

## 5. UX/UI

### 5.1. Acessibilidade (A11y)

| Problema | Evidencia |
|----------|-----------|
| **Zero atributos ARIA em EditorCanvas.vue** | Busca por `aria-label`, `role=`, `tabindex` retornou 0 resultados no componente principal |
| **Sem anuncio de notificacoes** | Toasts de `notifyEditorInfo`/`notifyEditorError` sem `aria-live` |
| **Keyboard shortcuts sem documentacao** | Atalhos existem (Ctrl+Z, Delete, F, Shift+1, etc.) mas sem ajuda ou hints |
| **Sem skip links** | Nao ha mecanismo para pular navegacao e ir ao canvas |
| **Focus management ausente** | Modais/paineis nao gerenciam foco; ao fechar, foco nao retorna ao gatilho |
| **Canvas inacessivel para leitores de tela** | Fabric.js nao expoe informacoes semanticas sobre objetos selecionados |

**Excecao positiva:** `ProductZoneSettings.vue` e `BuilderSidebar.vue` possuem `aria-label` e `role="switch"`, mostrando que a equipe sabe implementar a11y, mas o editor principal foi negligenciado.

### 5.2. Mobile UX

- `EditorMobileNav.vue`: sem `aria-label`, sem indicador de carregamento.
- `EditorMobileBottomSheet.vue`: sem `role="dialog"`, sem focus trap, sem fechamento por Escape.
- Touch: pinch-to-zoom e pan customizados, mas sem `preventDefault` em todos os caminhos — pode haver scroll da pagina junto com zoom.

### 5.3. Fluxo de Usuario

1. **Salvamento:** politica inteligente existe (coalesce adaptativo, fingerprint dedup, skip de thumbnail), mas o usuario nao tem visibilidade clara de quando o projeto esta salvo vs. dirty.
2. **Exportacao:** multiplos formatos (PNG, JPG, PDF, ZIP) com multiplas resolucoes, mas o fluxo e complexo e `performShare` sem catch pode deixar loading preso.
3. **Undo/Redo:** funciona, mas com cooldown defensivo de 1s apos navegacao devido a eventos assincronos fantasma.
4. **AI Image Studio:** modal global com fluxo de crop/geracao/edicao; previews de imagem precisam de `revokeObjectURL` (ja corrigido em fevereiro).

---

## 6. Comparativo com Analise Anterior (2026-02-17)

| Metrica | Fev/2026 | Abr/2026 | Evolucao |
|---------|----------|----------|----------|
| EditorCanvas.vue | 30.049 linhas | ~40.758 linhas | **+35,6%** |
| LabelTemplateMiniEditor.vue | 4.768 linhas | ~4.768 linhas | Estavel |
| Maior chunk client | 479 KB | **700 KB** | **+46%** |
| Ocorrencias de `any` | ~2.326 | ~3.300 | **+42%** |
| Utilitarios extraidos | ~8 | ~15 | +7 modulos |

**Observacao:** apesar de 7 novos utilitarios terem sido extraidos, o monolito principal **continuou crescendo**. A modularizacao nao esta acompanhando o ritmo de novas funcionalidades.

---

## 7. Recomendacoes Prioritarias

### P0 — Critico (estabilidade / dados / performance)

1. **Quebrar EditorCanvas.vue em composables reais**
   - Criar `useCanvasLoad`, `useViewportCull`, `useCanvasSave`, `usePenTool`, `useCanvasHistory`, `useCanvasSelection`
   - Cada composable deve ter contrato claro de entrada/saida
   - Meta: reduzir EditorCanvas.vue para < 10K linhas em 90 dias

2. **Centralizar `requestRenderAll`**
   - Criar `scheduleRender()` com coalescimento via unico `requestAnimationFrame`
   - Substituir as 180 chamadas dispersas pela funcao centralizada
   - Remove monkey-patch `patchCanvasRenderSafety` gradualmente

3. **Implementar fila serial de operacoes async**
   - Save, load, export, undo/redo devem passar por uma fila unica
   - Elimina race conditions de flags booleanas espalhadas

4. **Adicionar catch em `performShare` e hardening de `saveProject`**
   - `performShare` precisa de `catch` para remover loading preso
   - `saveProject` nao deve chamar `saveProjectDB` se `saveCurrentState` falhar sem dados validos

5. **Reduzir chunk client para < 500 KB**
   - Separar logica de produto (zones, templates) em chunk lazy-loaded
   - Avaliar separacao de Fabric.js em chunk com preload condicional

### P1 — Alto (qualidade de codigo / manutencao)

6. **Reduzir uso de `any` em 30% no nucleo**
   - Tipar fronteiras publicas: payload de save/load, eventos, tipos Fabric custom
   - Criar interfaces para `CANVAS_CUSTOM_PROPS` e objetos de dominio

7. **Remover try/catch vazios**
   - Substituir por logging estruturado + notificacao ao usuario quando operacao falha
   - Priorizar: export, delete, sync de frames

8. **Tipar `useProductZone` e `useProductLayout`**
   - Converter para factory pattern (recebem estado como parametro)
   - Elimina singleton implicito e permite multiplas instancias

9. **Criar painel de atalhos de teclado**
   - Acessivel via `?` ou botao de ajuda
   - Documenta todos os shortcuts existentes

### P2 — Medio (UX / acessibilidade)

10. **Adicionar `aria-live="polite"`** na regiao de notificacoes/toasts
11. **Adicionar `aria-label` e `role="dialog"`** em `EditorMobileNav.vue` e `EditorMobileBottomSheet.vue`
12. **Implementar focus trap** no bottom sheet mobile
13. **Adicionar fechamento por Escape** no bottom sheet e modais

### P3 — Baixo (polimento)

14. **Remover `console.log` de debug** (341 ocorrencias) — usar flag `DEBUG_EDITOR` ou remover de producao
15. **Auditar watchers** para garantir que nao observam objetos reativos profundos desnecessariamente
16. **Padronizar debito tecnico:** criar `TECH_DEBT.md` ou converter comentarios `CRITICAL`/`BUG #N` em issues rastreaveis
17. **Worker thread para thumbnail:** mover `generateThumbnailFromCanvasJson` para Web Worker ou gerar no servidor

---

## 8. Critérios de Pronto por Fase

| Fase | Criterio |
|------|----------|
| Fase 1 (estabilidade) | Build ok, funcionalidades preservadas, chunk < 500 KB, nenhum `performShare` sem catch |
| Fase 2 (arquitetura) | EditorCanvas.vue < 20K linhas, 3+ composables extraidos com contrato tipado |
| Fase 3 (qualidade) | Reducao de 30% em `any`, typecheck sem erros novos |
| Fase 4 (a11y/UX) | Painel de atalhos, ARIA em componentes mobile, focus management basico |
| Fase 5 (testes) | Suite de regressao minima: troca de pagina + autosave, undo/redo, importacao de produto |

---

## 9. Riscos Estruturais Remanescentes

1. **Monolito continua crescendo:** sem intervencao arquitetural, EditorCanvas.vue pode chegar a 50K+ linhas ate o fim do ano.
2. **Cobertura de tipos muito baixa:** novos desenvolvedores tem dificuldade de entender contratos sem `any`.
3. **Monkey-patches escondem bugs de dados:** em vez de corrigir a raiz (serializacao/clipPath/objects invalidos), o codigo mascara sintomas no render.
4. **Poucos testes automatizados:** fluxos criticos (undo/redo, troca de pagina, persistencia) nao tem garantia de regressao.
5. **Fabric.js v7.1.0:** monkey-patches profundos no framework dificultam upgrades futuros.

---

*Relatorio gerado automaticamente a partir da analise do codigo-fonte, skills do projeto e execucao de scripts de bundle.*
