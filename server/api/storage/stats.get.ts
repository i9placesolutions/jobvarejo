import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getS3Client } from '~/server/utils/s3'
import { requireAdminUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { isValidStoragePath, normalizeStoragePath } from '../../utils/storage-scope'

type PrefixStats = {
  prefix: string
  objects: number
  bytes: number
  truncated: boolean
  scanned: number
}

const toInt = (v: any, fallback: number) => {
  const n = Number.parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const formatBytes = (bytes: number) => {
  const b = Math.max(0, Number(bytes) || 0)
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = b
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

const scanPrefix = async (opts: {
  s3: any
  bucket: string
  prefix: string
  maxKeysTotal: number
}) => {
  let token: string | undefined
  let objects = 0
  let bytes = 0
  let scanned = 0
  let truncated = false

  // We still need to list objects to compute size in S3-compatible APIs.
  // This endpoint hides object keys and only returns totals.
  while (true) {
    const res = await opts.s3.send(new ListObjectsV2Command({
      Bucket: opts.bucket,
      Prefix: opts.prefix,
      MaxKeys: 1000,
      ...(token ? { ContinuationToken: token } : {})
    }))

    const items = Array.isArray(res?.Contents) ? res.Contents : []
    for (const it of items) {
      objects += 1
      bytes += Number(it?.Size || 0)
      scanned += 1
      if (scanned >= opts.maxKeysTotal) {
        truncated = true
        break
      }
    }

    if (truncated) break

    if (!res?.IsTruncated) break
    token = String(res?.NextContinuationToken || '')
    if (!token) break
  }

  const out: PrefixStats = { prefix: opts.prefix, objects, bytes, truncated, scanned }
  return out
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `storage-stats:${user.id}`, 10, 60_000)

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }

  const q = getQuery(event) as any
  const rawRequestedPrefix = normalizeStoragePath(String(q?.prefix || ''))
  const requestedPrefix = rawRequestedPrefix
    ? (rawRequestedPrefix.endsWith('/') ? rawRequestedPrefix : `${rawRequestedPrefix}/`)
    : ''
  if (requestedPrefix && !isValidStoragePath(requestedPrefix, { allowTrailingSlash: true })) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid prefix format' })
  }
  const maxKeys = clamp(toInt(q?.maxKeys, 50_000), 1_000, 100_000)

  const prefixes = requestedPrefix
    ? [requestedPrefix]
    : ['imagens/', 'uploads/', 'projects/', 'logo/']

  const s3 = getS3Client()

  const results: PrefixStats[] = []
  for (const prefix of prefixes) {
    results.push(await scanPrefix({ s3, bucket, prefix, maxKeysTotal: maxKeys }))
  }

  const totalObjects = results.reduce((sum, r) => sum + r.objects, 0)
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0)
  const warnings = results
    .filter((r) => r.truncated)
    .map((r) => `Prefix "${r.prefix}" foi truncado em ${r.scanned} objetos (use ?maxKeys=100000 ou ?prefix=... para focar).`)

  return {
    ok: true,
    bucket,
    endpoint: String(config.wasabiEndpoint || ''),
    generatedAt: new Date().toISOString(),
    maxKeys,
    prefixes: results.map((r) => ({
      prefix: r.prefix,
      objects: r.objects,
      bytes: r.bytes,
      size: formatBytes(r.bytes),
      truncated: r.truncated
    })),
    total: {
      objects: totalObjects,
      bytes: totalBytes,
      size: formatBytes(totalBytes)
    },
    warnings
  }
})
