import { describeSiteStyle } from '~/server/utils/ai-site-style'
import { uploadBufferToStorage } from '~/server/utils/contabo-upload'
import { buildPromptFromInputs, maybeRemoveBackground, openAiGenerateImage, openAiEditImage, resolveReferenceImages } from '~/server/utils/openai-images'
import { createBlankPng, downloadImage } from '~/server/utils/image-processor'
import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { assertSafeExternalHttpUrl } from '~/server/utils/url-safety'

const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024'])
const ALLOWED_BACKGROUNDS = new Set(['white'])
const MAX_PROMPT_LENGTH = 2000
const MAX_NEGATIVE_PROMPT_LENGTH = 900
const MAX_EXTRA_INSTRUCTIONS_LENGTH = 1200
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_FILENAME_BASE_LENGTH = 80
const MAX_REF_URLS = 6
const MAX_REF_FILES = 6

const parseMultipart = async (event: any) => {
  const parts = await readMultipartFormData(event)
  const fields: Record<string, string> = {}
  const files: Array<{ name: string; data: Buffer; filename: string; mime: string }> = []

  for (const p of (parts || [])) {
    if (!p) continue
    const name = String((p as any).name || '')
    const filename = (p as any).filename
    if (filename && (p as any).data) {
      files.push({
        name,
        data: (p as any).data,
        filename: String(filename),
        mime: String((p as any).type || 'application/octet-stream')
      })
    } else if ((p as any).data && name) {
      fields[name] = Buffer.from((p as any).data).toString('utf8')
    }
  }

  return { fields, files }
}

const sanitizeFileBaseName = (value: unknown, fallback: string) => {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^\w.\- ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_FILENAME_BASE_LENGTH)
  return cleaned || fallback
}

const validateImageUpload = (file: { filename: string; data: Buffer; mime: string }, fieldName: string) => {
  const mime = String(file?.mime || '').toLowerCase()
  const size = Number(file?.data?.length || 0)
  if (!mime.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be an image file` })
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} exceeds max file size (10MB)` })
  }
}

