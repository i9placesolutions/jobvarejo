import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'

/**
 * Diagnostic endpoint — tests Postgres + Wasabi connectivity from the server.
 * Requires authentication (any user, not just admin) so that it can be used
 * to debug production save failures from the logged-in session.
 * Rate-limited to 10 requests per minute per user.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `debug-connectivity:${user.id}`, 10, 60_000)

  const config = useRuntimeConfig()
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    postgres: { ok: false, latencyMs: null as number | null, error: null as string | null },
    wasabi: { ok: false, latencyMs: null as number | null, error: null as string | null },
    env: {
      postgresUrlPresent: !!String((config as any).postgresDatabaseUrl || '').trim(),
      postgresUrlLength: String((config as any).postgresDatabaseUrl || '').trim().length,
      wasabiEndpoint: String((config as any).wasabiEndpoint || ''),
      wasabiBucket: String((config as any).wasabiBucket || ''),
      wasabiAccessKeyPresent: !!String((config as any).wasabiAccessKey || '').trim(),
      wasabiSecretKeyPresent: !!String((config as any).wasabiSecretKey || '').trim(),
    }
  }

  // --- Test Postgres ---
  try {
    const { getPostgresPool } = await import('../../utils/postgres')
    const pool = getPostgresPool()
    const pgStart = Date.now()
    await pool.query('SELECT 1 as ping')
    results.postgres.latencyMs = Date.now() - pgStart
    results.postgres.ok = true
  } catch (err: any) {
    results.postgres.error = String(err?.message || err?.code || err || 'unknown')
  }

  // --- Test Wasabi ---
  try {
    const endpoint = String((config as any).wasabiEndpoint || '').trim()
    const region = String((config as any).wasabiRegion || 'us-east-1').trim() || 'us-east-1'
    const bucket = String((config as any).wasabiBucket || '').trim()
    const accessKey = String((config as any).wasabiAccessKey || '').trim()
    const secretKey = String((config as any).wasabiSecretKey || '').trim()

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      results.wasabi.error = 'Missing Wasabi config (endpoint/bucket/accessKey/secretKey)'
    } else {
      const s3 = new S3Client({
        endpoint: `https://${endpoint}`,
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle: true,
        requestHandler: { connectionTimeout: 8000, socketTimeout: 8000 } as any
      })
      const wasabiStart = Date.now()
      await s3.send(new HeadBucketCommand({ Bucket: bucket }))
      results.wasabi.latencyMs = Date.now() - wasabiStart
      results.wasabi.ok = true
    }
  } catch (err: any) {
    results.wasabi.error = String(err?.message || err?.code || err || 'unknown')
    // HeadBucket 403 = bucket exists but no ListBucket permission — still means we can connect
    if (String(err?.message || '').includes('403') || err?.$metadata?.httpStatusCode === 403) {
      results.wasabi.ok = true
      results.wasabi.error = null
    }
  }

  return results
})
