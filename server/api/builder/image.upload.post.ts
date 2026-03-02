import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { extractBuilderToken, hashBuilderToken, isBuilderFeatureEnabled } from '~/server/utils/builder'
import { getS3Client } from '~/server/utils/s3'
import { pgOneOrNull } from '~/server/utils/postgres'
import { enforceRateLimit } from '~/server/utils/rate-limit'

const MAX_FILE_BYTES = 12 * 1024 * 1024

const normalizeText = (value: unknown, maxLen = 200): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

const safeFileToken = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export default defineEventHandler(async (event) => {
  if (!isBuilderFeatureEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Builder indisponível no momento' })
  }

  const requesterIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `builder-image-upload:${requesterIp}`, 45, 60_000)

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'FormData obrigatório' })
  }

  const tokenField = form.find((item) => item.name === 'token')
  const token = extractBuilderToken(event, tokenField?.data ? Buffer.from(tokenField.data).toString('utf8') : '')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token de builder obrigatório' })
  }
  const tokenHash = hashBuilderToken(token)
  const tokenRow = await pgOneOrNull<{ token_id: string; project_id: string; status: string; expires_at: string | null }>(
    `select id as token_id, project_id, status, expires_at
     from public.project_builder_tokens
     where token_hash = $1
     limit 1`,
    [tokenHash]
  )
  if (!tokenRow?.token_id || tokenRow.status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'Token inválido' })
  }
  if (tokenRow.expires_at) {
    const expiresAt = new Date(String(tokenRow.expires_at))
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      throw createError({ statusCode: 403, statusMessage: 'Token expirado' })
    }
  }

  const filePart = form.find((item) => item.name === 'file')
  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo é obrigatório' })
  }

  const mime = normalizeText(filePart.type || '', 80).toLowerCase()
  if (!mime.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Apenas arquivos de imagem são permitidos' })
  }

  const fileBuffer = Buffer.from(filePart.data)
  if (fileBuffer.length <= 0 || fileBuffer.length > MAX_FILE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo inválido (máximo 12MB)' })
  }

  const originalName = normalizeText(filePart.filename || 'produto', 120)
  const extFromMime = mime.split('/')[1] || 'png'
  const signature = createHash('sha256')
    .update(fileBuffer.subarray(0, Math.min(fileBuffer.length, 1024)))
    .digest('hex')
    .slice(0, 12)
  const fileToken = safeFileToken(originalName || 'produto') || 'produto'
  const key = `builder/${tokenRow.project_id}/${Date.now()}-${fileToken}-${signature}.${extFromMime}`

  let uploadBuffer: Buffer = Buffer.from(fileBuffer)
  let contentType = mime
  try {
    const sharp = (await import('sharp')).default
    const optimized = await sharp(fileBuffer)
      .rotate()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, effort: 4 })
      .toBuffer()
    uploadBuffer = Buffer.from(optimized)
    contentType = 'image/webp'
  } catch {
    // Sharp is optional. Keep original file when unavailable.
  }

  const config = useRuntimeConfig()
  const bucket = String((config as any).wasabiBucket || process.env.WASABI_BUCKET || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'Bucket de storage não configurado' })
  }

  const client = getS3Client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: uploadBuffer,
    ContentType: contentType,
    ACL: 'public-read'
  }))

  const proxyUrl = `/api/storage/p?key=${encodeURIComponent(key)}`
  return {
    success: true,
    key,
    url: proxyUrl
  }
})
