import { downloadImage, processImageWithOptions } from '~/server/utils/image-processor'
import { assertSafeExternalHttpUrl } from '~/server/utils/url-safety'

const OPENAI_IMAGES_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations'
const OPENAI_IMAGES_EDITS_URL = 'https://api.openai.com/v1/images/edits'

export type OpenAiImageResult = {
  buffer: Buffer
  mime: string
}

const asString = (v: any) => (v == null ? '' : String(v))

const guessExtFromMime = (mime: string) => {
  const m = String(mime || '').toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpeg'
  return 'png'
}

const decodeB64Image = (data: any): Buffer => {
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI did not return b64_json')
  return Buffer.from(String(b64), 'base64')
}

export const openAiGenerateImage = async (opts: {
  prompt: string
  size?: '1024x1024' | '1024x1536' | '1536x1024'
  background?: 'transparent' | 'white'
}): Promise<OpenAiImageResult> => {
  const config = useRuntimeConfig()
  const apiKey = config.openaiApiKey
  if (!apiKey) throw new Error('OpenAI API Key not configured')

  const res = await fetch(OPENAI_IMAGES_GENERATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: opts.prompt,
      size: opts.size || '1024x1024',
      ...(opts.background ? { background: opts.background } : {})
    })
  })
  const json: any = await res.json()
  if (!res.ok) {
    const msg = json?.error?.message || `OpenAI error (${res.status})`
    throw new Error(msg)
  }
  const buffer = decodeB64Image(json)
  return { buffer, mime: 'image/png' }
}

const partDataToBlob = (buf: Buffer, mime: string) => new Blob([Uint8Array.from(buf)], { type: mime })

export const openAiEditImage = async (opts: {
  prompt: string
  size?: '1024x1024' | '1024x1536' | '1536x1024'
  background?: 'transparent' | 'white'
  // Base image + extra reference images (logos, style refs, etc.)
  images: Array<{ data: Buffer; filename: string; mime: string }>
  // Mask: transparent pixels are the edit region
  mask?: { data: Buffer; filename: string; mime: string }
}): Promise<OpenAiImageResult> => {
  const config = useRuntimeConfig()
  const apiKey = config.openaiApiKey
  if (!apiKey) throw new Error('OpenAI API Key not configured')

  const form = new FormData()
  form.append('model', 'gpt-image-1')
  form.append('prompt', opts.prompt)
  form.append('size', opts.size || '1024x1024')
  if (opts.background) form.append('background', opts.background)

  // OpenAI supports `image[]` in edits; send all references.
  for (const img of opts.images) {
    form.append('image[]', partDataToBlob(img.data, img.mime), img.filename)
  }
  if (opts.mask) {
    form.append('mask', partDataToBlob(opts.mask.data, opts.mask.mime), opts.mask.filename)
  }

  const res = await fetch(OPENAI_IMAGES_EDITS_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form as any
  })
  const json: any = await res.json()
  if (!res.ok) {
    const msg = json?.error?.message || `OpenAI error (${res.status})`
    throw new Error(msg)
  }
  const buffer = decodeB64Image(json)
  return { buffer, mime: 'image/png' }
}

export const buildPromptFromInputs = (opts: {
  prompt: string
  negativePrompt?: string
  siteStyleNotes?: string
  wantNoBackground?: boolean
  extraInstructions?: string
}) => {
  const base = asString(opts.prompt).trim()
  const negative = asString(opts.negativePrompt).trim()
  const site = asString(opts.siteStyleNotes).trim()
  const extra = asString(opts.extraInstructions).trim()

  const lines: string[] = []
  if (base) lines.push(base)
  if (site) lines.push(`Referência de estilo (site): ${site}`)
  if (extra) lines.push(`Instruções extras: ${extra}`)
  if (opts.wantNoBackground) lines.push('Saída sem fundo (fundo transparente).')
  if (negative) lines.push(`Evitar: ${negative}`)
  return lines.filter(Boolean).join('\n')
}

export const maybeRemoveBackground = async (buffer: Buffer, enabled: boolean) => {
  // NOTE: This should only run when the user explicitly requests post background removal.
  // If OpenAI already returns a transparent PNG (background=transparent), running another
  // background-removal pass can punch holes inside the subject (e.g. logos).
  if (!enabled) return { buffer, mime: 'image/png', ext: 'png' }
  const out = await processImageWithOptions(buffer, { outputFormat: 'png' })
  return { buffer: out, mime: 'image/png', ext: 'png' }
}

export const resolveReferenceImages = async (opts: {
  uploadedFiles: Array<{ data: Buffer; filename: string; mime: string }>
  imageUrls: string[]
}): Promise<Array<{ data: Buffer; filename: string; mime: string }>> => {
  const MAX_REFERENCE_IMAGES = 8
  const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
  const out: Array<{ data: Buffer; filename: string; mime: string }> = []
  for (const f of opts.uploadedFiles.slice(0, MAX_REFERENCE_IMAGES)) {
    const mime = String(f?.mime || '').toLowerCase()
    const size = Number(f?.data?.length || 0)
    if (!mime.startsWith('image/')) continue
    if (!Number.isFinite(size) || size <= 0 || size > MAX_REFERENCE_IMAGE_BYTES) continue
    out.push(f)
  }
  for (const u of opts.imageUrls.slice(0, MAX_REFERENCE_IMAGES)) {
    if (out.length >= MAX_REFERENCE_IMAGES) break
    const url = String(u || '').trim()
    if (!url) continue
    const safeUrl = assertSafeExternalHttpUrl(url, { maxLength: 2048 })
    const buf = await downloadImage(safeUrl, { maxBytes: MAX_REFERENCE_IMAGE_BYTES, timeoutMs: 15_000 })
    out.push({
      data: buf,
      filename: `ref-${Math.random().toString(36).slice(2)}.${guessExtFromMime('image/png')}`,
      mime: 'image/png'
    })
  }
  return out
}
