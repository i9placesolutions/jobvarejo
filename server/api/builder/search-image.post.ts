import { requireBuilderTenant } from '../../utils/builder-auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { getUserAssetNamesMap } from '../../utils/product-image-asset-names'
import {
  buildExpandedNormalizedCandidates,
  findTopS3Matches,
  normalizeSearchTerm
} from '../../utils/product-image-matching'

/**
 * Busca imagens no Wasabi por nome de produto.
 * Usa normalizeSearchTerm para matching avancado (aliases, pesos, variantes).
 */
export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-search-image:${tenant.id}`, 30, 60_000)

  const config = useRuntimeConfig()
  const bucket = config.wasabiBucket
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'Wasabi bucket not configured' })
  }

  const body = await readBody<{ term: string }>(event)
  const term = String(body?.term || '').trim()

  if (!term || term.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Digite o nome do produto' })
  }

  const s3 = getS3Client()
  const assetNamesByKey = await getUserAssetNamesMap(String(tenant.id || ''))
  const isImageKey = (key: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(String(key || '').split('?')[0] || '')
  const normalizedTerm = normalizeSearchTerm(term)
  if (!normalizedTerm) {
    return { candidates: [], total: 0 }
  }

  // Extract display name from S3 key
  const extractName = (key: string): string => {
    const fileName = key.split('/').pop() || ''
    try {
      return decodeURIComponent(fileName)
        .replace(/^\d+-/, '')
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    } catch {
      return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
    }
  }

  const normalizedCandidates = buildExpandedNormalizedCandidates({
    rawInputs: [term],
    enforceWeight: false,
    maxCandidates: 12
  })

  const ranked = await findTopS3Matches({
    s3,
    bucketName: String(bucket),
    prefixes: ['uploads/', 'imagens/'],
    normalizedCandidates,
    strictOnly: false,
    keyAliases: assetNamesByKey,
    cacheNamespace: String(tenant.id || ''),
    maxKeysPerPrefix: 12_000,
    limit: 12
  })

  const candidates = ranked
    .filter((item) => isImageKey(item.key))
    .map(item => ({
      key: item.key,
      url: `/api/storage/p?key=${encodeURIComponent(item.key)}`,
      name: item.alias || assetNamesByKey.get(item.key) || extractName(item.key),
      score: item.score,
      reason: item.reason,
      kind: item.kind,
    }))

  return { candidates, total: candidates.length }
})
