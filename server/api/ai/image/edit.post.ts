import { describeSiteStyle } from '~/server/utils/ai-site-style'
import { uploadBufferToContabo } from '~/server/utils/contabo-upload'
import { buildPromptFromInputs, maybeRemoveBackground, openAiEditImage, resolveReferenceImages } from '~/server/utils/openai-images'
import { downloadImage } from '~/server/utils/image-processor'

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

const parseListField = (raw: string | undefined) => {
  const s = String(raw || '').trim()
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : []
  } catch {
    return s.split('\n').map((x) => x.trim()).filter(Boolean)
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OpenAI API Key not configured' })
  }

  const { fields, files } = await parseMultipart(event)

  const prompt = String(fields.prompt || '').trim()
  if (!prompt) throw createError({ statusCode: 400, statusMessage: 'prompt required' })

  const size = (String(fields.size || '1024x1024') as any)
  const background = (String(fields.background || '') as any) || undefined
  const removeBg = String(fields.removeBg || '').toLowerCase() === 'true' || String(fields.removeBg) === '1'
  const wantNoBackground = String(fields.transparent || '').toLowerCase() === 'true' || String(fields.transparent) === '1'

  const negativePrompt = String(fields.negativePrompt || '').trim() || undefined
  const extraInstructions = String(fields.extraInstructions || '').trim() || undefined

  const siteUrl = String(fields.siteUrl || '').trim()
  const siteNotes = siteUrl ? (await describeSiteStyle(siteUrl)).styleNotes : undefined

  const refUrls = parseListField(fields.refUrls)
  const baseImageUrl = String(fields.baseImageUrl || '').trim()

  const baseFile = files.find((f) => f.name === 'baseFile')
  const maskFile = files.find((f) => f.name === 'maskFile')
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
    .map((f) => ({ data: f.data, filename: f.filename, mime: f.mime }))
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

  const post = await maybeRemoveBackground(ed.buffer, removeBg || wantNoBackground)
  const up = await uploadBufferToContabo({
    buffer: post.buffer,
    contentType: post.mime,
    filenameBase: fields.filenameBase || 'ai-edit',
    folder: 'uploads',
    ext: 'png'
  })

  return {
    success: true,
    url: up.url,
    canonicalUrl: up.canonicalUrl,
    key: up.key
  }
})

