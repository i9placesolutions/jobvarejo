import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { geminiEditImage, geminiGenerateImage } from '~/server/utils/gemini-images'
import { uploadBufferToStorage } from '~/server/utils/contabo-upload'
import { resolveStorageReadUrl } from '~/server/utils/project-storage-refs'
import { getS3Client } from '~/server/utils/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const MAX_PROMPT_LENGTH = 2000

const SIZE_TO_ASPECT: Record<string, string> = {
  '1080x1080': '1:1',
  '1080x1350': '4:5',
  '1080x1920': '9:16',
  '1920x1080': '16:9',
}

const downloadS3Image = async (s3Key: string): Promise<{ buffer: Buffer; mime: string } | null> => {
  try {
    const config = useRuntimeConfig()
    const s3 = getS3Client()
    const cmd = new GetObjectCommand({ Bucket: config.wasabiBucket, Key: s3Key })
    const res = await s3.send(cmd)
    if (!res.Body) return null
    const chunks: Uint8Array[] = []
    for await (const chunk of res.Body as any) chunks.push(chunk)
    return { buffer: Buffer.concat(chunks), mime: String(res.ContentType || 'image/png') }
  } catch { return null }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `ai:institutional:${user.id}`, 10, 60_000)

  const config = useRuntimeConfig()
  if (!config.geminiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Gemini API Key nao configurada.' })
  }

  const body = await readBody(event)
  const prompt = String(body?.prompt || '').trim()
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt obrigatorio (max 2000 chars).' })
  }

  const sizeRaw = String(body?.size || '1080x1920').trim()
  const [wStr, hStr] = sizeRaw.split('x')
  const width = Math.max(128, Math.min(4096, Number(wStr) || 1080))
  const height = Math.max(128, Math.min(4096, Number(hStr) || 1920))
  const size = `${width}x${height}`
  const aspectRatio = SIZE_TO_ASPECT[size] || '9:16'

  const title = String(body?.title || '').trim().slice(0, 200)
  const subtitle = String(body?.subtitle || '').trim().slice(0, 300)
  const tagFilter = String(body?.tagFilter || '').trim().toLowerCase()

  // ========================================
  // 1. Buscar inspirações + baixar imagens
  // ========================================
  const refsQuery = tagFilter
    ? `SELECT id, s3_key, style_analysis FROM public.style_references
       WHERE user_id = $1 AND $2 = ANY(tags) ORDER BY usage_count DESC, created_at DESC LIMIT 3`
    : `SELECT id, s3_key, style_analysis FROM public.style_references
       WHERE user_id = $1 ORDER BY usage_count DESC, created_at DESC LIMIT 3`

  const refs = await pgQuery<{ id: string; s3_key: string; style_analysis: any }>(
    refsQuery, tagFilter ? [user.id, tagFilter] : [user.id]
  )

  let styleNotes = ''
  const referenceImages: Array<{ buffer: Buffer; mime: string }> = []

  if (refs.rows.length > 0) {
    // Compilar estilo
    const sa = refs.rows.map(r => r.style_analysis || {})
    const parts: string[] = []
    const palettes = sa.flatMap(s => s.palette || []).filter(Boolean).slice(0, 6)
    if (palettes.length) parts.push(`Cores: ${palettes.join(', ')}`)
    const styles = [...new Set(sa.map(s => s.style).filter(Boolean))]
    if (styles.length) parts.push(`Estilo: ${styles.join(', ')}`)
    const moods = [...new Set(sa.map(s => s.mood).filter(Boolean))]
    if (moods.length) parts.push(`Mood: ${moods.join(', ')}`)
    styleNotes = parts.join('. ')

    // Baixar e redimensionar imagens de referência (max 1024px para não estourar o request)
    const downloads = await Promise.all(refs.rows.slice(0, 2).map(r => downloadS3Image(r.s3_key)))
    for (const dl of downloads) {
      if (!dl || dl.buffer.length === 0) continue
      try {
        const sharp = (await import('sharp')).default
        const resized = await sharp(dl.buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer()
        referenceImages.push({ buffer: resized, mime: 'image/jpeg' })
      } catch {
        // Se sharp falhar, usa o original se for < 2MB
        if (dl.buffer.length < 2 * 1024 * 1024) {
          referenceImages.push(dl)
        }
      }
    }

    // Incrementar usage
    await pgQuery(
      'UPDATE public.style_references SET usage_count = usage_count + 1 WHERE id = ANY($1::uuid[])',
      [refs.rows.map(r => r.id)]
    ).catch(() => {})
  }

  // ========================================
  // 2. Gerar título/subtítulo se não preenchidos
  // ========================================
  let finalTitle = title
  let finalSubtitle = subtitle

  if (!finalTitle) {
    try {
      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Gere titulo e subtitulo para arte institucional de supermercado sobre: "${prompt}". JSON: {"title":"MAX 4 PALAVRAS MAIUSCULO","subtitle":"frase complementar curta"}` }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.5, maxOutputTokens: 80 }
          }),
          signal: AbortSignal.timeout(8_000)
        }
      )
      if (aiRes.ok) {
        const json: any = await aiRes.json()
        const parsed = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
        finalTitle = String(parsed.title || '').trim().slice(0, 200)
        finalSubtitle = finalSubtitle || String(parsed.subtitle || '').trim().slice(0, 300)
      }
    } catch {}
    if (!finalTitle) finalTitle = prompt.toUpperCase().slice(0, 40)
  }

  // ========================================
  // 3. Gerar imagem COM textos via Nano Banana Pro
  // ========================================
  const imagePrompt = [
    `Crie uma arte visual COMPLETA e PROFISSIONAL para: ${prompt}`,
    '',
    `Formato: proporcao exata ${aspectRatio}, preencher completamente sem bordas brancas.`,
    '',
    'OBRIGATORIO incluir estes textos NA imagem com tipografia profissional:',
    `- Texto principal grande e impactante: "${finalTitle}"`,
    finalSubtitle ? `- Texto secundario menor: "${finalSubtitle}"` : '',
    '',
    'REGRAS DE DESIGN:',
    '- Arte de design grafico profissional para supermercado/varejo',
    '- Tipografia grande, bold, legivel e estilizada (nao fonte simples)',
    '- Os textos devem ser PARTE do design, integrados visualmente',
    '- Cores vibrantes, visual impactante, alta qualidade',
    '- Incluir elementos decorativos relacionados ao tema',
    '- Fundo completo preenchido, sem areas em branco',
    '- Deixar espaco para logo no rodape (area pequena sem elementos)',
    referenceImages.length > 0
      ? '\nREFERENCIA: Crie no MESMO ESTILO VISUAL das imagens anexadas. Mesmas cores, composicao, qualidade e mood. NAO copie os textos da referencia, use os textos informados acima.'
      : '',
    styleNotes ? `\nESTILO PREFERIDO: ${styleNotes}` : '',
  ].filter(Boolean).join('\n')

  let resultBuffer: Buffer
  let resultMime: string

  try {
    if (referenceImages.length > 0) {
      const result = await geminiEditImage({
        prompt: imagePrompt,
        size,
        background: 'white',
        images: referenceImages.map((img, i) => ({
          data: img.buffer,
          mime: img.mime
        }))
      })
      resultBuffer = result.buffer
      resultMime = result.mime
    } else {
      const result = await geminiGenerateImage({ prompt: imagePrompt, size, background: 'white' })
      resultBuffer = result.buffer
      resultMime = result.mime
    }
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (msg.includes('timed out')) throw createError({ statusCode: 504, statusMessage: 'Timeout. Tente novamente.' })
    if (msg.includes('bloqueou')) throw createError({ statusCode: 400, statusMessage: msg })
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) throw createError({ statusCode: 429, statusMessage: 'Limite atingido. Aguarde.' })
    console.error('[ai:institutional] Gemini error:', msg.slice(0, 500))
    throw createError({ statusCode: 502, statusMessage: `Falha ao gerar: ${msg.slice(0, 100)}` })
  }

  // ========================================
  // 4. Detectar dimensões reais
  // ========================================
  let imgW = width, imgH = height
  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(resultBuffer).metadata()
    if (meta.width && meta.height) { imgW = meta.width; imgH = meta.height }
  } catch {}

  // ========================================
  // 5. Upload
  // ========================================
  const upload = await uploadBufferToStorage({
    buffer: resultBuffer,
    contentType: resultMime,
    filenameBase: `institucional-${Date.now()}`,
    folder: 'imagens',
    ext: resultMime.includes('png') ? 'png' : 'jpeg'
  })
  const imageUrl = await resolveStorageReadUrl(upload.key, user.id).catch(() => upload.url)

  // ========================================
  // 6. Canvas: Frame + Imagem (cover) — sem elementos soltos
  // ========================================
  const id = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const frameId = id()
  const coverScale = Math.max(width / imgW, height / imgH)

  const canvasData = {
    version: '7.1.0',
    objects: [
      {
        type: 'Rect',
        left: 0, top: 0, width, height,
        fill: '#ffffff',
        originX: 'left', originY: 'top',
        selectable: true, evented: true,
        isFrame: true, layerName: 'FRAMER', clipContent: true,
        name: 'Frame 1', _customId: frameId,
        stroke: '#0d99ff', strokeWidth: 0,
      },
      {
        type: 'Image',
        left: width / 2, top: height / 2,
        originX: 'center', originY: 'center',
        scaleX: coverScale, scaleY: coverScale,
        selectable: true, evented: true,
        src: imageUrl,
        __originalSrc: upload.key,
        name: 'Arte Institucional',
        _customId: id(),
        parentFrameId: frameId,
      }
    ]
  }

  return {
    success: true,
    imageUrl,
    imageKey: upload.key,
    canvasData,
    title: finalTitle,
    subtitle: finalSubtitle,
    styleNotesUsed: styleNotes || null,
    inspirationsUsed: refs.rows.length
  }
})
