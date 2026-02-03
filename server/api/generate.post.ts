// server/api/generate.post.ts
export default defineEventHandler(async (event) => {
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
  const { prompt, count = 6, image, mode } = body

  if (!prompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Prompt is required'
    })
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
      body: JSON.stringify({
        model: mode === 'vision' ? 'gpt-4o' : 'gpt-4o-mini',
        messages,
        temperature: mode === 'vision' ? 0.2 : 0.7, // Lower temperature for extraction
        max_tokens: 1000
      })
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    const content = data.choices[0].message.content
    
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
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to generate content'
    })
  }
})
