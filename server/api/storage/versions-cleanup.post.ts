import {
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
} from '@aws-sdk/client-s3'
import { getS3Client } from '~/server/utils/s3'
import { requireAdminUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'

/**
 * Admin endpoint to analyze and clean up old (noncurrent) S3 object versions.
 *
 * Wasabi bucket-level versioning keeps every past version of every object
 * indefinitely. This endpoint lists noncurrent versions and optionally
 * deletes them, freeing storage.
 *
 * Body params:
 *   prefix?:          S3 key prefix to scope the scan (default: scan all main prefixes)
 *   dryRun?:          boolean (default true) — when true, only analyze without deleting
 *   keepLatestN?:     number (default 2) — keep at least N noncurrent versions per key
 *   olderThanDays?:   number (default 7) — only target versions older than N days
 *   maxKeysToScan?:   number (default 50000) — max versions to scan
 *   maxDeleteBatch?:  number (default 1000) — max objects to delete in one invocation
 */

type CleanupBody = {
  prefix?: string
  dryRun?: boolean
  keepLatestN?: number
  olderThanDays?: number
  maxKeysToScan?: number
  maxDeleteBatch?: number
}

type VersionInfo = {
  key: string
  versionId: string
  lastModified: number
  size: number
  isLatest: boolean
}

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

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

const requireAdminOrCronKey = async (event: any) => {
  // Allow service-to-service calls via CRON_SECRET header (for n8n, cron jobs, etc.)
  const cronSecret = String(
    process.env.CRON_SECRET || process.env.NUXT_CRON_SECRET || ''
  ).trim()
  const headerKey = String(
    getHeader(event, 'x-cron-secret') || ''
  ).trim()

  if (cronSecret && headerKey && cronSecret === headerKey) {
    return { id: 'cron', email: 'cron@system' }
  }

  // Fallback to normal admin auth
  const { user } = await requireAdminUser(event)
  return user
}

export default defineEventHandler(async (event) => {
  const user = await requireAdminOrCronKey(event)
  await enforceRateLimit(event, `storage-versions-cleanup:${user.id}`, 5, 60_000)

  const body = await readBody<CleanupBody>(event)
  const dryRun = body?.dryRun !== false // default true (safe)
  const keepLatestN = clamp(Number(body?.keepLatestN) || 2, 0, 50)
  const olderThanDays = clamp(Number(body?.olderThanDays) || 7, 0, 365)
  const maxKeysToScan = clamp(Number(body?.maxKeysToScan) || 50_000, 100, 200_000)
  const maxDeleteBatch = clamp(Number(body?.maxDeleteBatch) || 1000, 1, 1000)

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'WASABI_BUCKET not configured' })
  }

  const rawPrefix = String(body?.prefix || '').trim()
  const prefixes = rawPrefix
    ? [rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`]
    : ['projects/', 'imagens/', 'uploads/', 'logo/']

  const s3 = getS3Client()
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

  // Phase 1: Scan all versions across the requested prefixes
  const allVersions: VersionInfo[] = []
  let totalScanned = 0
  let scanTruncated = false

  for (const prefix of prefixes) {
    if (totalScanned >= maxKeysToScan) {
      scanTruncated = true
      break
    }

    let keyMarker: string | undefined
    let versionIdMarker: string | undefined

    while (totalScanned < maxKeysToScan) {
      const res = await s3.send(
        new ListObjectVersionsCommand({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ...(keyMarker ? { KeyMarker: keyMarker } : {}),
          ...(versionIdMarker ? { VersionIdMarker: versionIdMarker } : {}),
        })
      )

      const versions = res.Versions || []
      for (const v of versions) {
        if (totalScanned >= maxKeysToScan) {
          scanTruncated = true
          break
        }
        totalScanned++

        const key = String(v.Key || '')
        const versionId = String(v.VersionId || '')
        if (!key || !versionId) continue

        allVersions.push({
          key,
          versionId,
          lastModified: new Date(v.LastModified || 0).getTime(),
          size: Number(v.Size || 0),
          isLatest: !!v.IsLatest,
        })
      }

      // Also count delete markers
      const deleteMarkers = res.DeleteMarkers || []
      for (const dm of deleteMarkers) {
        if (totalScanned >= maxKeysToScan) break
        totalScanned++
      }

      if (!res.IsTruncated) break
      keyMarker = res.NextKeyMarker || undefined
      versionIdMarker = res.NextVersionIdMarker || undefined
      if (!keyMarker) break
    }
  }

  // Phase 2: Group by key and identify candidates for deletion
  const byKey = new Map<string, VersionInfo[]>()
  for (const v of allVersions) {
    const list = byKey.get(v.key) || []
    list.push(v)
    byKey.set(v.key, list)
  }

  const deleteCandidates: Array<{ key: string; versionId: string; size: number; lastModified: number }> = []
  let totalCurrentVersions = 0
  let totalNoncurrentVersions = 0
  let totalCurrentBytes = 0
  let totalNoncurrentBytes = 0
  const perPrefixStats = new Map<string, { current: number; noncurrent: number; currentBytes: number; noncurrentBytes: number; deletable: number; deletableBytes: number }>()

  for (const [key, versions] of byKey) {
    // Sort: newest first
    versions.sort((a, b) => b.lastModified - a.lastModified)

    const prefix = prefixes.find(p => key.startsWith(p)) || 'other/'
    if (!perPrefixStats.has(prefix)) {
      perPrefixStats.set(prefix, { current: 0, noncurrent: 0, currentBytes: 0, noncurrentBytes: 0, deletable: 0, deletableBytes: 0 })
    }
    const prefixStat = perPrefixStats.get(prefix)!

    // The latest version is always kept
    const latest = versions[0]
    if (latest) {
      totalCurrentVersions++
      totalCurrentBytes += latest.size
      prefixStat.current++
      prefixStat.currentBytes += latest.size
    }

    // Noncurrent versions: everything except the latest
    const noncurrent = versions.slice(1)
    for (const v of noncurrent) {
      totalNoncurrentVersions++
      totalNoncurrentBytes += v.size
      prefixStat.noncurrent++
      prefixStat.noncurrentBytes += v.size
    }

    // Determine which noncurrent versions to delete:
    // Keep the N most recent noncurrent versions, delete the rest if older than cutoff
    const toDelete = noncurrent.slice(keepLatestN)
    for (const v of toDelete) {
      if (v.lastModified < cutoffMs) {
        deleteCandidates.push({
          key: v.key,
          versionId: v.versionId,
          size: v.size,
          lastModified: v.lastModified,
        })
        prefixStat.deletable++
        prefixStat.deletableBytes += v.size
      }
    }
  }

  const totalDeletableBytes = deleteCandidates.reduce((s, c) => s + c.size, 0)

  // Phase 3: Delete (if not dry run)
  let deletedCount = 0
  let deletedBytes = 0
  let deleteErrors = 0

  if (!dryRun && deleteCandidates.length > 0) {
    // Sort oldest first for deletion priority
    deleteCandidates.sort((a, b) => a.lastModified - b.lastModified)

    const batch = deleteCandidates.slice(0, maxDeleteBatch)
    // S3 DeleteObjects supports up to 1000 per request
    for (let i = 0; i < batch.length; i += 1000) {
      const chunk = batch.slice(i, i + 1000)
      try {
        const res = await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: chunk.map(c => ({ Key: c.key, VersionId: c.versionId })),
              Quiet: true,
            },
          })
        )
        const errors = res.Errors?.length || 0
        deleteErrors += errors
        deletedCount += chunk.length - errors
        deletedBytes += chunk
          .slice(0, chunk.length - errors)
          .reduce((s, c) => s + c.size, 0)
      } catch (err: any) {
        deleteErrors += chunk.length
        console.error('[versions-cleanup] DeleteObjects error:', err?.message || err)
      }
    }

    console.warn('[versions-cleanup] Cleanup completed', {
      userId: user.id,
      dryRun,
      deletedCount,
      deletedBytes: formatBytes(deletedBytes),
      deleteErrors,
      prefixes,
    })
  }

  const prefixBreakdown = Array.from(perPrefixStats.entries()).map(([prefix, stats]) => ({
    prefix,
    currentVersions: stats.current,
    currentSize: formatBytes(stats.currentBytes),
    currentBytes: stats.currentBytes,
    noncurrentVersions: stats.noncurrent,
    noncurrentSize: formatBytes(stats.noncurrentBytes),
    noncurrentBytes: stats.noncurrentBytes,
    deletableVersions: stats.deletable,
    deletableSize: formatBytes(stats.deletableBytes),
    deletableBytes: stats.deletableBytes,
  }))

  return {
    ok: true,
    dryRun,
    params: {
      prefixes,
      keepLatestN,
      olderThanDays,
      maxKeysToScan,
      maxDeleteBatch,
      cutoffDate: new Date(cutoffMs).toISOString(),
    },
    scan: {
      totalVersionsScanned: totalScanned,
      truncated: scanTruncated,
      uniqueKeys: byKey.size,
    },
    analysis: {
      currentVersions: totalCurrentVersions,
      currentSize: formatBytes(totalCurrentBytes),
      currentBytes: totalCurrentBytes,
      noncurrentVersions: totalNoncurrentVersions,
      noncurrentSize: formatBytes(totalNoncurrentBytes),
      noncurrentBytes: totalNoncurrentBytes,
      deletableVersions: deleteCandidates.length,
      deletableSize: formatBytes(totalDeletableBytes),
      deletableBytes: totalDeletableBytes,
    },
    prefixBreakdown,
    ...(dryRun
      ? {
          action: 'DRY RUN - nenhuma versao foi deletada. Envie dryRun: false para executar.',
        }
      : {
          deleted: {
            count: deletedCount,
            size: formatBytes(deletedBytes),
            bytes: deletedBytes,
            errors: deleteErrors,
          },
        }),
    generatedAt: new Date().toISOString(),
  }
})
