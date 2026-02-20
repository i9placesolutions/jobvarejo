import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '~/server/utils/s3'

export type UploadBufferResult = {
  key: string
  url: string
  canonicalUrl: string
}

const sanitizeExt = (ext: string) => {
  const e = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (e === 'jpg') return 'jpeg'
  return e
}

export const uploadBufferToStorage = async (opts: {
  buffer: Buffer
  contentType: string
  filenameBase?: string
  folder?: string
  ext?: string
}): Promise<UploadBufferResult> => {
  const config = useRuntimeConfig()
  const bucketName = config.wasabiBucket
  const endpoint = config.wasabiEndpoint
  const s3 = getS3Client()

  const timestamp = Date.now()
  const folder = (opts.folder || 'uploads').replace(/^\/+|\/+$/g, '')
  const ext = sanitizeExt(opts.ext || opts.contentType.split('/')[1] || 'png') || 'png'
  const base = (opts.filenameBase || `ai-${timestamp}`).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const key = `${folder}/${timestamp}-${base}.${ext}`

  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: opts.buffer,
    ContentType: opts.contentType,
    ACL: 'public-read'
  }))

  const canonicalUrl = `https://${endpoint}/${bucketName}/${key}`
  const url = `${canonicalUrl}?v=${timestamp}`

  return { key, url, canonicalUrl }
}

// Backward-compatible alias.
export const uploadBufferToContabo = uploadBufferToStorage
