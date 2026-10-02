import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client
} from '@aws-sdk/client-s3'
import { gunzipSync, gzipSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const ADMIN_STORAGE_ROOTS = ['imagens/', 'uploads/', 'projects/', 'logo/'] as const
export const ADMIN_STORAGE_BACKUP_PREFIX = 'admin-storage-backups/'
export const ADMIN_STORAGE_MAX_OBJECTS = 500
export const ADMIN_STORAGE_MAX_TEXT_BYTES = 1024 * 1024
export const ADMIN_STORAGE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export type AdminStorageKind = 'file' | 'folder'

export const adminStorageBucket = (): string => {
  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET não configurado.' })
  return bucket
}

const isInternalBackupKey = (key: string) => key.startsWith(ADMIN_STORAGE_BACKUP_PREFIX)

export const assertAdminStorageKey = (rawKey: unknown, opts: { allowFolder?: boolean; allowRoot?: boolean } = {}): string => {
  const key = String(rawKey ?? '')
  const folder = key.endsWith('/')
  if (!key || key.length > 1024 || key.startsWith('/') || key.includes('//') || key.includes('\\') || key.includes('?') || key.includes('#') || /[\u0000-\u001f\u007f]/.test(key) || /(^|\/)\.{1,2}(\/|$)/.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Chave de Storage inválida.' })
  }
  if (folder && !opts.allowFolder) throw createError({ statusCode: 400, statusMessage: 'Esperada uma chave de arquivo.' })
  if (isInternalBackupKey(key)) throw createError({ statusCode: 403, statusMessage: 'Acesso à área interna de backup bloqueado.' })
  if (!ADMIN_STORAGE_ROOTS.some(root => key.startsWith(root))) {
    throw createError({ statusCode: 403, statusMessage: 'A chave precisa pertencer a imagens/, uploads/, projects/ ou logo/.' })
  }
  if (!opts.allowRoot && ADMIN_STORAGE_ROOTS.includes(key as typeof ADMIN_STORAGE_ROOTS[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Não é permitido operar sobre a raiz do Storage.' })
  }
  return key
}

export const assertAdminStoragePrefix = (rawPrefix: unknown): string => {
  const prefix = String(rawPrefix ?? '')
  if (!prefix) return ''
  const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`
  return assertAdminStorageKey(normalized, { allowFolder: true, allowRoot: true })
}

export const assertNotServerManaged = (key: string) => {
  if (/^projects\/[^/]+\/enhancement-ledger\.json(?:\/|$)/.test(key) || /^projects\/[^/]+\/[^/]+\/enhancements(?:\/|$)/.test(key) || key.startsWith('imagens/catalogo-encartes/')) {
    throw createError({ statusCode: 403, statusMessage: 'Este objeto é gerenciado pelo sistema e não pode ser alterado por aqui.' })
  }
}

export const getAdminStorageObject = async (s3: S3Client, bucket: string, key: string) => s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${ADMIN_STORAGE_MAX_TEXT_BYTES}` }))

const copySource = (key: string) => key.split('/').map(part => encodeURIComponent(part)).join('/')
const isPublicKey = (key: string) => /^(imagens|uploads|logo)\//.test(key)

export const copyAdminStorageObject = async (s3: S3Client, bucket: string, sourceKey: string, destinationKey: string, sourceETag?: string) => {
  await s3.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: destinationKey,
    CopySource: `${bucket}/${copySource(sourceKey)}`,
    IfNoneMatch: '*',
    MetadataDirective: 'COPY',
    ...(isPublicKey(destinationKey) ? { ACL: 'public-read' } : {}),
    ...(sourceETag ? { CopySourceIfMatch: sourceETag } : {})
  }))
}

export const createAdminStorageBackupKey = (sourceKey: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const nonce = randomUUID()
  return `${ADMIN_STORAGE_BACKUP_PREFIX}${timestamp}/${nonce}/${sourceKey}`
}

