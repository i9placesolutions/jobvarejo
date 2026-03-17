import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { geminiGenerateImage, geminiEditImage } from '~/server/utils/gemini-images'
import { uploadBufferToStorage } from '~/server/utils/contabo-upload'
import { resolveStorageReadUrl } from '~/server/utils/project-storage-refs'

const MAX_PROMPT_LENGTH = 2000

/**
 * Gera arte institucional:
 * 1. Busca inspirações do usuário (style_references)
 * 2. Monta prompt enriquecido com estilo aprendido
 * 3. Gera imagem de fundo via Gemini Nano Banana 2
 * 4. Retorna: URL da imagem + JSON Fabric.js com background + textos editáveis
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `ai:institutional:${user.id}`, 10, 60_000)

  const config = useRuntimeConfig()
  if (!config.geminiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'Gemini API Key nao configurada.' })
  }

  const body = await readBody(event)
  const prompt = String(body?.prompt || '').trim()
  if (!prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Prompt obrigatorio. Ex: "Arte de Natal para supermercado"' })
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Prompt muito longo (max ${MAX_PROMPT_LENGTH}).` })
  }

  const sizeRaw = String(body?.size || '1080x1920').trim()
  const [wStr, hStr] = sizeRaw.split('x')
  const width = Math.max(128, Math.min(4096, Number(wStr) || 1080))
  const height = Math.max(128, Math.min(4096, Number(hStr) || 1920))
  const size = `${width}x${height}`

  const title = String(body?.title || '').trim().slice(0, 200)
  const subtitle = String(body?.subtitle || '').trim().slice(0, 300)
  const tagFilter = String(body?.tagFilter || '').trim().toLowerCase()

  // 1. Buscar inspirações do usuário
  let styleNotes = ''
  const refsQuery = tagFilter
    ? `SELECT id, style_analysis, tags FROM public.style_references
       WHERE user_id = $1 AND $2 = ANY(tags)
       ORDER BY usage_count DESC, created_at DESC LIMIT 5`
    : `SELECT id, style_analysis, tags FROM public.style_references
       WHERE user_id = $1
       ORDER BY usage_count DESC, created_at DESC LIMIT 5`

  const refsParams = tagFilter ? [user.id, tagFilter] : [user.id]
  const refs = await pgQuery<{ id: string; style_analysis: any; tags: string[] }>(refsQuery, refsParams)

  if (refs.rows.length > 0) {
    // Compilar estilo a partir das inspirações
    const palettes = new Set<string>()
    const styles = new Set<string>()
    const elements = new Set<string>()
    const layouts = new Set<string>()
    const moods = new Set<string>()

    for (const r of refs.rows) {
      const sa = r.style_analysis || {}
      if (Array.isArray(sa.palette)) sa.palette.forEach((c: string) => palettes.add(c))
      if (sa.style) styles.add(sa.style)
      if (Array.isArray(sa.elements)) sa.elements.forEach((e: string) => elements.add(e))
      if (sa.layout) layouts.add(sa.layout)
      if (sa.mood) moods.add(sa.mood)
    }

    const parts: string[] = []
    if (palettes.size > 0) parts.push(`Cores preferidas: ${[...palettes].slice(0, 8).join(', ')}`)
    if (styles.size > 0) parts.push(`Estilo visual: ${[...styles].join(', ')}`)
    if (elements.size > 0) parts.push(`Elementos visuais: ${[...elements].join(', ')}`)
    if (layouts.size > 0) parts.push(`Layout: ${[...layouts].join(', ')}`)
    if (moods.size > 0) parts.push(`Mood: ${[...moods].join(', ')}`)
    styleNotes = parts.join('. ')

    // Incrementar usage_count
    const refIds = refs.rows.map(r => r.id)
    await pgQuery(
      `UPDATE public.style_references SET usage_count = usage_count + 1 WHERE id = ANY($1::uuid[])`,
      [refIds]
    ).catch(() => {})
  }

  // 2. Montar prompt enriquecido para Gemini
  const promptLines: string[] = [
    `Crie uma arte visual profissional para: ${prompt}`,
    '',
    'REGRAS:',
    '- Arte para uso em encarte/post/banner de supermercado ou loja de varejo',
    '- Resolucao alta, cores vibrantes, visual impactante',
    '- NAO inclua texto na imagem — os textos serao adicionados depois como camada editavel',
    '- Deixe espaco livre (area de respiro) no centro e no topo para texto ser adicionado depois',
    '- Fundo completo sem areas brancas ou transparentes',
  ]

  if (styleNotes) {
    promptLines.push('', 'ESTILO BASEADO NAS PREFERENCIAS DO USUARIO:', styleNotes)
  }

  if (title) {
    promptLines.push('', `A arte sera usada com o titulo "${title}" — deixe espaco visual adequado para esse texto`)
  }

  const finalPrompt = promptLines.join('\n')

  // 3. Gerar imagem via Gemini
  let resultBuffer: Buffer
  let resultMime: string

  try {
    const gen = await geminiGenerateImage({
      prompt: finalPrompt,
      size,
      background: 'white'
    })
    resultBuffer = gen.buffer
    resultMime = gen.mime
  } catch (err: any) {
    const rawMsg = String(err?.message || '')
    if (rawMsg.includes('timed out') || rawMsg.includes('timeout')) {
      throw createError({ statusCode: 504, statusMessage: 'Geracao excedeu o tempo limite. Tente novamente.' })
    }
    if (rawMsg.includes('bloqueou')) {
      throw createError({ statusCode: 400, statusMessage: rawMsg })
    }
    console.error('[ai:institutional:generate] Gemini error:', rawMsg.slice(0, 300))
    throw createError({ statusCode: 502, statusMessage: 'Falha ao gerar arte. Tente novamente.' })
  }

  // 4. Upload para Wasabi
  const upload = await uploadBufferToStorage({
    buffer: resultBuffer,
    contentType: resultMime,
    filenameBase: `institucional-${Date.now()}`,
    folder: 'imagens',
    ext: resultMime.includes('png') ? 'png' : 'jpeg'
  })

  const imageUrl = await resolveStorageReadUrl(upload.key, user.id).catch(() => upload.url)

  // 5. Montar canvas Fabric.js editável
  const canvasData = buildEditableCanvas({
    width,
    height,
    backgroundImageUrl: imageUrl,
    backgroundImageKey: upload.key,
    title: title || 'Seu titulo aqui',
    subtitle: subtitle || '',
  })

  return {
    success: true,
    imageUrl,
    imageKey: upload.key,
    canvasData,
    styleNotesUsed: styleNotes || null,
    inspirationsUsed: refs.rows.length
  }
})

/**
 * Monta JSON Fabric.js com:
 * - Frame (artboard)
 * - Imagem de fundo (gerada por IA)
 * - Textos editáveis (título, subtítulo)
 */
