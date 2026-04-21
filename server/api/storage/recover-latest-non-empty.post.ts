import { GetObjectCommand, ListObjectVersionsCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { gunzipSync, gzipSync } from 'node:zlib'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { isUserProjectKey, isValidStoragePath } from '../../utils/storage-scope'
import { getOwnedProjectStorageRow, updateOwnedProjectCanvasData } from '../../utils/project-repository'
import { getS3Client } from '../../utils/s3'

type RecoverBody = {
  projectId?: string
  pageId?: string
  preferredKey?: string | null
}

type VersionCandidate = {
  key: string
  versionId: string
  lastModified: Date
  objectCount: number
  json: any
}

const streamToBuffer = async (body: any): Promise<Buffer> => {
  const stream = body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

// Detecta gzip pelos dois bytes magicos 0x1f 0x8b e descompacta quando necessario.
// O upload normal (composables/useStorage.ts) comprime canvas em gzip por padrao,
// portanto o recovery precisa suportar ambos: gzip (novo) e JSON puro (legado/fallback).
const parseCanvasBody = (buf: Buffer): any => {
  let text: string
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    text = gunzipSync(buf).toString('utf-8')
  } else {
    text = buf.toString('utf-8')
  }
  return JSON.parse(text)
}

const getCanvasObjectCount = (json: any): number => {
  const count = Number(json?.objects?.length || 0)
  return Number.isFinite(count) ? count : 0
}

const tryReadObject = async (
  s3: S3Client,
  bucket: string,
  key: string,
  opts: { versionId?: string; fallbackLastModified?: Date; fallbackVersionId?: string } = {}
): Promise<VersionCandidate | null> => {
  try {
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        VersionId: opts.versionId
      })
    )
    if (!object.Body) return null
    const buf = await streamToBuffer(object.Body)
    const json = parseCanvasBody(buf)
    const objectCount = getCanvasObjectCount(json)
    if (objectCount <= 0) return null

    return {
      key,
      versionId: opts.versionId || opts.fallbackVersionId || 'no-version',
      lastModified: object.LastModified || opts.fallbackLastModified || new Date(0),
      objectCount,
      json
    }
  } catch {
    return null
  }
}

const findLatestNonEmptyByExactKey = async (
  s3: S3Client,
  bucket: string,
  key: string
): Promise<VersionCandidate | null> => {
  const versionsResult = await s3.send(
    new ListObjectVersionsCommand({
      Bucket: bucket,
      Prefix: key,
      MaxKeys: 80
    })
  )

  const versions = (versionsResult.Versions || [])
    .filter((v) => String(v.Key || '') === key && !!v.VersionId)
    .sort((a, b) => {
      const ta = new Date(a.LastModified || 0).getTime()
      const tb = new Date(b.LastModified || 0).getTime()
      return tb - ta
    })

  for (const version of versions) {
    const versionId = String(version.VersionId || '')
    if (!versionId) continue
    const candidate = await tryReadObject(s3, bucket, key, { versionId })
    if (candidate) return candidate
  }
  return null
}

const findLatestNonEmptyByProjectPrefix = async (
  s3: S3Client,
  bucket: string,
  projectPrefix: string,
  pageId: string
): Promise<VersionCandidate | null> => {
  // CORRECAO: o prefix termina em .../page_, o que casa com page_QUALQUERCOISA.json.
  // Sem filtro adicional, o recovery podia restaurar a pagina A com o canvas da pagina B.
  // Agora exigimos match exato de page_${pageId}.json (ignorando ?versionId=...).
  const expectedSuffix = `/page_${pageId}.json`

  const versionsResult = await s3.send(
    new ListObjectVersionsCommand({
      Bucket: bucket,
      Prefix: projectPrefix,
      MaxKeys: 200
    })
  )

  const versions = (versionsResult.Versions || [])
    .filter((v) => {
      const key = String(v.Key || '')
      return key.endsWith(expectedSuffix) && !!v.VersionId
    })
    .sort((a, b) => {
      const ta = new Date(a.LastModified || 0).getTime()
      const tb = new Date(b.LastModified || 0).getTime()
      return tb - ta
    })

  for (const version of versions) {
    const key = String(version.Key || '')
    const versionId = String(version.VersionId || '')
    if (!key || !versionId) continue
    const candidate = await tryReadObject(s3, bucket, key, { versionId })
    if (candidate) return candidate
  }

  return null
}

