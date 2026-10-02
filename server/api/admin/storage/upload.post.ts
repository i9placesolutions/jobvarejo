import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { gunzipSync } from 'node:zlib'
import { getS3Client } from '../../../../server/utils/s3'
import { requireSuperAdminUser } from '../../../../server/utils/auth'
import { enforceRateLimit } from '../../../../server/utils/rate-limit'
import {
  ADMIN_STORAGE_MAX_UPLOAD_BYTES,
  adminStorageBucket,
  assertAdminStorageKey,
  assertNotServerManaged,
  backupAdminStorageObject,
  putAdminStorageObject
} from '../../../../server/utils/admin-storage-manager'

const normalizeEtag = (value: unknown) => String(value || '').trim().replace(/^W\//, '').replace(/^"|"$/g, '')
const validateJsonUpload = (key: string, bytes: Buffer) => {
  const isJson = key.toLowerCase().endsWith('.json')
  const isJsonGzip = key.toLowerCase().endsWith('.json.gz')
  if (!isJson && !isJsonGzip) return
  const compressed = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
  if (isJsonGzip && !compressed) throw createError({ statusCode: 400, statusMessage: 'Arquivos .json.gz precisam estar compactados em gzip.' })
  let content = bytes
  if (compressed) {
    try { content = gunzipSync(bytes, { maxOutputLength: ADMIN_STORAGE_MAX_UPLOAD_BYTES + 1 }) }
    catch { throw createError({ statusCode: 400, statusMessage: 'O arquivo gzip é inválido ou excede o limite após descompactação.' }) }
  }
  if (content.length > ADMIN_STORAGE_MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, statusMessage: 'O JSON descompactado está limitado a 20 MiB.' })
  try { JSON.parse(content.toString('utf8')) }
  catch { throw createError({ statusCode: 400, statusMessage: 'O arquivo enviado não contém JSON válido.' }) }
}

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-storage-upload:${user.id}`, 20, 60_000)

  const query = getQuery(event)
  const key = assertAdminStorageKey(query.key)
  assertNotServerManaged(key)
  const declaredLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (declaredLength > ADMIN_STORAGE_MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'O upload está limitado a 20 MiB.' })
  }
  const rawBody = await readRawBody(event, false)
  const bytes = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '')
  if (!bytes.length) throw createError({ statusCode: 400, statusMessage: 'O arquivo enviado está vazio.' })
  if (bytes.length > ADMIN_STORAGE_MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, statusMessage: 'O upload está limitado a 20 MiB.' })
  validateJsonUpload(key, bytes)

  const requestedContentType = String(query.contentType || getRequestHeader(event, 'content-type') || '').trim()
  const rawContentType = requestedContentType || 'application/octet-stream'
  if (rawContentType.length > 200 || /[\r\n\u0000]/.test(rawContentType)) {
    throw createError({ statusCode: 400, statusMessage: 'Content-Type inválido.' })
  }
  const contentType = rawContentType || 'application/octet-stream'

  const s3 = getS3Client()
  const bucket = adminStorageBucket()
  const replace = String(query.replace || '').toLowerCase() === 'true'
  let backupKey: string | undefined
  let etag: string | undefined
  try {
    if (replace) {
      const expectedETag = String(query.etag || '').trim()
      if (!expectedETag) throw createError({ statusCode: 428, statusMessage: 'Informe o ETag atual para substituir o arquivo com segurança.' })
      const current = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      if (normalizeEtag(current.ETag) !== normalizeEtag(expectedETag)) {
        throw createError({ statusCode: 409, statusMessage: 'O arquivo foi alterado desde a leitura. Atualize antes de substituir.' })
      }
      backupKey = await backupAdminStorageObject(s3, bucket, key, current.ETag || undefined)
      const effectiveContentType = query.contentType || getRequestHeader(event, 'content-type') ? contentType : current.ContentType || contentType
      const saved = await putAdminStorageObject(s3, bucket, key, bytes, effectiveContentType, {
        etag: current.ETag || expectedETag,
        current
      })
      etag = saved.ETag
    } else {
      const saved = await putAdminStorageObject(s3, bucket, key, bytes, contentType)
      etag = saved.ETag
    }
  } catch (error: any) {
    if (Number(error?.$metadata?.httpStatusCode) === 412 || error?.name === 'PreconditionFailed') {
      if (replace) throw createError({ statusCode: 409, statusMessage: 'O arquivo mudou antes da substituição; backup preservado.', data: { key, backupKey } })
      throw createError({ statusCode: 409, statusMessage: 'Já existe um objeto com esse nome.' })
    }
    if (replace && backupKey) throw createError({ statusCode: 500, statusMessage: 'A substituição falhou; backup preservado.', data: { key, backupKey } })
    throw error
  }
  return { ok: true, key, size: bytes.length, contentType, ...(backupKey ? { backupKey } : {}), etag: etag || null }
})
