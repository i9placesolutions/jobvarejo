---
name: ai-integration-expert
description: "Especialista em integracoes AI/OpenAI do JobVarejo. Use quando Codex precisar criar ou modificar parsing de produtos com GPT, geracao/edicao de imagens (gpt-image-1), geracao de canvas AI, busca de imagens de produto (Google CSE/Serper), remocao de fundo, validacao de imagem com vision, prompts, schemas Zod, ou resolver problemas de qualidade, timeout e custo das chamadas AI."
---

# AI Integration Expert

## Objetivo

Operar sobre as integracoes de IA do JobVarejo: OpenAI (GPT + gpt-image-1), busca de imagens, remocao de fundo e validacao.
Preservar os padroes de prompt, validacao e fallback existentes.

## Inicio rapido

1. Ler o endpoint/arquivo alvo e [references/ai-endpoints.md](references/ai-endpoints.md).
2. Classificar o pedido:
   - Parsing de produtos: ler [references/product-parsing.md](references/product-parsing.md).
   - Imagem (gerar/editar/buscar): ler [references/image-pipeline.md](references/image-pipeline.md).
   - Canvas AI: ler [references/canvas-generation.md](references/canvas-generation.md).
3. Validar prompts, schemas e error handling.

## Regras de operacao

- OpenAI client e singleton lazy via `getOpenAI()`. Nunca criar instancias novas.
- Chave: `NUXT_OPENAI_API_KEY` (preferido) ou `OPENAI_API_KEY`.
- Nunca expor erros raw da OpenAI ao client. Sempre wrapar com `createError()`.
- Timeouts sao obrigatorios: `AbortSignal.timeout(ms)` com detection fallback.
- Rate limiting em todos endpoints AI. Valores tipicos: 8-40 req/60s por usuario.
- Respostas AI devem ser validadas (Zod ou normalizacao manual) antes de usar.
- Prompts em portugues para contexto brasileiro (precos, unidades, marcas).
- Imagens geradas sao sempre uploaded para Wasabi S3 antes de retornar URL ao client.
- Background removal tem cascata de 5 niveis de fallback. Nao simplificar.

## Modelos e configuracoes

| Modelo | Uso | Temperature | max_tokens |
|--------|-----|-------------|------------|
| gpt-4o-mini | parsing produtos, canvas sem ref, site style, asset expand | 0.1-0.35 | 220-3200 |
| gpt-4o | vision validation, canvas com ref, product image AI | 0.0-0.2 | 300-2800 |
| gpt-image-1 | geracao e edicao de imagens | N/A | N/A |

## Trilhas de uso

### Parsing de produtos (parse-products.post.ts)

1. Input: texto, PDF, XLSX, imagem (multipart ou JSON body).
2. Prompt de ~220 linhas com regras de preco brasileiro.
3. 5 tipos de preco: pricePack, priceUnit, priceSpecial, priceSpecialUnit, specialCondition.
4. Pos-processamento: normalizePrice, normalizePackageUnit, extractDefaultSpecialRule.
5. Timeout: 28s Vercel, 55s local.

### Geracao de imagem (ai/image/generate.post.ts)

1. Dois modos: `generate` (novo) e `similar` (variacao).
2. Com refs: cria blank PNG + `openAiEditImage()`.
3. Sem refs: `openAiGenerateImage()`.
4. Pos: `maybeRemoveBackground()` + `uploadBufferToStorage()`.
5. Sizes: 1024x1024, 1024x1536, 1536x1024.

### Edicao de imagem (ai/image/edit.post.ts)

1. Base image + mask opcional + refs + prompt.
2. `openAiEditImage()` com FormData (image[], mask).
3. Pos: `maybeRemoveBackground()` + upload.

### Canvas AI (ai/canvas/generate.post.ts)

1. Prompt via `buildAiCanvasPrompt()`.
2. Validacao via `validateAiCanvasData()` (Zod + frame check + no external images).
3. Retorna JSON Fabric.js v7.1.0 compativel.

### Busca de imagem de produto

1. Registry DB (curado) -> Cache DB -> Redis cache.
2. Google CSE -> Serper API (fallback).
3. AI validation com gpt-4o (vision, multi-imagem).
4. Scoring por relevancia (brand match, weight, quality, bad domain filter).

### Remocao de fundo

1. OpenAI (Vercel) -> Local ML (large/medium/small) -> OpenAI fallback -> Light-edge pixel.
2. Validacao: `hasMeaningfulTransparency()` + `hasLikelySubjectPreserved()`.
3. Ambos devem passar para aceitar resultado.

## Entregas obrigatorias

### Para mudancas de codigo

1. Modelo e parametros (temperature, max_tokens)
2. Prompt completo ou diff
3. Validacao de resposta (Zod ou manual)
4. Error handling e timeouts
5. Custo estimado por chamada
6. Como validar (teste com dados reais)

### Para analise sem codigo

1. Endpoint e modelo afetado
2. Diagnostico de qualidade/custo/latencia
3. Acao recomendada
4. Risco de regressao

## Referencias

- [references/ai-endpoints.md](references/ai-endpoints.md): mapa de endpoints e modelos.
- [references/product-parsing.md](references/product-parsing.md): parsing de produtos com GPT.
- [references/image-pipeline.md](references/image-pipeline.md): busca, geracao e remocao de fundo.
- [references/canvas-generation.md](references/canvas-generation.md): geracao de canvas AI.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual modelo e parametros foram usados
- se o prompt e validacao estao corretos
- se error handling cobre timeouts e rate limits
- se o custo e aceitavel
- como validar com dados reais