function buildEditableCanvas(opts: {
  width: number
  height: number
  backgroundImageUrl: string
  backgroundImageKey: string
  title: string
  subtitle: string
}) {
  const { width, height } = opts
  const objectId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

  const objects: any[] = []

  // 1. Frame (artboard background)
  objects.push({
    type: 'Rect',
    left: width / 2,
    top: height / 2,
    width,
    height,
    fill: '#ffffff',
    originX: 'center',
    originY: 'center',
    selectable: true,
    evented: true,
    isFrame: true,
    layerName: 'FRAMER',
    clipContent: true,
    name: 'Frame 1',
    _customId: objectId(),
    stroke: '#0d99ff',
    strokeWidth: 0,
  })

  // 2. Background image (gerada pela IA)
  objects.push({
    type: 'Image',
    left: width / 2,
    top: height / 2,
    width,
    height,
    originX: 'center',
    originY: 'center',
    scaleX: 1,
    scaleY: 1,
    selectable: true,
    evented: true,
    src: opts.backgroundImageUrl,
    __originalSrc: opts.backgroundImageKey,
    name: 'Fundo IA',
    _customId: objectId(),
    lockMovementX: false,
    lockMovementY: false,
    parentFrameId: objects[0]._customId,
  })

  // 3. Título editável
  if (opts.title) {
    const fontSize = Math.round(width * 0.065)
    objects.push({
      type: 'Textbox',
      left: width / 2,
      top: Math.round(height * 0.15),
      width: Math.round(width * 0.85),
      originX: 'center',
      originY: 'center',
      text: opts.title,
      fontSize,
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fill: '#ffffff',
      textAlign: 'center',
      shadow: {
        color: 'rgba(0,0,0,0.6)',
        blur: 8,
        offsetX: 2,
        offsetY: 2,
      },
      selectable: true,
      evented: true,
      name: 'Titulo',
      _customId: objectId(),
      parentFrameId: objects[0]._customId,
    })
  }

  // 4. Subtítulo editável
  if (opts.subtitle) {
    const fontSize = Math.round(width * 0.04)
    objects.push({
      type: 'Textbox',
      left: width / 2,
      top: Math.round(height * 0.22),
      width: Math.round(width * 0.8),
      originX: 'center',
      originY: 'center',
      text: opts.subtitle,
      fontSize,
      fontFamily: 'Inter',
      fontWeight: 'normal',
      fill: '#ffffff',
      textAlign: 'center',
      shadow: {
        color: 'rgba(0,0,0,0.4)',
        blur: 6,
        offsetX: 1,
        offsetY: 1,
      },
      selectable: true,
      evented: true,
      name: 'Subtitulo',
      _customId: objectId(),
      parentFrameId: objects[0]._customId,
    })
  }

  return {
    version: '7.1.0',
    objects
  }
}
