import { buildAiCanvasPrompt } from './aiPrompt'
import { validateAiCanvasData } from './aiZodSchemas'
import type { AiCanvasData, AiGeneratePayload, AiGenerateResult } from './aiTypes'

const normalizeGeneratePayload = (payload: Partial<AiGeneratePayload>): AiGeneratePayload => {
  const width = Math.max(1, Math.round(Number(payload?.options?.size?.width || 1080)))
  const height = Math.max(1, Math.round(Number(payload?.options?.size?.height || 1920)))
  const referenceImageDataUrl = String(payload?.options?.referenceImageDataUrl || '').trim()
  const cloneStrengthRaw = Number(payload?.options?.cloneStrength ?? 100)
  const cloneStrength = Number.isFinite(cloneStrengthRaw)
    ? Math.max(0, Math.min(100, Math.round(cloneStrengthRaw)))
    : 100

  return {
    prompt: String(payload?.prompt || '').trim(),
    options: {
      pageType: payload?.options?.pageType || 'RETAIL_OFFER',
      size: { width, height },
      referenceImageDataUrl: referenceImageDataUrl || null,
      cloneStrength: referenceImageDataUrl ? cloneStrength : undefined
    }
  }
}

export const aiGenerateCanvasData = async (
  payload: Partial<AiGeneratePayload>,
  opts: { headers?: Record<string, string> } = {}
): Promise<AiCanvasData> => {
  const normalized = normalizeGeneratePayload(payload)
  if (!normalized.prompt && !normalized.options.referenceImageDataUrl) {
    throw new Error('Prompt ou imagem de referencia e obrigatorio para gerar a pagina com IA.')
  }

  const body = {
    prompt: normalized.prompt,
    options: normalized.options,
    compiledPrompt: buildAiCanvasPrompt(normalized)
  }

  const response = await $fetch<AiGenerateResult>('/api/ai/canvas/generate', {
    method: 'POST',
    headers: opts.headers,
    body
  })

  const canvasData = response?.canvasData
  if (!canvasData) {
    throw new Error('A IA nao retornou dados de canvas.')
  }

  return validateAiCanvasData(canvasData, normalized.options.size)
}
