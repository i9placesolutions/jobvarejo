import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { extractStorageKeyFromRef } from '~/utils/storageRef'
import { toWasabiProxyUrl } from '~/utils/storageProxy'
import { getS3Client } from './s3'
import {
  isStorageKeyAllowedForUser,
  normalizeStoragePath
} from './storage-scope'

const SIGNED_GET_EXPIRES_IN_SECONDS = 3600
const SIGNED_GET_CACHE_TTL_MS = 55 * 60 * 1000
const signedReadUrlCache = new Map<string, { expiresAt: number; url: string }>()

const getStorageResolveOptions = () => {
  const config = useRuntimeConfig()
  return {
    bucket: String(config.wasabiBucket || '').trim(),
    endpoint: String(config.wasabiEndpoint || '').trim()
  }
}

const getSignedReadCacheKey = (userId: string, key: string): string => `${userId}\u0000${key}`

const getCachedSignedReadUrl = async (key: string, userId: string): Promise<string> => {
  const cacheKey = getSignedReadCacheKey(userId, key)
  const now = Date.now()
  const cached = signedReadUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.url
  }

  const config = useRuntimeConfig()
  const bucket = String(config.wasabiBucket || '').trim()
  if (!bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Wasabi Storage configuration missing (WASABI_BUCKET)'
    })
  }

  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }),
    { expiresIn: SIGNED_GET_EXPIRES_IN_SECONDS }
  )

  signedReadUrlCache.set(cacheKey, {
    expiresAt: now + SIGNED_GET_CACHE_TTL_MS,
    url
  })

  if (signedReadUrlCache.size > 1024) {
    const oldestKey = signedReadUrlCache.keys().next().value
    if (oldestKey) signedReadUrlCache.delete(oldestKey)
  }

  return url
}

export const normalizeStoredStorageRef = (value: unknown): string | null => {
  if (value == null) return null
  const raw = String(value || '').trim()
  if (!raw) return null

  const { bucket, endpoint } = getStorageResolveOptions()
  const extractedKey = extractStorageKeyFromRef(raw, { bucket, endpoint })
  if (!extractedKey) return raw

  const normalizedKey = normalizeStoragePath(extractedKey)
  return normalizedKey || raw
}

const normalizePageMetaStorageRefs = (pageMeta: any): any => {
  if (!pageMeta || typeof pageMeta !== 'object') return pageMeta
  return {
    ...pageMeta,
    canvasDataPath: normalizeStoredStorageRef(pageMeta.canvasDataPath),
    thumbnailUrl: normalizeStoredStorageRef(pageMeta.thumbnailUrl)
  }
}

export const normalizeProjectCanvasDataStorageRefs = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((pageMeta) => normalizePageMetaStorageRefs(pageMeta))
  }

  if (value && typeof value === 'object' && Array.isArray((value as any).pages)) {
    return {
      ...(value as Record<string, any>),
      pages: (value as any).pages.map((pageMeta: any) => normalizePageMetaStorageRefs(pageMeta))
    }
  }

  return value
}

const stripInlineCanvasDataFromPageMeta = (pageMeta: any): any => {
  if (!pageMeta || typeof pageMeta !== 'object') return pageMeta
  const next = { ...(pageMeta as Record<string, any>) }
  delete next.canvasData
  return next
}

export const stripInlineCanvasDataFromProjectCanvasData = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((pageMeta) => stripInlineCanvasDataFromPageMeta(pageMeta))
  }

  if (value && typeof value === 'object' && Array.isArray((value as any).pages)) {
    return {
      ...(value as Record<string, any>),
      pages: (value as any).pages.map((pageMeta: any) => stripInlineCanvasDataFromPageMeta(pageMeta))
    }
  }

  return value
}

export const resolveStorageReadUrl = async (value: unknown, userId: string): Promise<string | null> => {
  if (value == null) return null
  const raw = String(value || '').trim()
  if (!raw) return null

  const { bucket, endpoint } = getStorageResolveOptions()
  const legacyFallbackUrl = toWasabiProxyUrl(raw, { bucket }) || raw
  const extractedKey = extractStorageKeyFromRef(raw, { bucket, endpoint })
  if (!extractedKey) return legacyFallbackUrl

  const key = normalizeStoragePath(extractedKey)
  if (!key) return legacyFallbackUrl

  if (!isStorageKeyAllowedForUser(key, userId)) {
    return null
  }

  return await getCachedSignedReadUrl(key, userId)
}

const resolvePageMetaStorageUrls = async (pageMeta: any, userId: string): Promise<any> => {
  if (!pageMeta || typeof pageMeta !== 'object') return pageMeta
  const thumbnailUrl = await resolveStorageReadUrl(pageMeta.thumbnailUrl, userId)
  return {
    ...pageMeta,
    thumbnailUrl
  }
}

export const resolveProjectCanvasDataReadUrls = async (value: unknown, userId: string): Promise<unknown> => {
  if (Array.isArray(value)) {
    return await Promise.all(value.map((pageMeta) => resolvePageMetaStorageUrls(pageMeta, userId)))
  }

  if (value && typeof value === 'object' && Array.isArray((value as any).pages)) {
    return {
      ...(value as Record<string, any>),
      pages: await Promise.all(
        (value as any).pages.map((pageMeta: any) => resolvePageMetaStorageUrls(pageMeta, userId))
      )
    }
  }

  return value
}
