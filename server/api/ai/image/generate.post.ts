import { describeSiteStyle } from '~/server/utils/ai-site-style'
import { uploadBufferToContabo } from '~/server/utils/contabo-upload'
import { buildPromptFromInputs, maybeRemoveBackground, openAiGenerateImage, openAiEditImage, resolveReferenceImages } from '~/server/utils/openai-images'
import { createBlankPng, downloadImage } from '~/server/utils/image-processor'

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

  const mode = String(fields.mode || 'generate') as 'generate' | 'similar'
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
  const modelImageUrl = String(fields.modelImageUrl || '').trim()

  const modelFile = files.find((f) => f.name === 'modelFile')
  const refFiles = files
    .filter((f) => f.name === 'refFiles' || f.name === 'refFiles[]')
    .map((f) => ({ data: f.data, filename: f.filename, mime: f.mime }))

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

  const post = await maybeRemoveBackground(resultBuffer, removeBg || wantNoBackground)
  const up = await uploadBufferToContabo({
    buffer: post.buffer,
    contentType: post.mime,
    filenameBase: fields.filenameBase || 'ai-image',
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
