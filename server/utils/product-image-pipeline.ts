import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { downloadImage, processImage, processImageStrict } from './image-processor'
import { saveProductImageCache } from './product-image-cache'
import { getPublicUrl } from './s3'
import {
  buildExternalSourceDerivedS3Key,
  buildSourceDerivedS3Key,
  isProcessedSmartKey
} from './product-image-matching'
import { assertSafeExternalHttpUrl } from './url-safety'

export type BgPolicy = 'auto' | 'never' | 'always'

export type ProcessProductImageResponse = {
  source: string
  url?: string | null
  processing?: string
  found?: boolean
  reason?: string
  aiConfidence?: number
  aiBestIndex?: number
}

const proxyUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`

export async function s3KeyExists(s3: any, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

const optimizeImageWithoutBg = async (rawBuffer: Buffer): Promise<Buffer> => {
  const sharp = (await import('sharp')).default
  return await sharp(rawBuffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
}

type EnsureBgRemovedOpts = {
  s3: any
  bucketName: string
  sourceKey: string
  deterministicKey: string
  normalizedTerm: string
  term: string
  brand?: string
  flavor?: string
  weight?: string
}

const inFlightBgRemoval = new Map<string, Promise<{ key: string; processed: boolean } | null>>()

export async function ensureBgRemoved(opts: EnsureBgRemovedOpts): Promise<{ key: string; processed: boolean } | null> {
  const { s3, bucketName, sourceKey, deterministicKey, normalizedTerm, term, brand, flavor, weight } = opts

  if (sourceKey === deterministicKey) {
    return { key: sourceKey, processed: false }
  }

  if (isProcessedSmartKey(sourceKey)) {
    console.log(`♻️ [ensureBgRemoved] Reusando key processada existente: "${sourceKey}"`)
    await saveProductImageCache({
      searchTerm: normalizedTerm,
      productName: term,
      brand,
      flavor,
      weight,
      imageUrl: getPublicUrl(sourceKey),
      s3Key: sourceKey,
      source: 'internal-processed'
    })
    return { key: sourceKey, processed: false }
  }

  const canonicalProcessedKey = buildSourceDerivedS3Key(sourceKey)
  const targetProcessedKey = canonicalProcessedKey || deterministicKey

  const exists = await s3KeyExists(s3, bucketName, targetProcessedKey)
  if (exists) {
    console.log(`✅ [ensureBgRemoved] Key processado já existe: "${targetProcessedKey}"`)
    return { key: targetProcessedKey, processed: false }
  }

  const lockKey = `${bucketName}:${targetProcessedKey}`
  const ongoing = inFlightBgRemoval.get(lockKey)
  if (ongoing) {
    console.log(`⏳ [ensureBgRemoved] Aguardando processamento em andamento para "${targetProcessedKey}"`)
    return await ongoing
  }

  const job = (async (): Promise<{ key: string; processed: boolean } | null> => {
    try {
      const existsAfterLock = await s3KeyExists(s3, bucketName, targetProcessedKey)
      if (existsAfterLock) {
        console.log(`✅ [ensureBgRemoved] Key criada por outro request: "${targetProcessedKey}"`)
        await saveProductImageCache({
          searchTerm: normalizedTerm,
          productName: term,
          brand,
          flavor,
          weight,
          imageUrl: getPublicUrl(targetProcessedKey),
          s3Key: targetProcessedKey,
          source: 'internal-processed'
        })
        return { key: targetProcessedKey, processed: false }
      }

      let rawBuffer: Buffer
      try {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3')
        const getResponse = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: sourceKey }))
        const stream = getResponse.Body as any
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk))
        }
        rawBuffer = Buffer.concat(chunks)
        console.log(`📥 [ensureBgRemoved] Baixado via S3 SDK: "${sourceKey}" (${rawBuffer.length} bytes)`)
      } catch (s3Err: any) {
        console.warn(`⚠️ [ensureBgRemoved] S3 SDK falhou, tentando URL pública:`, s3Err?.message)
        rawBuffer = await downloadImage(getPublicUrl(sourceKey))
      }

      const processedBuffer = await processImageStrict(rawBuffer)

      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: targetProcessedKey,
        Body: processedBuffer,
        ContentType: 'image/webp',
        ACL: 'public-read'
      }))

      console.log(`📤 [ensureBgRemoved] Imagem processada e salva: "${targetProcessedKey}" (${processedBuffer.length} bytes)`)

      await saveProductImageCache({
        searchTerm: normalizedTerm,
        productName: term,
        brand,
        flavor,
        weight,
        imageUrl: getPublicUrl(targetProcessedKey),
        s3Key: targetProcessedKey,
        source: 'internal-processed'
      })

      return { key: targetProcessedKey, processed: true }
    } catch (err: any) {
      console.error('⚠️ [ensureBgRemoved] Falha ao processar imagem:', err?.message, err?.stack?.split('\n').slice(0, 3).join(' | '))
      return null
    }
  })()

  inFlightBgRemoval.set(lockKey, job)
  try {
    return await job
  } finally {
    if (inFlightBgRemoval.get(lockKey) === job) {
      inFlightBgRemoval.delete(lockKey)
    }
  }
}

const inFlightExternalPipeline = new Map<string, Promise<ProcessProductImageResponse>>()

export const runExternalPipelineOnce = async (opts: {
  s3: any
  bucketName: string
  deterministicKey: string
  normalizedTerm: string
  term: string
  brand?: string
  flavor?: string
  weight?: string
  selectedImageUrl: string
  bgPolicy: BgPolicy
}): Promise<ProcessProductImageResponse> => {
  const safeSelectedImageUrl = assertSafeExternalHttpUrl(opts.selectedImageUrl, { maxLength: 2048 })
  const externalSourceKey = buildExternalSourceDerivedS3Key(safeSelectedImageUrl)
  const targetUploadKey = externalSourceKey || opts.deterministicKey
  const lockKey = `${opts.bucketName}:${targetUploadKey}`
  const ongoing = inFlightExternalPipeline.get(lockKey)
  if (ongoing) {
    console.log(`⏳ [External Pipeline] Aguardando processamento em andamento para "${targetUploadKey}"`)
    return ongoing
  }

  const job = (async (): Promise<ProcessProductImageResponse> => {
    const reusableKeys = [...new Set([targetUploadKey, opts.deterministicKey])].filter(Boolean)
    for (const reusableKey of reusableKeys) {
      const existsNow = await s3KeyExists(opts.s3, opts.bucketName, reusableKey)
      if (!existsNow) continue
      console.log(`✅ [S3 Guard] Reuso de key existente: "${reusableKey}"`)
      await saveProductImageCache({
        searchTerm: opts.normalizedTerm,
        productName: opts.term,
        brand: opts.brand,
        flavor: opts.flavor,
        weight: opts.weight,
        imageUrl: getPublicUrl(reusableKey),
        s3Key: reusableKey,
        source: 'cache-s3'
      })
      return { source: 'cache-s3', url: proxyUrl(reusableKey) }
    }

    const rawBuffer = await downloadImage(safeSelectedImageUrl, { maxBytes: 12 * 1024 * 1024, timeoutMs: 15_000 })
    let processedBuffer: Buffer
    let processingMode = 'optimized-original'

    if (opts.bgPolicy === 'never') {
      processedBuffer = await optimizeImageWithoutBg(rawBuffer)
      processingMode = 'optimized-no-bg-removal'
    } else if (opts.bgPolicy === 'always') {
      try {
        processedBuffer = await processImageStrict(rawBuffer)
        processingMode = 'bg-removed-strict'
      } catch (bgErr: any) {
        console.warn('⚠️ [Serper] processImageStrict falhou no modo always, fallback processImage:', bgErr?.message)
        processedBuffer = await processImage(rawBuffer)
        processingMode = 'bg-removed-fallback-auto'
      }
    } else {
      processedBuffer = await optimizeImageWithoutBg(rawBuffer)
      processingMode = 'auto-preserve'
    }

    await opts.s3.send(new PutObjectCommand({
      Bucket: opts.bucketName,
      Key: targetUploadKey,
      Body: processedBuffer,
      ContentType: 'image/webp',
      ACL: 'public-read'
    }))

    console.log(`📤 [S3] Upload: "${targetUploadKey}" (${processedBuffer.length} bytes) | mode=${processingMode}`)

    await saveProductImageCache({
      searchTerm: opts.normalizedTerm,
      productName: opts.term,
      brand: opts.brand,
      flavor: opts.flavor,
      weight: opts.weight,
      imageUrl: getPublicUrl(targetUploadKey),
      s3Key: targetUploadKey,
      source: `google-cse-${opts.bgPolicy}`
    })

    return {
      source: 'external',
      processing: processingMode,
      url: proxyUrl(targetUploadKey)
    }
  })()

  inFlightExternalPipeline.set(lockKey, job)
  try {
    return await job
  } finally {
    if (inFlightExternalPipeline.get(lockKey) === job) {
      inFlightExternalPipeline.delete(lockKey)
    }
  }
}
