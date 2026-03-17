import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getOwnedProjectStorageRow } from '../../utils/project-repository'

const gunzipAsync = promisify(gunzip)

type HistoryItem = {
  source: 'current' | 'history'
  key: string
  versionId?: string | null
  lastModified: string
  size?: number | null
  objectCount?: number | null
}

const HISTORY_MAX_SNAPSHOTS = 3

const extractHistorySlot = (key: string): number | null => {
  const m = String(key || '').match(/\/v([1-9][0-9]*)\.json$/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 1 || n > HISTORY_MAX_SNAPSHOTS) return null
  return n
}

const streamToBuffer = async (body: any): Promise<Buffer> => {
  const stream = body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const parseCanvasBuffer = async (buf: Buffer): Promise<any> => {
  // Try gzip decompression first (files are stored gzip-compressed)
  try {
    const decompressed = await gunzipAsync(buf)
    return JSON.parse(decompressed.toString('utf-8'))
  } catch {
    // Fallback: try parsing raw (uncompressed)
    try {
      return JSON.parse(buf.toString('utf-8'))
    } catch {
      return null
    }
  }
}

const getCanvasObjectCount = (json: any): number => {
  const count = Number(json?.objects?.length || 0)
  return Number.isFinite(count) ? count : 0
}

const isValidIdentifier = (value: string, maxLen: number): boolean =>
  /^[A-Za-z0-9_-]+$/.test(value) && value.length > 0 && value.length <= maxLen

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `storage-history:${user.id}`, 60, 60_000)
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

  const historyPrefix = `projects/${projectRow.user_id}/${projectId}/history/page_${pageId}/`
  const currentKey = `projects/${projectRow.user_id}/${projectId}/page_${pageId}.json`

  const s3 = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true
  })

  const items: HistoryItem[] = []

  // --- Current save: always include the main canvas file as the newest entry ---
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: currentKey }))
    if (head.LastModified) {
      items.push({
        source: 'current',
        key: currentKey,
        versionId: null,
        lastModified: new Date(head.LastModified).toISOString(),
        size: Number(head.ContentLength || 0) || null
      })
    }
  } catch {
    // Current file doesn't exist yet — ignore
  }

  // --- History snapshots (ring buffer: v1..v3) ---
  try {
    const objectsRaw: any[] = []
    let continuationToken: string | undefined
    let truncated = true
    while (truncated) {
      const listHistory = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: historyPrefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken
        })
      )
      objectsRaw.push(...(listHistory.Contents || []))
      truncated = Boolean(listHistory.IsTruncated)
      continuationToken = listHistory.NextContinuationToken
      if (!truncated) break
    }

    const objects = objectsRaw
      .filter((o) => {
        const key = String(o?.Key || '')
        if (!key.endsWith('.json')) return false
        return extractHistorySlot(key) != null
      })
      .sort((a, b) => new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime())

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

  // --- Enrich all entries with objectCount (handles gzip-compressed files) ---
  for (const entry of items) {
    try {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: entry.key }))
      if (!object.Body) continue
      const buf = await streamToBuffer(object.Body)
      const json = await parseCanvasBuffer(buf)
      if (json) {
        const count = getCanvasObjectCount(json)
        entry.objectCount = Number.isFinite(count) ? count : null
      }
    } catch {
      // ignore enrichment failures
    }
  }

  const unique = new Map<string, HistoryItem>()
  for (const it of items) {
    const k = `${it.source}:${it.key}:${it.lastModified}`
    if (!unique.has(k)) unique.set(k, it)
  }

  const finalItems = Array.from(unique.values()).sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  )

  return {
    historyPrefix,
    maxSnapshots: HISTORY_MAX_SNAPSHOTS,
    items: finalItems
  }
})
