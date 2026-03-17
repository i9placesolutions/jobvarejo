/**
 * Gemini Nano Banana 2 (gemini-3.1-flash-image-preview) — geração e edição de imagens.
 *
 * Usado para geração/edição de imagens no AI Image Studio.
 * OpenAI continua para parsing de produtos, canvas JSON, análise de texto.
 *
 * API: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 */

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_TIMEOUT_MS = 90_000

export type GeminiImageResult = {
  buffer: Buffer
  mime: string
}

// Aspect ratio mapping: OpenAI sizes -> Gemini aspect ratios
const SIZE_TO_ASPECT: Record<string, string> = {
  '1024x1024': '1:1',
  '1024x1536': '2:3',
  '1536x1024': '3:2',
  // Extended for Nano Banana 2
  '1080x1920': '9:16',
  '1920x1080': '16:9',
  '1080x1350': '4:5',
  '1350x1080': '5:4',
}

const getTimeoutSignal = (ms: number): AbortSignal => {
  const f = (AbortSignal as any)?.timeout
  if (typeof f === 'function') return f(ms)
  const ac = new AbortController()
  setTimeout(() => ac.abort(new Error(`Gemini request timed out after ${ms}ms`)), ms)
  return ac.signal
}

const extractImageFromResponse = (json: any): GeminiImageResult => {
  const candidates = json?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    // Check for safety block
    const blockReason = json?.promptFeedback?.blockReason
    if (blockReason) {
      throw new Error(`Gemini bloqueou a geração: ${blockReason}. Tente reformular o prompt.`)
    }
    throw new Error('Gemini não retornou nenhuma imagem.')
  }

  const parts = candidates[0]?.content?.parts
  if (!Array.isArray(parts)) {
    throw new Error('Gemini retornou resposta sem conteúdo.')
  }

  // Find the image part (inlineData with mimeType starting with 'image/')
  for (const part of parts) {
    if (part?.inlineData?.data && String(part.inlineData.mimeType || '').startsWith('image/')) {
      return {
        buffer: Buffer.from(String(part.inlineData.data), 'base64'),
        mime: String(part.inlineData.mimeType)
      }
    }
  }

  throw new Error('Gemini não retornou uma imagem na resposta.')
}

/**
 * Gera imagem a partir de prompt de texto.
 */
export const geminiGenerateImage = async (opts: {
  prompt: string
  size?: string
  background?: 'transparent' | 'white'
}): Promise<GeminiImageResult> => {
  const config = useRuntimeConfig()
  const apiKey = config.geminiApiKey
  if (!apiKey) throw new Error('Gemini API Key not configured')

  const aspectRatio = SIZE_TO_ASPECT[opts.size || '1024x1024'] || '1:1'

  // Build prompt with background instruction
  let finalPrompt = opts.prompt
  if (opts.background === 'transparent') {
    finalPrompt += '\n\nGere a imagem com fundo transparente (canal alfa).'
  }

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: finalPrompt }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio
      }
    }
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: getTimeoutSignal(GEMINI_TIMEOUT_MS)
  })

  const json: any = await res.json()

  if (!res.ok) {
    const msg = json?.error?.message || `Gemini error (${res.status})`
    throw new Error(msg)
  }

  return extractImageFromResponse(json)
}

/**
 * Edita imagem existente com prompt de texto.
 * Suporta múltiplas imagens de referência.
 */
export const geminiEditImage = async (opts: {
  prompt: string
  size?: string
  background?: 'transparent' | 'white'
  images: Array<{ data: Buffer; mime: string }>
  mask?: { data: Buffer; mime: string }
}): Promise<GeminiImageResult> => {
  const config = useRuntimeConfig()
  const apiKey = config.geminiApiKey
  if (!apiKey) throw new Error('Gemini API Key not configured')

  const aspectRatio = SIZE_TO_ASPECT[opts.size || '1024x1024'] || '1:1'

  // Build parts: images first, then text prompt
  const parts: any[] = []

  // Add all reference images
  for (const img of opts.images) {
    parts.push({
      inlineData: {
        mimeType: img.mime || 'image/png',
        data: img.data.toString('base64')
      }
    })
  }

  // Add mask if provided
  if (opts.mask) {
    parts.push({
      inlineData: {
        mimeType: opts.mask.mime || 'image/png',
        data: opts.mask.data.toString('base64')
      }
    })
  }

  // Build prompt with background instruction
  let finalPrompt = opts.prompt
  if (opts.background === 'transparent') {
    finalPrompt += '\n\nMantenha fundo transparente (canal alfa).'
  }
  if (opts.mask) {
    finalPrompt += '\n\nEdite apenas a área indicada pela máscara (pixels transparentes da máscara). Preserve o restante da imagem intacto.'
  }

  parts.push({ text: finalPrompt })

  const body = {
    contents: [{
      role: 'user',
      parts
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio
      }
    }
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: getTimeoutSignal(GEMINI_TIMEOUT_MS)
  })

  const json: any = await res.json()

  if (!res.ok) {
    const msg = json?.error?.message || `Gemini error (${res.status})`
    throw new Error(msg)
  }

  return extractImageFromResponse(json)
}

/**
 * Remove fundo de imagem usando Gemini.
 */
export const geminiRemoveBackground = async (opts: {
  imageBuffer: Buffer
  imageMime?: string
}): Promise<GeminiImageResult> => {
  const config = useRuntimeConfig()
  const apiKey = config.geminiApiKey
  if (!apiKey) throw new Error('Gemini API Key not configured')

  const body = {
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: opts.imageMime || 'image/png',
            data: opts.imageBuffer.toString('base64')
          }
        },
        {
          text: 'Remove o fundo desta imagem completamente. Mantenha apenas o objeto/produto principal com fundo 100% transparente (canal alfa). Preserve todos os detalhes, bordas, sombras e reflexos do objeto. Retorne como PNG com transparência.'
        }
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    }
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: getTimeoutSignal(GEMINI_TIMEOUT_MS)
  })

  const json: any = await res.json()

  if (!res.ok) {
    const msg = json?.error?.message || `Gemini error (${res.status})`
    throw new Error(msg)
  }

  return extractImageFromResponse(json)
}
