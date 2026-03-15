import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'

/**
 * Testa escrita + leitura + deleção na Wasabi a partir do servidor.
 * Endpoint de diagnóstico para identificar problemas de save.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `debug-wasabi-write:${user.id}`, 5, 60_000)

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()

  const testKey = `_debug/write-test-${user.id}-${Date.now()}.json`
  const testData = JSON.stringify({ test: true, userId: user.id, timestamp: new Date().toISOString(), randomBytes: 'x'.repeat(50_000) })
  const testBuffer = Buffer.from(testData)

  const s3 = getS3Client()
  const results: Record<string, any> = {
    bucket,
    testKey,
    payloadSize: testBuffer.length,
    put: { ok: false, latencyMs: null as number | null, error: null as string | null },
    get: { ok: false, latencyMs: null as number | null, error: null as string | null, sizeMatch: false },
    delete: { ok: false, error: null as string | null },
  }

  // PUT
  try {
    const start = Date.now()
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testBuffer,
      ContentType: 'application/json',
    }))
    results.put.latencyMs = Date.now() - start
    results.put.ok = true
  } catch (err: any) {
    results.put.error = `${err?.name || 'Error'}: ${err?.message || 'unknown'} (httpStatus=${err?.$metadata?.httpStatusCode})`
    return results
  }

  // GET (verify)
  try {
    const start = Date.now()
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }))
    const body = await res.Body?.transformToString()
    results.get.latencyMs = Date.now() - start
    results.get.ok = true
    results.get.sizeMatch = body?.length === testData.length
  } catch (err: any) {
    results.get.error = `${err?.name || 'Error'}: ${err?.message || 'unknown'}`
  }

  // DELETE (cleanup)
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }))
    results.delete.ok = true
  } catch (err: any) {
    results.delete.error = `${err?.name || 'Error'}: ${err?.message || 'unknown'}`
  }

  return results
})
