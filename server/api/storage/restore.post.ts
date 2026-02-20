import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { isUserProjectKey, isValidStoragePath } from '../../utils/storage-scope'
import { getOwnedProjectStorageRow, updateOwnedProjectCanvasData } from '../../utils/project-repository'

type RestoreBody = {
  projectId?: string
  pageId?: string
  source?: {
    kind?: 'version' | 'history'
    key?: string
    versionId?: string | null
  }
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

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `storage-restore:${user.id}`, 30, 60_000)
  const body = await readBody<RestoreBody>(event)
  const projectId = String(body?.projectId || '').trim()
  const pageId = String(body?.pageId || '').trim()
  const kind = (body?.source?.kind || 'version') as 'version' | 'history'
  const sourceKey = String(body?.source?.key || '').trim()
  const versionId = body?.source?.versionId ? String(body.source.versionId).trim() : null

  if (!projectId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and pageId are required' })
  }
  if (!sourceKey) {
    throw createError({ statusCode: 400, statusMessage: 'source.key is required' })
  }
  if (kind === 'version' && !versionId) {
    throw createError({ statusCode: 400, statusMessage: 'source.versionId is required for kind=version' })
  }
  const allowedProjectPrefix = `projects/${user.id}/${projectId}/`
  if (
    !isValidStoragePath(sourceKey) ||
    !isUserProjectKey(sourceKey, user.id) ||
    !sourceKey.startsWith(allowedProjectPrefix) ||
    !sourceKey.endsWith('.json')
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid source key for restore' })
  }

  const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
  const region = process.env.WASABI_REGION || 'us-east-1'
  const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
  const accessKey = process.env.WASABI_ACCESS_KEY
  const secretKey = process.env.WASABI_SECRET_KEY

  if (!accessKey || !secretKey || !bucket) {
    throw createError({ statusCode: 500, statusMessage: 'Wasabi credentials are not configured' })
  }

  const projectRow = await getOwnedProjectStorageRow(projectId, user.id)
  if (!projectRow) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const pages = Array.isArray(projectRow.canvas_data) ? projectRow.canvas_data : []
  const pageIndex = pages.findIndex((p: any) => String(p?.id || '') === pageId)
  const pageMeta = pageIndex >= 0 ? pages[pageIndex] : null

  const defaultTargetKey = `projects/${projectRow.user_id}/${projectId}/page_${pageId}.json`
  const targetKeyCandidate = String(pageMeta?.canvasDataPath || '').trim()
  const targetKey = (
    targetKeyCandidate &&
    isValidStoragePath(targetKeyCandidate) &&
    targetKeyCandidate.startsWith(allowedProjectPrefix) &&
    targetKeyCandidate.endsWith('.json')
  )
    ? targetKeyCandidate
    : defaultTargetKey

  const s3 = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true
  })

  // Read the chosen version/snapshot
  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
      VersionId: kind === 'version' ? versionId || undefined : undefined
    })
  )
  if (!obj.Body) {
    throw createError({ statusCode: 404, statusMessage: 'Source object not found' })
  }
  const text = await streamToString(obj.Body)
  const json = JSON.parse(text)
  const objectCount = getCanvasObjectCount(json)
  if (objectCount <= 0) {
    throw createError({ statusCode: 409, statusMessage: 'Selected version is empty, restore skipped' })
  }

  // Persist back as current page (S3 + DB mirror)
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      Body: JSON.stringify(json),
      ContentType: 'application/json'
    })
  )

  const nextPageMeta = {
    ...(pageMeta || { id: pageId, name: 'Página', width: 1080, height: 1920, type: 'RETAIL_OFFER' }),
    canvasDataPath: targetKey,
    canvasData: json
  }
  const nextCanvasData = pageIndex >= 0
    ? pages.map((page: any, idx: number) => (idx === pageIndex ? nextPageMeta : page))
    : [...pages, nextPageMeta]

  const didUpdate = await updateOwnedProjectCanvasData(projectId, user.id, nextCanvasData)
  if (!didUpdate) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Restored S3 version but failed to sync DB backup'
    })
  }

  return {
    ok: true,
    projectId,
    pageId,
    targetKey,
    source: { kind, key: sourceKey, versionId: kind === 'version' ? versionId : null },
    objectCount,
    restoredAt: new Date().toISOString()
  }
})
