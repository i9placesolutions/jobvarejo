import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { buildAiCanvasPrompt } from '~/src/ai/aiPrompt'
import { validateAiCanvasData } from '~/src/ai/aiZodSchemas'
import type { AiGeneratePayload } from '~/src/ai/aiTypes'

const MAX_PROMPT_LENGTH = 2400
const MAX_COMPILED_PROMPT_LENGTH = 7000
const MIN_CANVAS_SIDE = 128
const MAX_CANVAS_SIDE = 4096

let openaiClient: any = null

const getOpenAI = async () => {
  if (openaiClient) return openaiClient
  const config = useRuntimeConfig()
  const { default: OpenAI } = await import('openai')
  openaiClient = new OpenAI({ apiKey: config.openaiApiKey || '' })
  return openaiClient
}

const cleanJsonLikeOutput = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
}

const normalizeReferenceImageDataUrl = (value: unknown): string | null => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const isImageDataUrl = /^data:image\/(png|jpe?g|webp);base64,/i.test(raw)
  if (!isImageDataUrl) return null

  // Keep payloads bounded to avoid excessive request size.
  if (raw.length > 12_000_000) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Imagem de referencia muito grande. Use no maximo 8MB.'
    })
  }

  return raw
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `ai-canvas:${user.id}`, 8, 60_000)

  const config = useRuntimeConfig()
  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API Key not configured'
    })
  }

  const body = await readBody(event)
  const prompt = String(body?.prompt || '').trim()
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Prompt muito longo. Maximo ${MAX_PROMPT_LENGTH} caracteres.` })
  }

  const referenceImageDataUrl = normalizeReferenceImageDataUrl(body?.options?.referenceImageDataUrl)
  if (!prompt && !referenceImageDataUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt ou imagem de referencia e obrigatorio.' })
  }

  const width = Math.min(MAX_CANVAS_SIDE, Math.max(MIN_CANVAS_SIDE, Math.round(Number(body?.options?.size?.width || 1080))))
  const height = Math.min(MAX_CANVAS_SIDE, Math.max(MIN_CANVAS_SIDE, Math.round(Number(body?.options?.size?.height || 1920))))
  const pageType = body?.options?.pageType === 'FREE_DESIGN' ? 'FREE_DESIGN' : 'RETAIL_OFFER'
  const cloneStrengthRaw = Number(body?.options?.cloneStrength ?? 100)
  const cloneStrength = Number.isFinite(cloneStrengthRaw)
    ? Math.max(0, Math.min(100, Math.round(cloneStrengthRaw)))
    : 100

  const payload: AiGeneratePayload = {
    prompt,
    options: {
      pageType,
      size: { width, height },
      referenceImageDataUrl,
      cloneStrength: referenceImageDataUrl ? cloneStrength : undefined
    }
  }

  const compiledPromptRaw = String(body?.compiledPrompt || '').trim()
  if (compiledPromptRaw.length > MAX_COMPILED_PROMPT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `compiledPrompt muito longo. Maximo ${MAX_COMPILED_PROMPT_LENGTH} caracteres.` })
  }
  const compiledPrompt = compiledPromptRaw || buildAiCanvasPrompt(payload)

  try {
    const openai = await getOpenAI()
    const userContent = referenceImageDataUrl
      ? [
          { type: 'text', text: compiledPrompt },
          {
            type: 'image_url',
            image_url: {
              url: referenceImageDataUrl,
              detail: 'high'
            }
          }
        ]
      : compiledPrompt

    const completion = await openai.chat.completions.create({
      model: referenceImageDataUrl ? 'gpt-4o' : 'gpt-4o-mini',
      temperature: referenceImageDataUrl ? 0.15 : 0.35,
      max_tokens: 2800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Voce responde apenas com JSON valido para Fabric.js v7.1.0.'
        },
        {
          role: 'user',
          content: userContent
        }
      ]
    })

    const content = completion?.choices?.[0]?.message?.content
    const rawJson = cleanJsonLikeOutput(content)
    if (!rawJson) {
      throw createError({ statusCode: 502, statusMessage: 'A IA retornou resposta vazia.' })
    }

    const parsed = JSON.parse(rawJson)
    const validated = validateAiCanvasData(parsed, { width, height })
    return { canvasData: validated }
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 500)
    if (statusCode >= 400 && statusCode < 500) throw error

    const rawMessage = String(error?.message || 'Falha ao gerar canvas com IA')
    const safeMessage = rawMessage.length > 220 ? `${rawMessage.slice(0, 220)}...` : rawMessage
    throw createError({
      statusCode: 500,
      statusMessage: safeMessage
    })
  }
})