export const backupAdminStorageObject = async (s3: S3Client, bucket: string, sourceKey: string, sourceETag?: string) => {
  const backupKey = createAdminStorageBackupKey(sourceKey)
  const etag = sourceETag || (await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: sourceKey }))).ETag
  if (!etag) throw createError({ statusCode: 409, statusMessage: 'O objeto mudou durante a operação. Atualize e tente novamente.' })
  await copyAdminStorageObject(s3, bucket, sourceKey, backupKey, etag)
  return backupKey
}

export const listAdminStorageTree = async (s3: S3Client, bucket: string, prefix: string, continuationToken?: string) => {
  const result = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: '/',
    MaxKeys: 100,
    ...(continuationToken ? { ContinuationToken: continuationToken } : {})
  }))

  const folders = (result.CommonPrefixes || [])
    .map(item => String(item.Prefix || ''))
    .filter(Boolean)
    .filter(key => !isInternalBackupKey(key))
    .map(key => ({ key, name: key.slice(prefix.length).replace(/\/$/, '') }))

  const listedFiles = (result.Contents || [])
    .filter(item => Boolean(item.Key) && !String(item.Key).endsWith('/') && !isInternalBackupKey(String(item.Key)))
  const files = await Promise.all(listedFiles.map(async item => {
    const key = String(item.Key)
    let contentType: string | null = null
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      contentType = head.ContentType || null
    } catch { /* lista permanece útil mesmo se o HeadObject de um item falhar */ }
    return {
      key,
      name: key.slice(prefix.length),
      size: Number(item.Size || 0),
      lastModified: item.LastModified?.toISOString() || null,
      etag: item.ETag || null,
      contentType
    }
  }))

  return {
    prefix,
    folders,
    files,
    nextToken: result.IsTruncated ? result.NextContinuationToken || null : null
  }
}

export const listPrefixObjects = async (s3: S3Client, bucket: string, prefix: string, limit = ADMIN_STORAGE_MAX_OBJECTS) => {
  const objects: Array<{ key: string; etag?: string; size?: number }> = []
  let token: string | undefined
  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: Math.min(1000, limit + 1 - objects.length),
      ...(token ? { ContinuationToken: token } : {})
    }))
    for (const item of result.Contents || []) {
      if (item.Key) objects.push({ key: item.Key, etag: item.ETag, size: item.Size })
      if (objects.length > limit) break
    }
    if (objects.length > limit || !result.IsTruncated || !result.NextContinuationToken) break
    token = result.NextContinuationToken
  } while (true)
  if (objects.length > limit) throw createError({ statusCode: 413, statusMessage: `A operação excede o limite de ${limit} objetos.` })
  return objects
}

export const hasAdminStoragePrefixObjects = async (s3: S3Client, bucket: string, prefix: string) => {
  const result = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1 }))
  return Boolean(result.Contents?.length)
}

export const assertAdminStorageObjectDoesNotExist = async (s3: S3Client, bucket: string, key: string) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    throw createError({ statusCode: 409, statusMessage: 'Já existe um objeto com esse nome.' })
  } catch (error: any) {
    if (Number(error?.$metadata?.httpStatusCode) === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') return
    throw error
  }
}

export const readAdminStorageText = async (s3: S3Client, bucket: string, key: string, contentLength?: number) => {
  if (Number(contentLength || 0) > ADMIN_STORAGE_MAX_TEXT_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Arquivos de texto acima de 1 MiB não podem ser editados nesta tela.' })
  }
  const object = await getAdminStorageObject(s3, bucket, key)
  if (!object.Body) throw createError({ statusCode: 404, statusMessage: 'Arquivo vazio ou indisponível.' })
  let bytes = Buffer.from(await object.Body.transformToByteArray())
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
  if (isGzip) {
    try { bytes = gunzipSync(bytes, { maxOutputLength: ADMIN_STORAGE_MAX_TEXT_BYTES + 1 }) }
    catch { throw createError({ statusCode: 422, statusMessage: 'Não foi possível descompactar o arquivo com segurança.' }) }
  }
  if (bytes.length > ADMIN_STORAGE_MAX_TEXT_BYTES) throw createError({ statusCode: 413, statusMessage: 'Arquivos de texto acima de 1 MiB não podem ser editados nesta tela.' })
  return { content: bytes.toString('utf8'), etag: object.ETag || null, contentType: object.ContentType || 'application/octet-stream', wasGzip: isGzip }
}

