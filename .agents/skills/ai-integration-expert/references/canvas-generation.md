# Geracao de Canvas AI

## Endpoint: POST /api/ai/canvas/generate

- Rate limit: 8/60s por usuario
- Modelo: gpt-4o (com ref image) ou gpt-4o-mini (sem ref)
- Temperature: 0.15 (com ref) / 0.35 (sem ref)
- max_tokens: 2800
- response_format: `{ type: 'json_object' }`
- System prompt: `"Voce responde apenas com JSON valido para Fabric.js v7.1.0."`

## Prompt (src/ai/aiPrompt.ts)

`buildAiCanvasPrompt(payload)` gera:
- Dimensoes do canvas (width x height px)
- Tipo de pagina (RETAIL_OFFER ou FREE_DESIGN)
- Requisito de frame obrigatorio (Rect com isFrame=true)
- Tipos de objeto permitidos (Textbox, Rect, Circle, Line, Path)
- Proibicao de imagens externas
- Fallback tipografico para "Inter"
- Clone instructions com fidelity % (quando ref image)

## Validacao (src/ai/aiZodSchemas.ts)

`validateAiCanvasData(input, expectedSize)`:
1. Parse com Zod: `aiCanvasSchema` (version 7.1.0, objects min 1)
2. Frame existe com `isFrame === true` e `type === 'Rect'`
3. Frame em left=0, top=0
4. Frame com dimensoes exatas do canvas
5. Sem imagens externas (recursivo via `visitObjects()`)

### Schemas
```ts
aiCanvasSchema = z.object({
  version: z.literal('7.1.0'),
  objects: z.array(fabricObjectSchema).min(1)
}).passthrough()

fabricObjectSchema = z.object({
  type: z.string().min(1)
}).passthrough()
```

## Fluxo client (src/ai/aiGenerateCanvasData.ts)

1. Normaliza payload
2. `buildAiCanvasPrompt()` para compilar prompt
3. `$fetch('/api/ai/canvas/generate', { body })` com prompt compilado
4. Valida resposta com Zod

## Aplicacao ao projeto (src/ai/aiApplyToProject.ts)

`applyAiToPage(input)`:
1. Gera canvas data
2. Modo `replace`: aplica na pagina ativa
3. Modo `newPage`: cria nova pagina
4. `updatePageData(index, data, { source: 'user', markUnsaved: true })`
5. Auto-persist via `saveProjectDB()` para projetos nao-temp

## UI (components/AiImageStudioModal.vue, 658 linhas)

Tres modos:
1. **Gerar**: novo a partir de prompt
2. **Parecido**: variacao de imagem modelo
3. **Editar (Mascara)**: edicao com brush mask

Features:
- Prompt, negative prompt, instrucoes extra
- URL de site para analise de estilo
- Refs (upload ou URL)
- Toggle fundo transparente / remocao de fundo
- Seletor de tamanho
- Mask painting com canvas (destination-out compositing)