const parseListField = (raw: string | undefined, maxItems = 10, maxItemLength = 2048) => {
  const s = String(raw || '').trim()
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr)
      ? arr
          .map((x) => String(x || '').trim().slice(0, maxItemLength))
          .filter(Boolean)
          .slice(0, maxItems)
      : []
  } catch {
    return s
      .split('\n')
      .map((x) => x.trim().slice(0, maxItemLength))
      .filter(Boolean)
      .slice(0, maxItems)
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `ai:image:generate:${user.id}`, 20, 60_000)

  const config = useRuntimeConfig()
  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OpenAI API Key not configured' })
  }

  const { fields, files } = await parseMultipart(event)

  const modeRaw = String(fields.mode || 'generate').trim().toLowerCase()
  if (modeRaw !== 'generate' && modeRaw !== 'similar') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid mode' })
  }
  const mode = modeRaw as 'generate' | 'similar'

  const prompt = String(fields.prompt || '').trim()
  if (!prompt) throw createError({ statusCode: 400, statusMessage: 'prompt required' })
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `prompt too long (max ${MAX_PROMPT_LENGTH})` })
  }

  const sizeRaw = String(fields.size || '1024x1024').trim()
  if (!ALLOWED_SIZES.has(sizeRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid size' })
  }
  const size = sizeRaw as '1024x1024' | '1024x1536' | '1536x1024'

  const backgroundRaw = String(fields.background || '').trim().toLowerCase()
  if (backgroundRaw && !ALLOWED_BACKGROUNDS.has(backgroundRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid background' })
  }
  const background = backgroundRaw ? (backgroundRaw as 'white') : undefined

  const removeBg = String(fields.removeBg || '').toLowerCase() === 'true' || String(fields.removeBg) === '1'
  const wantNoBackground = String(fields.transparent || '').toLowerCase() === 'true' || String(fields.transparent) === '1'

  const negativePrompt = String(fields.negativePrompt || '').trim() || undefined
  if (negativePrompt && negativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `negativePrompt too long (max ${MAX_NEGATIVE_PROMPT_LENGTH})` })
  }

  const extraInstructions = String(fields.extraInstructions || '').trim() || undefined
  if (extraInstructions && extraInstructions.length > MAX_EXTRA_INSTRUCTIONS_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `extraInstructions too long (max ${MAX_EXTRA_INSTRUCTIONS_LENGTH})` })
  }

  const siteUrlRaw = String(fields.siteUrl || '').trim()
  let siteUrl = ''
  if (siteUrlRaw) {
    try {
      siteUrl = assertSafeExternalHttpUrl(siteUrlRaw, { maxLength: 2048 })
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err?.message || 'Invalid siteUrl' })
    }
  }
  const siteNotes = siteUrl ? (await describeSiteStyle(siteUrl)).styleNotes : undefined

  const refUrlsRaw = parseListField(fields.refUrls, MAX_REF_URLS, 2048)
  const refUrls: string[] = []
  for (const rawUrl of refUrlsRaw) {
    try {
      refUrls.push(assertSafeExternalHttpUrl(rawUrl, { maxLength: 2048 }))
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err?.message || 'Invalid reference URL' })
    }
  }

  const modelImageUrlRaw = String(fields.modelImageUrl || '').trim()
  let modelImageUrl = ''
  if (modelImageUrlRaw) {
    try {
      modelImageUrl = assertSafeExternalHttpUrl(modelImageUrlRaw, { maxLength: 2048 })
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err?.message || 'Invalid modelImageUrl' })
    }
  }

  const modelFile = files.find((f) => f.name === 'modelFile')
  if (modelFile) validateImageUpload(modelFile, 'modelFile')

  const refFiles = files
    .filter((f) => f.name === 'refFiles' || f.name === 'refFiles[]')
    .slice(0, MAX_REF_FILES)
    .map((f) => ({ data: f.data, filename: f.filename, mime: f.mime }))
  for (const file of refFiles) validateImageUpload(file, 'refFiles')

  const promptFinal = buildPromptFromInputs({
    prompt,
    negativePrompt,
    siteStyleNotes: siteNotes,
    wantNoBackground,
    extraInstructions
  })

  let resultBuffer: Buffer
  let resultMime = 'image/png'

  if (mode === 'generate') {
    const refs = await resolveReferenceImages({ uploadedFiles: refFiles, imageUrls: refUrls })
    if (refs.length > 0) {
      const [wStr, hStr] = String(size || '1024x1024').split('x')
      const w = Number.parseInt(wStr || '1024', 10) || 1024
      const h = Number.parseInt(hStr || '1024', 10) || 1024
      const blank = await createBlankPng(w, h, { transparent: wantNoBackground })
      const ed = await openAiEditImage({
        prompt: promptFinal,
        size,
        background: wantNoBackground ? 'transparent' : background,
        images: [{ data: blank, filename: 'base.png', mime: 'image/png' }, ...refs]
      })
      resultBuffer = ed.buffer
      resultMime = ed.mime
    } else {
      const gen = await openAiGenerateImage({
        prompt: promptFinal,
        size,
        background: wantNoBackground ? 'transparent' : background
      })
      resultBuffer = gen.buffer
      resultMime = gen.mime
    }
  } else {
    const images: Array<{ data: Buffer; filename: string; mime: string }> = []

    // Base reference: file or URL
    if (modelFile) {
      images.push({ data: modelFile.data, filename: modelFile.filename, mime: modelFile.mime })
    } else if (modelImageUrl) {
      const buf = await downloadImage(modelImageUrl)
      images.push({ data: buf, filename: 'model.png', mime: 'image/png' })
    } else {
      throw createError({ statusCode: 400, statusMessage: 'mode=similar requires a model image (file or URL)' })
    }

    // Extra references
    const extraRefs = await resolveReferenceImages({ uploadedFiles: refFiles, imageUrls: refUrls })
    images.push(...extraRefs)

    const ed = await openAiEditImage({
      prompt: promptFinal,
      size,
      background: wantNoBackground ? 'transparent' : background,
      images
    })
    resultBuffer = ed.buffer
    resultMime = ed.mime
  }

  // Only apply post background removal when explicitly requested.
  // `transparent` (OpenAI background=transparent) should not trigger bg-removal,
  // otherwise it can remove internal parts of the subject.
  const post = await maybeRemoveBackground(resultBuffer, removeBg)
  const filenameBase = sanitizeFileBaseName(fields.filenameBase, 'ai-image')
  const up = await uploadBufferToStorage({
    buffer: post.buffer,
    contentType: post.mime,
    filenameBase,
    // Keep consistent with the main assets library (used by the "Uploads" tab in the UI)
    folder: 'imagens',
    ext: 'png'
  })

  return {
    success: true,
    url: up.url,
    canonicalUrl: up.canonicalUrl,
    key: up.key
  }
})