export const signedAdminStoragePreviewUrl = async (s3: S3Client, bucket: string, key: string) => getSignedUrl(
  s3,
  new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: 'inline' }),
  { expiresIn: 120 }
)

export const deleteAdminStorageObject = async (s3: S3Client, bucket: string, key: string, etag?: string) => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, ...(etag ? { IfMatch: etag } : {}) }))
}

export const deleteAdminStorageObjects = async (s3: S3Client, bucket: string, objects: Array<{ key: string; etag?: string }>) => {
  const deleted: string[] = []
  const errors: Array<{ key: string; code: string }> = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, objects.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= objects.length) return
      const object = objects[index]
      if (!object) return
      try { await deleteAdminStorageObject(s3, bucket, object.key, object.etag); deleted.push(object.key) }
      catch (error: any) { errors.push({ key: object.key, code: String(error?.name || 'DeleteFailed').slice(0, 80) }) }
    }
  }))
  return { deleted, errors }
}

export const setAdminStorageObjectText = async (s3: S3Client, bucket: string, key: string, content: string, current: {
  ContentType?: string
  ContentEncoding?: string
  CacheControl?: string
  ContentDisposition?: string
  ContentLanguage?: string
  Expires?: Date
  Metadata?: Record<string, string>
}, wasGzip: boolean, etag: string) => {
  const bytes = Buffer.from(content, 'utf8')
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: wasGzip ? gzipSync(bytes) : bytes,
    ContentType: current.ContentType || 'text/plain; charset=utf-8',
    ...(current.ContentEncoding ? { ContentEncoding: current.ContentEncoding } : {}),
    ...(current.CacheControl ? { CacheControl: current.CacheControl } : {}),
    ...(current.ContentDisposition ? { ContentDisposition: current.ContentDisposition } : {}),
    ...(current.ContentLanguage ? { ContentLanguage: current.ContentLanguage } : {}),
    ...(current.Expires ? { Expires: current.Expires } : {}),
    ...(current.Metadata ? { Metadata: current.Metadata } : {}),
    IfMatch: etag,
    ...(isPublicKey(key) ? { ACL: 'public-read' } : {})
  }))
}

export const putAdminStorageObject = async (s3: S3Client, bucket: string, key: string, body: Buffer, contentType: string, opts: {
  etag?: string
  current?: {
    ContentEncoding?: string
    CacheControl?: string
    ContentDisposition?: string
    ContentLanguage?: string
    Expires?: Date
    Metadata?: Record<string, string>
  }
} = {}) => {
  return s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(opts.etag ? { IfMatch: opts.etag } : { IfNoneMatch: '*' }),
    ...(opts.current?.ContentEncoding ? { ContentEncoding: opts.current.ContentEncoding } : {}),
    ...(opts.current?.CacheControl ? { CacheControl: opts.current.CacheControl } : {}),
    ...(opts.current?.ContentDisposition ? { ContentDisposition: opts.current.ContentDisposition } : {}),
    ...(opts.current?.ContentLanguage ? { ContentLanguage: opts.current.ContentLanguage } : {}),
    ...(opts.current?.Expires ? { Expires: opts.current.Expires } : {}),
    ...(opts.current?.Metadata ? { Metadata: opts.current.Metadata } : {}),
    ...(isPublicKey(key) ? { ACL: 'public-read' } : {})
  }))
}
