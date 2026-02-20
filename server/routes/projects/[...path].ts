/**
 * Proxy route for project assets stored in Wasabi (S3 compatible).
 */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { requireAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  const rawPath = String(getRouterParam(event, 'path') || '').trim()
  const path = rawPath.replace(/^\/+/, '')

  if (!path || path.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }
  if (!path.startsWith(`${user.id}/`)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden path scope' })
  }

  const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
  const region = process.env.WASABI_REGION || 'us-east-1'
  const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
  const accessKey = process.env.WASABI_ACCESS_KEY
  const secretKey = process.env.WASABI_SECRET_KEY
  if (!bucket || !accessKey || !secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Wasabi Storage not configured'
    })
  }

  const s3Client = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    },
    forcePathStyle: true
  })

  const key = `projects/${path}`

  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }))

    if (!response?.Body) {
      throw createError({ statusCode: 404, statusMessage: 'Image not found' })
    }

    const stream = response.Body as Readable
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    setResponseHeaders(event, {
      'Content-Type': response.ContentType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
    if (response.ContentLength) {
      setResponseHeader(event, 'Content-Length', Number(response.ContentLength))
    }

    return body
  } catch (error: any) {
    const notFound = error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404
    throw createError({
      statusCode: notFound ? 404 : 500,
      statusMessage: notFound ? `Image not found: ${path}` : 'Failed to load image'
    })
  }
})
