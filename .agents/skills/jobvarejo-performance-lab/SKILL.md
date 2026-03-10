---
name: jobvarejo-performance-lab
description: "Especialista em performance para o projeto JobVarejo. Use quando Codex precisar investigar ou corrigir lentidao no editor, quedas de FPS, re-render excessivo, viewport culling, autosave, thumbnails, bundle e client chunk, latencia de APIs, listagem de assets, cache de storage, pipeline de imagem de produto, ou regressao de performance apos mudancas no EditorCanvas, useProject, assets e exportacao."
---

# JobVarejo Performance Lab

## Objetivo

Investigar, medir e corrigir gargalos reais do JobVarejo sem sacrificar confiabilidade do editor.
Trabalhar com os mecanismos existentes do repo antes de introduzir novas camadas de complexidade.

## Inicio rapido

1. Ler `package.json` e identificar o tipo de gargalo.
2. Abrir [references/hotspots.md](references/hotspots.md) para localizar o subsistema afetado.
3. Abrir [references/investigation-workflow.md](references/investigation-workflow.md) e seguir a trilha correspondente.
4. Validar o resultado com [references/perf-gates.md](references/perf-gates.md).

## Regras de operacao

- Medir antes de otimizar. Nao fazer micro-otimizacao por intuicao.
- Preservar comportamento do editor; performance sem corretude nao serve.
- Tratar `components/EditorCanvas.vue` como area de alto risco de regressao.
- Antes de extrair ou reescrever logica, verificar se o problema ja e mitigado por:
  - viewport culling
  - debounce/coalescing
  - caches
  - fingerprint
  - lazy import
  - rate limit
- Otimizar no menor ponto eficaz:
  - render
  - serializacao
  - thumbnail
  - rede
  - consulta
  - bundle
- Sempre distinguir:
  - sintoma percebido
  - medicao
  - causa provavel
  - correcao
  - risco residual

## Trilhas de investigacao

### Editor lento

Usar quando houver:
- FPS baixo
- drag ou zoom travando
- selecao lenta
- atraso ao recalc de product zone
- lag apos aplicar template ou estilo global

Foco:
- `EditorCanvas`
- `LabelTemplateMiniEditor`
- helpers de selecao, historico, layout e thumbnail
- bridge `window.__editorPerf`

### Persistencia/autosave lenta

Usar quando houver:
- save disparando demais
- thumbnail custosa
- reload lento
- restore/historico pesados
- draft local brigando com remoto

Foco:
- `useProject`
- `editorSavePolicy`
- `editorPagePersistence`
- storage history/restore

### Assets/API lenta

Usar quando houver:
- modal de assets demorando
- busca de imagem lenta
- endpoints com latencia alta
- custo alto em cache/proxy/storage

Foco:
- `server/api/assets.get.ts`
- `server/api/process-product-image.post.ts`
- `server/utils/*cache*`
- proxy e storage reads

### Bundle/chunk ruim

Usar quando houver:
- build pesada
- chunk client acima do limite
- cold start maior
- payload grande apos feature nova

Foco:
- imports pesados
- lazy loading
- optional dependencies
- rotas e componentes com alto peso

## Workflow obrigatorio

1. Classificar o gargalo.
2. Medir com ferramenta ou metrica ja existente.
3. Definir baseline numerica.
4. Encontrar o ponto de maior custo.
5. Aplicar a menor mudanca defensavel.
6. Revalidar com a mesma medicao.
7. Reportar ganho, tradeoff e risco.

## Entregas obrigatorias

### Para investigacao

Entregar nesta ordem:
1. sintoma
2. baseline
3. hotspots inspecionados
4. causa provavel
5. acao recomendada

### Para mudanca de codigo

Entregar nesta ordem:
1. gargalo alvo
2. metrica antes
3. mudanca aplicada
4. metrica depois
5. riscos e proximo passo

## Anti-padroes

- Nao remover segurancas de persistencia so para reduzir latencia.
- Nao desligar thumbnail, historico ou sanitizacao sem entender o contrato funcional.
- Nao usar `console.log` massivo como estrategia permanente de observabilidade.
- Nao “otimizar” `EditorCanvas.vue` com rewrites grandes se o hotspot estiver em helper, cache ou endpoint.
- Nao declarar vitoria sem medir bundle, chunk, FPS ou tempo de operacao de novo.

## Referencias

- [references/hotspots.md](references/hotspots.md): mapa dos hotspots e arquivos principais.
- [references/investigation-workflow.md](references/investigation-workflow.md): trilhas praticas de diagnostico.
- [references/perf-gates.md](references/perf-gates.md): comandos e criterios de validacao.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual metrica piorou
- onde estava o gargalo
- o que foi mudado
- como validar que melhorou sem quebrar o editor
