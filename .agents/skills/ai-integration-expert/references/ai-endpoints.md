# Mapa de Endpoints AI

## Endpoints

| Endpoint | Modelo | Temperature | max_tokens | Rate Limit | Funcao |
|----------|--------|-------------|------------|------------|--------|
| POST /api/parse-products | gpt-4o-mini | 0.1 | 3200 | N/A | Parsing de lista de produtos |
| POST /api/ai/canvas/generate | gpt-4o-mini / gpt-4o (com ref) | 0.35 / 0.15 | 2800 | 8/60s | Geracao de canvas Fabric.js |
| POST /api/ai/image/generate | gpt-image-1 | N/A | N/A | 20/60s | Geracao de imagem |
| POST /api/ai/image/edit | gpt-image-1 | N/A | N/A | 20/60s | Edicao de imagem com mask |
| POST /api/ai/site/describe | gpt-4o-mini | 0.2 | 300 | 40/60s | Analise de estilo de site |
| POST /api/generate | gpt-4o-mini / gpt-4o (vision) | 0.7 / 0.2 | 1000 | N/A | Sugestao de produtos |
| POST /api/process-product-image | gpt-4o (validation) | 0.0 | 300 | N/A | Validacao AI de imagem |
| GET /api/assets (expand) | gpt-4o-mini | 0.2 | 220 | N/A | Expansao de busca AI |
| POST /api/remove-image-bg | gpt-image-1 (fallback) | N/A | N/A | 20/60s | Remocao de fundo |

## Arquivos de utilidade

| Arquivo | Funcao |
|---------|--------|
| `server/utils/openai-images.ts` | openAiGenerateImage, openAiEditImage, buildPromptFromInputs |
| `server/utils/ai-site-style.ts` | describeSiteStyle |
| `server/utils/product-image-ai.ts` | validateProductImageCandidatesWithAI |
| `server/utils/product-image-serper.ts` | searchSerperImageCandidates |
| `server/utils/product-image-google-cse.ts` | searchGoogleCseImageCandidates |
| `server/utils/product-image-pipeline.ts` | ensureBgRemoved, runExternalPipelineOnce |
| `src/ai/aiTypes.ts` | Tipos compartilhados |
| `src/ai/aiPrompt.ts` | buildAiCanvasPrompt |
| `src/ai/aiZodSchemas.ts` | validateAiCanvasData, aiCanvasSchema |
| `src/ai/aiGenerateCanvasData.ts` | Orquestrador client-side |
| `src/ai/aiApplyToProject.ts` | Aplicacao ao projeto |
| `composables/useAiImageStudio.ts` | Estado do modal AI |
| `components/AiImageStudioModal.vue` | UI do studio AI (658 linhas) |

## Config de API Keys

```ts
// nuxt.config.ts runtimeConfig (server-only)
openaiApiKey: ''        // NUXT_OPENAI_API_KEY ou OPENAI_API_KEY
serperApiKey: ''        // NUXT_SERPER_API_KEY
googleCseApiKey: ''     // NUXT_GOOGLE_CSE_API_KEY
googleCseCx: ''         // NUXT_GOOGLE_CSE_CX
```
