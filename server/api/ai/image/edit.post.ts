import { describeSiteStyle } from '~/server/utils/ai-site-style'
import { uploadBufferToStorage } from '~/server/utils/contabo-upload'
import { buildPromptFromInputs, maybeRemoveBackground, openAiEditImage, resolveReferenceImages } from '~/server/utils/openai-images'
import { downloadImage } from '~/server/utils/image-processor'
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
  enforceRateLimit(event, `ai:image:edit:${user.id}`, 20, 60_000)

  const config = useRuntimeConfig()
  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OpenAI API Key not configured' })
  }

  const { fields, files } = await parseMultipart(event)

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

  const baseImageUrlRaw = String(fields.baseImageUrl || '').trim()
  let baseImageUrl = ''
  if (baseImageUrlRaw) {
    try {
      baseImageUrl = assertSafeExternalHttpUrl(baseImageUrlRaw, { maxLength: 2048 })
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err?.message || 'Invalid baseImageUrl' })
    }
  }

  const baseFile = files.find((f) => f.name === 'baseFile')
  const maskFile = files.find((f) => f.name === 'maskFile')
  if (baseFile) validateImageUpload(baseFile, 'baseFile')
  if (maskFile) validateImageUpload(maskFile, 'maskFile')
  if (!baseFile && !baseImageUrl) {
    throw createError({ statusCode: 400, statusMessage: 'baseFile or baseImageUrl required' })
  }

  const promptFinal = buildPromptFromInputs({
    prompt,
    negativePrompt,
    siteStyleNotes: siteNotes,
    wantNoBackground,
    extraInstructions
  })

  const images: Array<{ data: Buffer; filename: string; mime: string }> = []
  if (baseFile) images.push({ data: baseFile.data, filename: baseFile.filename, mime: baseFile.mime })
  else {
    const buf = await downloadImage(baseImageUrl)
    images.push({ data: buf, filename: 'base.png', mime: 'image/png' })
  }

  const uploadedRefFiles = files
    .filter((f) => f.name === 'refFiles' || f.name === 'refFiles[]')
    .slice(0, MAX_REF_FILES)
    .map((f) => ({ data: f.data, filename: f.filename, mime: f.mime }))
  for (const file of uploadedRefFiles) validateImageUpload(file, 'refFiles')

  const extraRefs = await resolveReferenceImages({ uploadedFiles: uploadedRefFiles, imageUrls: refUrls })
  images.push(...extraRefs)

  const mask = maskFile
    ? { data: maskFile.data, filename: maskFile.filename, mime: maskFile.mime }
    : undefined

  const ed = await openAiEditImage({
    prompt: promptFinal,
    size,
    background: wantNoBackground ? 'transparent' : background,
    images,
    mask
  })

  // Only apply post background removal when explicitly requested.
  const post = await maybeRemoveBackground(ed.buffer, removeBg)
  const filenameBase = sanitizeFileBaseName(fields.filenameBase, 'ai-edit')
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
