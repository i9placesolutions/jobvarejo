import { GetObjectCommand, ListObjectVersionsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getOwnedProjectStorageRow } from '../../utils/project-repository'

type HistoryItem = {
  source: 'version' | 'history'
  key: string
  versionId?: string | null
  lastModified: string
  size?: number | null
  objectCount?: number | null
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

const isValidIdentifier = (value: string, maxLen: number): boolean =>
  /^[A-Za-z0-9_-]+$/.test(value) && value.length > 0 && value.length <= maxLen

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `storage-history:${user.id}`, 60, 60_000)
  const query = getQuery(event)
  const projectId = String(query.projectId || '').trim()
  const pageId = String(query.pageId || '').trim()

  if (!projectId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and pageId are required' })
  }
  if (!isValidIdentifier(projectId, 80) || !isValidIdentifier(pageId, 80)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid projectId/pageId format' })
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
  const pageMeta = pages.find((p: any) => String(p?.id || '') === pageId) || null
  const targetKey =
    String(pageMeta?.canvasDataPath || '').trim() ||
    `projects/${projectRow.user_id}/${projectId}/page_${pageId}.json`
  const historyPrefix = `projects/${projectRow.user_id}/${projectId}/history/page_${pageId}/`

  const s3 = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true
  })

  const items: HistoryItem[] = []

  // 1) S3 versions for the canonical page key (if bucket has versioning enabled).
  try {
    const versionsResult = await s3.send(
      new ListObjectVersionsCommand({ Bucket: bucket, Prefix: targetKey, MaxKeys: 40 })
    )
    const versions = (versionsResult.Versions || [])
      .filter((v) => String(v.Key || '') === targetKey && !!v.VersionId)
      .sort((a, b) => new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime())
      .slice(0, 12)

    for (const v of versions) {
      items.push({
        source: 'version',
        key: targetKey,
        versionId: String(v.VersionId || ''),
        lastModified: new Date(v.LastModified || 0).toISOString(),
        size: Number(v.Size || 0) || null
      })
    }
  } catch {
    // ignore list versions failures
  }

  // 2) History snapshots (writes via /api/storage/history-snapshot)
  try {
    const listHistory = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: historyPrefix, MaxKeys: 60 })
    )
    const objects = (listHistory.Contents || [])
      .filter((o) => !!o.Key && String(o.Key).endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime())
      .slice(0, 20)

    for (const obj of objects) {
      const key = String(obj.Key || '')
      if (!key) continue
      items.push({
        source: 'history',
        key,
        versionId: null,
        lastModified: new Date(obj.LastModified || 0).toISOString(),
        size: Number(obj.Size || 0) || null
      })
    }
  } catch {
    // ignore history list failures
  }

  // Enrich a few recent entries with objectCount so the UI can show "non-empty".
  const toEnrich = items
    .slice()
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
    .slice(0, 8)

  for (const entry of toEnrich) {
    try {
      const getCmd = new GetObjectCommand({
        Bucket: bucket,
        Key: entry.key,
        VersionId: entry.source === 'version' ? String(entry.versionId || '') : undefined
      })
      const object = await s3.send(getCmd)
      if (!object.Body) continue
      const text = await streamToString(object.Body)
      const json = JSON.parse(text)
      const count = getCanvasObjectCount(json)
      entry.objectCount = Number.isFinite(count) ? count : null
    } catch {
      // ignore
    }
  }

  const unique = new Map<string, HistoryItem>()
  for (const it of items) {
    const k = `${it.source}:${it.key}:${it.source === 'version' ? it.versionId : ''}:${it.lastModified}`
    if (!unique.has(k)) unique.set(k, it)
  }

  const finalItems = Array.from(unique.values()).sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  )

  return {
    targetKey,
    historyPrefix,
    items: finalItems
  }
})
