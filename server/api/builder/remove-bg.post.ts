import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireBuilderTenant } from '../../utils/builder-auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { processImageWithOptions } from '../../utils/image-processor'

const streamToBuffer = async (body: any): Promise<Buffer> => {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  if (typeof body.arrayBuffer === 'function') {
    return Buffer.from(await body.arrayBuffer())
  }
  const chunks: Buffer[] = []
  for await (const chunk of body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Remove fundo de imagem armazenada no Wasabi.
 * Aceita: { s3Key: string } ou { imageUrl: string }
 */
export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  await enforceRateLimit(event, `builder-remove-bg:${tenant.id}`, 15, 60_000)

  const config = useRuntimeConfig()
  const bucket = config.wasabiBucket
  if (!bucket) throw createError({ statusCode: 500, statusMessage: 'Wasabi not configured' })

  const body = await readBody<{ s3Key?: string; imageUrl?: string }>(event)
  let s3Key = String(body?.s3Key || '').trim()

  // Extract key from proxy URL if needed
  if (!s3Key && body?.imageUrl) {
    const url = String(body.imageUrl)
    const match = url.match(/[?&]key=([^&]+)/)
    if (match?.[1]) s3Key = decodeURIComponent(match[1])
  }

  if (!s3Key) {
    throw createError({ statusCode: 400, statusMessage: 'S3 key is required' })
  }

  // Verify the key belongs to this tenant (prevent cross-tenant access)
  if (!s3Key.startsWith(`builder/${tenant.id}/`) && !s3Key.startsWith(`imagens/`) && !s3Key.startsWith(`uploads/`)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied to this storage key' })
  }

  const s3 = getS3Client()

  // Download from S3
  let rawBuffer: Buffer
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }))
    rawBuffer = await streamToBuffer(res.Body)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Image not found in storage' })
  }

  if (!rawBuffer.length) {
    throw createError({ statusCode: 400, statusMessage: 'Empty image' })
  }

  // Remove background
  let processedBuffer: Buffer
  try {
    processedBuffer = await processImageWithOptions(rawBuffer, {
      outputFormat: 'webp',
      forceBgRemoval: true,
    })
  } catch (err: any) {
    console.error('Builder remove-bg processing error:', err?.message)
    throw createError({ statusCode: 422, statusMessage: 'Erro ao remover fundo da imagem' })
  }

  // Save result
  const outputKey = `builder/${tenant.id}/products/bg-removed-${Date.now()}.webp`

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: outputKey,
    Body: processedBuffer,
    ContentType: 'image/webp',
  }))

  return {
    key: outputKey,
    url: `/api/storage/p?key=${encodeURIComponent(outputKey)}`,
  }
})
