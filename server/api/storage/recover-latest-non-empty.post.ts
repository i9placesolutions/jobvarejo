import { GetObjectCommand, ListObjectVersionsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { isUserProjectKey, isValidStoragePath } from '../../utils/storage-scope'
import { getOwnedProjectStorageRow, updateOwnedProjectCanvasData } from '../../utils/project-repository'

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

const streamToString = async (body: any): Promise<string> => {
  const stream = body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf-8')
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
    const content = await streamToString(object.Body)
    const json = JSON.parse(content)
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
  projectPrefix: string
): Promise<VersionCandidate | null> => {
  const versionsResult = await s3.send(
    new ListObjectVersionsCommand({
      Bucket: bucket,
      Prefix: projectPrefix,
      MaxKeys: 200
    })
  )

  const versions = (versionsResult.Versions || [])
    .filter((v) => !!v.Key && String(v.Key).endsWith('.json') && !!v.VersionId)
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
  enforceRateLimit(event, `storage-recover:${user.id}`, 30, 60_000)
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

  const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
  const region = process.env.WASABI_REGION || 'us-east-1'
  const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
  const accessKey = process.env.WASABI_ACCESS_KEY
  const secretKey = process.env.WASABI_SECRET_KEY

  if (!accessKey || !secretKey || !bucket) {
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

  const s3 = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    },
    forcePathStyle: true
  })

  let recovered = await findLatestNonEmptyByExactKey(s3, bucket, targetKey)
  if (!recovered) {
    recovered = await findLatestNonEmptyByProjectPrefix(s3, bucket, projectPrefix)
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

  const recoveredJsonString = JSON.stringify(recovered.json)
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      Body: recoveredJsonString,
      ContentType: 'application/json'
    })
  )

  const nextPageMeta = {
    ...(pageMeta || { id: pageId, name: 'Página', width: 1080, height: 1920, type: 'RETAIL_OFFER' }),
    canvasDataPath: targetKey,
    canvasData: recovered.json
  }

  const nextCanvasData = pageIndex >= 0
    ? pages.map((page: any, idx: number) => (idx === pageIndex ? nextPageMeta : page))
    : [...pages, nextPageMeta]

  const didUpdate = await updateOwnedProjectCanvasData(projectId, user.id, nextCanvasData)
  if (!didUpdate) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Recovered S3 version but failed to sync DB backup'
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
