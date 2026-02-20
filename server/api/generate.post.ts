// server/api/generate.post.ts
import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'

const MAX_PROMPT_LENGTH = 2200
const MAX_PRODUCTS_COUNT = 20
const MAX_IMAGE_DATA_URL_LENGTH = 12_000_000

const getTimeoutSignal = (timeoutMs: number): AbortSignal | undefined => {
  const timeoutFactory = (AbortSignal as any)?.timeout
  if (typeof timeoutFactory !== 'function') return undefined
  return timeoutFactory(timeoutMs)
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `generate:${user.id}`, 20, 60_000)

  const config = useRuntimeConfig()
  const apiKey = config.openaiApiKey

  if (!apiKey) {
    const hasNuxtKey = Boolean(process.env.NUXT_OPENAI_API_KEY)
    const hasLegacyKey = Boolean(process.env.OPENAI_API_KEY)
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API Key not configured',
      message: `Set NUXT_OPENAI_API_KEY (recommended) or OPENAI_API_KEY in .env and restart \"npm run dev\". Debug: runtimeConfig.openaiApiKey=false env.NUXT_OPENAI_API_KEY=${hasNuxtKey} env.OPENAI_API_KEY=${hasLegacyKey}`
    })
  }

  const body = await readBody(event)
  const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const prompt = String(payload.prompt || '').trim()
  const modeRaw = String(payload.mode || '').trim().toLowerCase()
  const mode = modeRaw === 'vision' ? 'vision' : 'default'
  const countRaw = Number(payload.count ?? 6)
  const count = Number.isFinite(countRaw)
    ? Math.max(1, Math.min(MAX_PRODUCTS_COUNT, Math.round(countRaw)))
    : 6
  const image = typeof payload.image === 'string' ? payload.image.trim() : ''

  if (!prompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Prompt is required'
    })
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Prompt too long (max ${MAX_PROMPT_LENGTH})`
    })
  }

  if (mode === 'vision') {
    if (!image) {
      throw createError({ statusCode: 400, statusMessage: 'Image is required in vision mode' })
    }
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid image format. Use data:image/...;base64,...' })
    }
    if (image.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw createError({ statusCode: 400, statusMessage: 'Image payload too large (max 8MB)' })
    }
  }

  let messages: any[] = []
  
  if (mode === 'vision' && image) {
    // Basic formatting for vision
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: image // assumes already in data:image/... format
            }
          }
        ]
      }
    ]
  } else {
    const systemPrompt = `You are a helper for a Retail Flyer Editor. 
    Generate a JSON array of ${count} products based on the user's theme.
    Each product object must have:
    - id: number
    - name: string (short product name)
    - price: string (formatted currency e.g. "R$ 19,90")
    - color: string (hex color code suitable for a background, e.g. #FF0000)
    
    Return ONLY the raw JSON array. No markdown, no explanations.`

    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: getTimeoutSignal(20_000),
      body: JSON.stringify({
        model: mode === 'vision' ? 'gpt-4o' : 'gpt-4o-mini',
        messages,
        temperature: mode === 'vision' ? 0.2 : 0.7, // Lower temperature for extraction
        max_tokens: 1000
      })
    })

    let data: any = null
    try {
      data = await response.json()
    } catch {
      throw new Error(`OpenAI returned a non-JSON response (${response.status})`)
    }

    if (data.error) {
      throw new Error(data.error.message)
    }

    const content = String(data?.choices?.[0]?.message?.content || '')
    if (!content) {
      throw new Error('OpenAI returned empty content')
    }
    
    // If it's vision mode, we might just want the raw text
    if (mode === 'vision') {
        return { text: content.trim() }
    }

    // Clean up if markdown code blocks are present
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim()
    
    try {
        return JSON.parse(jsonStr)
    } catch (e) {
        // Fallback for non-json responses
        return { text: content.trim() }
    }

  } catch (error: any) {
    console.error('OpenAI Error:', error)
    const message = String(error?.message || 'Failed to generate content')
    const safeMessage = message.length > 220 ? `${message.slice(0, 220)}...` : message
    throw createError({
      statusCode: 500,
      statusMessage: safeMessage
    })
  }
})