const findLatestNonEmptyByHistoryPrefix = async (
  s3: S3Client,
  bucket: string,
  historyPrefix: string
): Promise<VersionCandidate | null> => {
  const listResult = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: historyPrefix,
      MaxKeys: 100
    })
  )

  const objects = (listResult.Contents || [])
    .filter((obj) => !!obj.Key && String(obj.Key).endsWith('.json'))
    .sort((a, b) => {
      const ta = new Date(a.LastModified || 0).getTime()
      const tb = new Date(b.LastModified || 0).getTime()
      return tb - ta
    })

  for (const object of objects) {
    const key = String(object.Key || '')
    if (!key) continue
    const candidate = await tryReadObject(s3, bucket, key, {
      fallbackLastModified: object.LastModified || new Date(0),
      fallbackVersionId: `history:${new Date(object.LastModified || 0).toISOString()}`
    })
    if (candidate) return candidate
  }

  return null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `storage-recover:${user.id}`, 30, 60_000)
  const body = await readBody<RecoverBody>(event)
  const projectId = String(body?.projectId || '').trim()
  const pageId = String(body?.pageId || '').trim()
  const preferredKey = String(body?.preferredKey || '').trim() || null

  if (!projectId || !pageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'projectId and pageId are required'
    })
  }

  const bucket = process.env.WASABI_BUCKET || 'jobvarejo'

  if (!bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Wasabi credentials are not configured'
    })
  }

  const projectRow = await getOwnedProjectStorageRow(projectId, user.id)
  if (!projectRow) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found for recovery'
    })
  }

  const pages = Array.isArray(projectRow.canvas_data) ? projectRow.canvas_data : []
  const pageIndex = pages.findIndex((p: any) => String(p?.id || '') === pageId)
  const pageMeta = pageIndex >= 0 ? pages[pageIndex] : null

  const targetKey =
    preferredKey ||
    String(pageMeta?.canvasDataPath || '').trim() ||
    `projects/${projectRow.user_id}/${projectId}/page_${pageId}.json`
  if (
    !isValidStoragePath(targetKey) ||
    !isUserProjectKey(targetKey, user.id) ||
    !targetKey.endsWith('.json')
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid target key for recovery'
    })
  }

  const projectPrefix = `projects/${projectRow.user_id}/${projectId}/page_`
  const historyPrefix = `projects/${projectRow.user_id}/${projectId}/history/page_${pageId}/`

  const s3 = getS3Client()

  let recovered = await findLatestNonEmptyByExactKey(s3, bucket, targetKey)
  if (!recovered) {
    recovered = await findLatestNonEmptyByProjectPrefix(s3, bucket, projectPrefix, pageId)
  }
  if (!recovered) {
    recovered = await findLatestNonEmptyByHistoryPrefix(s3, bucket, historyPrefix)
  }

  if (!recovered) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No non-empty canvas version found for recovery'
    })
  }

  // Re-escreve no formato gzip (padrao do upload normal) para manter consistencia.
  // Se falhar por algum motivo, caimos no JSON puro, que ainda e decodificavel
  // pelo parseCanvasBody no proximo recovery.
  const recoveredJsonString = JSON.stringify(recovered.json)
  let recoveredBody: Buffer | string = recoveredJsonString
  let recoveredContentType = 'application/json'
  try {
    recoveredBody = gzipSync(Buffer.from(recoveredJsonString, 'utf-8'))
    recoveredContentType = 'application/octet-stream'
  } catch (gzipErr) {
    console.warn('[storage-recovery] gzipSync falhou; gravando JSON puro:', gzipErr)
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      Body: recoveredBody,
      ContentType: recoveredContentType
    })
  )

  const nextPageMeta = {
    ...(pageMeta || { id: pageId, name: 'Página', width: 1080, height: 1920, type: 'RETAIL_OFFER' }),
    canvasDataPath: targetKey,
    canvasSavedAt: Number((recovered.json as any)?.__savedAt || (recovered.json as any)?.savedAt || Date.now())
  }

  const nextCanvasData = pageIndex >= 0
    ? pages.map((page: any, idx: number) => (idx === pageIndex ? nextPageMeta : page))
    : [...pages, nextPageMeta]

  const didUpdate = await updateOwnedProjectCanvasData(projectId, user.id, nextCanvasData)
  if (!didUpdate) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Recovered S3 version but failed to sync DB metadata'
    })
  }

  const recoveredAt = new Date().toISOString()
  console.warn('🛟 [storage-recovery] Recovered non-empty canvas version', {
    projectId,
    pageId,
    targetKey,
    sourceKey: recovered.key,
    versionId: recovered.versionId,
    objectCount: recovered.objectCount,
    recoveredAt
  })

  return {
    key: targetKey,
    versionId: recovered.versionId,
    objectCount: recovered.objectCount,
    recoveredAt,
    json: recovered.json
  }
})
