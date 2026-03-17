import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { uploadBufferToStorage } from '~/server/utils/contabo-upload'
import { resolveStorageReadUrl } from '~/server/utils/project-storage-refs'
import { stringifyJsonbParam } from '~/server/utils/jsonb'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_REFERENCES_PER_USER = 50

/**
 * Analisa estilo visual da imagem com GPT-4o Vision.
 * Retorna palette, estilo, elementos, layout, mood e tags sugeridas.
 */
const analyzeStyleWithAI = async (imageBuffer: Buffer, imageMime: string): Promise<{
  styleAnalysis: Record<string, any>
  suggestedTags: string[]
}> => {
  const config = useRuntimeConfig()
  if (!config.openaiApiKey) {
    return { styleAnalysis: {}, suggestedTags: [] }
  }

  try {
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:${imageMime};base64,${base64}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Voce e um especialista em design grafico e analise visual. Analise a imagem e retorne JSON com: palette (array de 5 cores hex dominantes), style (string: minimalista|moderno|retro|festivo|elegante|corporativo|pop|rustico), elements (array de elementos visuais: gradiente, textura, pattern, foto, ilustracao, tipografia-grande, decorativo, borda), layout (string: centralizado|assimetrico|grid|full-bleed|moldura), mood (string: alegre|serio|sofisticado|casual|energetico|acolhedor), suggestedTags (array de tags em portugues para categorizar: natal, pascoa, dia-das-maes, dia-dos-pais, ano-novo, carnaval, institucional, promocional, aniversario, inauguracao, banner, post, stories).'
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
              { type: 'text', text: 'Analise o estilo visual desta imagem.' }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(25_000)
    })

    if (!res.ok) {
      console.warn('[style-references] AI analysis failed:', res.status)
      return { styleAnalysis: {}, suggestedTags: [] }
    }

    const json: any = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (!content) return { styleAnalysis: {}, suggestedTags: [] }

    const parsed = JSON.parse(content)
    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.filter((t: any) => typeof t === 'string').slice(0, 10)
      : []

    const styleAnalysis = {
      palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 8) : [],
      style: String(parsed.style || '').slice(0, 30),
      elements: Array.isArray(parsed.elements) ? parsed.elements.slice(0, 10) : [],
      layout: String(parsed.layout || '').slice(0, 30),
      mood: String(parsed.mood || '').slice(0, 30),
    }

    return { styleAnalysis, suggestedTags }
  } catch (err: any) {
    console.warn('[style-references] AI analysis error:', err?.message?.slice(0, 100))
    return { styleAnalysis: {}, suggestedTags: [] }
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `style-refs:post:${user.id}`, 20, 60_000)

  // Check limit
  const countResult = await pgQuery<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM public.style_references WHERE user_id = $1',
    [user.id]
  )
  const currentCount = Number(countResult.rows[0]?.count || 0)
  if (currentCount >= MAX_REFERENCES_PER_USER) {
    throw createError({
      statusCode: 400,
      statusMessage: `Limite de ${MAX_REFERENCES_PER_USER} inspiracoes atingido. Delete algumas antes de adicionar novas.`
    })
  }

  // Parse multipart
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum arquivo enviado.' })
  }

  const filePart = parts.find((p: any) => p.filename && p.data)
  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo de imagem obrigatorio.' })
  }

  const mime = String((filePart as any).type || 'image/png').toLowerCase()
  if (!mime.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Apenas arquivos de imagem sao aceitos.' })
  }

  const data = (filePart as any).data as Buffer
  if (data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo muito grande (max 15MB).' })
  }

  // Parse fields
  const fields: Record<string, string> = {}
  for (const p of parts) {
    const name = String((p as any).name || '')
    if (!(p as any).filename && (p as any).data && name) {
      fields[name] = Buffer.from((p as any).data).toString('utf8')
    }
  }

  const displayName = String(fields.displayName || fields.display_name || (filePart as any).filename || '').trim().slice(0, 120) || undefined
  const tagsRaw = String(fields.tags || '').trim()
  let tags: string[] = []
  if (tagsRaw) {
    try {
      const parsed = JSON.parse(tagsRaw)
      tags = Array.isArray(parsed) ? parsed.filter((t: any) => typeof t === 'string').slice(0, 15) : []
    } catch {
      tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 15)
    }
  }

  // Upload to Wasabi
  const upload = await uploadBufferToStorage({
    buffer: data,
    contentType: mime,
    filenameBase: `inspiracao-${displayName || 'ref'}`,
    folder: 'imagens',
    ext: mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpeg'
  })

  // AI style analysis (fire-and-forget if slow, but we wait for it)
  const { styleAnalysis, suggestedTags } = await analyzeStyleWithAI(data, mime)

  // Merge user tags with AI-suggested tags
  const allTags = [...new Set([...tags, ...suggestedTags])].slice(0, 15)

  // Insert into DB
  const result = await pgQuery<{ id: string; created_at: string }>(
    `INSERT INTO public.style_references (user_id, s3_key, display_name, style_analysis, tags)
     VALUES ($1, $2, $3, $4::jsonb, $5::text[])
     RETURNING id, created_at`,
    [user.id, upload.key, displayName || null, stringifyJsonbParam(styleAnalysis), allTags]
  )

  const row = result.rows[0]
  const url = await resolveStorageReadUrl(upload.key, user.id).catch(() => upload.url)

  return {
    id: row.id,
    s3Key: upload.key,
    displayName,
    styleAnalysis,
    tags: allTags,
    usageCount: 0,
    createdAt: row.created_at,
    url
  }
})
