import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { isUserProjectKey, isValidStoragePath } from '../../utils/storage-scope'
import { getOwnedProjectStorageRow, updateOwnedProjectCanvasData } from '../../utils/project-repository'
import { getS3Client } from '../../utils/s3'

const gunzipAsync = promisify(gunzip)

type RestoreBody = {
  projectId?: string
  pageId?: string
  source?: {
    kind?: 'version' | 'history' | 'current'
    key?: string
    versionId?: string | null
  }
}

const streamToBuffer = async (body: any): Promise<Buffer> => {
  const stream = body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const parseCanvasBuffer = async (buf: Buffer): Promise<any> => {
  try {
    const decompressed = await gunzipAsync(buf)
    return JSON.parse(decompressed.toString('utf-8'))
  } catch {
    return JSON.parse(buf.toString('utf-8'))
  }
}

const getCanvasObjectCount = (json: any): number => {
  const count = Number(json?.objects?.length || 0)
  return Number.isFinite(count) ? count : 0
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `storage-restore:${user.id}`, 30, 60_000)
  const body = await readBody<RestoreBody>(event)
  const projectId = String(body?.projectId || '').trim()
  const pageId = String(body?.pageId || '').trim()
  const kind = (body?.source?.kind || 'history') as 'version' | 'history' | 'current'
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
  // 'current' kind: restoring the current file onto itself — validate key as usual but skip empty check
  const allowedProjectPrefix = `projects/${user.id}/${projectId}/`
  if (
    !isValidStoragePath(sourceKey) ||
    !isUserProjectKey(sourceKey, user.id) ||
    !sourceKey.startsWith(allowedProjectPrefix) ||
    !sourceKey.endsWith('.json')
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid source key for restore' })
  }

  const bucket = process.env.WASABI_BUCKET || 'jobvarejo'

  if (!bucket) {
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

  const s3 = getS3Client()

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
  const buf = await streamToBuffer(obj.Body)
  const json = await parseCanvasBuffer(buf)
  if (!json) {
    throw createError({ statusCode: 422, statusMessage: 'Failed to parse source canvas data' })
  }
  const objectCount = getCanvasObjectCount(json)
  if (objectCount <= 0) {
    throw createError({ statusCode: 409, statusMessage: 'Selected version is empty, restore skipped' })
  }

  // If restoring the current file onto itself, skip the S3 write (no-op)
  const isCurrentOntoItself = kind === 'current' && sourceKey === targetKey
  if (!isCurrentOntoItself) {
    // Persist back as current page (S3 + DB mirror)
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: targetKey,
        Body: JSON.stringify(json),
        ContentType: 'application/json'
      })
    )
  }

  const nextPageMeta = {
    ...(pageMeta || { id: pageId, name: 'Página', width: 1080, height: 1920, type: 'RETAIL_OFFER' }),
    canvasDataPath: targetKey,
    canvasSavedAt: Number((json as any)?.__savedAt || (json as any)?.savedAt || Date.now())
  }
  const nextCanvasData = pageIndex >= 0
    ? pages.map((page: any, idx: number) => (idx === pageIndex ? nextPageMeta : page))
    : [...pages, nextPageMeta]

  const didUpdate = await updateOwnedProjectCanvasData(projectId, user.id, nextCanvasData)
  if (!didUpdate) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Restored S3 version but failed to sync DB metadata'
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
