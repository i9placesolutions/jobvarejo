import { ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '../utils/s3'

export default defineEventHandler(async (event) => {const start = Date.now()
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  }

  try {
    const config = useRuntimeConfig()const endpoint = config.wasabiEndpoint || process.env.WASABI_ENDPOINT || 'N/A'
    const bucket = config.wasabiBucket || process.env.WASABI_BUCKET || 'N/A'
    const region = config.wasabiRegion || process.env.WASABI_REGION || 'N/A'
    const hasAccessKey = !!(config.wasabiAccessKey || process.env.WASABI_ACCESS_KEY)
    const hasSecretKey = !!(config.wasabiSecretKey || process.env.WASABI_SECRET_KEY)

    results.config = {
      endpoint,
      bucket,
      region,
      hasAccessKey,
      hasSecretKey
    }

    const s3Client = getS3Client()
    
    // Teste 1: Listar objetos (verifica conectividade e credenciais)
    const listStart = Date.now()
    try {
      const listResult = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1
      }))
      results.checks.listObjects = {
        ok: true,
        duration: Date.now() - listStart,
        keyCount: listResult.KeyCount || 0
      }
    } catch (listErr: any) {
      results.checks.listObjects = {
        ok: false,
        duration: Date.now() - listStart,
        error: listErr?.message || String(listErr),
        code: listErr?.$metadata?.httpStatusCode || listErr?.Code
      }
    }

    // Teste 2: Upload pequeno
    const uploadStart = Date.now()
    const testKey = 'projects/_diagnostic_/test-' + Date.now() + '.json'
    const testBody = JSON.stringify({ test: true, timestamp: Date.now() })
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: testBody,
        ContentType: 'application/json'
      }))
      results.checks.upload = {
        ok: true,
        duration: Date.now() - uploadStart,
        key: testKey
      }
    } catch (uploadErr: any) {
      results.checks.upload = {
        ok: false,
        duration: Date.now() - uploadStart,
        error: uploadErr?.message || String(uploadErr),
        code: uploadErr?.$metadata?.httpStatusCode || uploadErr?.Code
      }
    }

    results.totalDuration = Date.now() - start
    results.ok = results.checks.listObjects?.ok && results.checks.upload?.ok

  } catch (err: any) {
    results.fatalError = err?.message || String(err)
    results.ok = false
  }

  return results
})