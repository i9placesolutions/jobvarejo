import { requireBuilderTenant } from '../../utils/builder-auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { getUserAssetNamesMap, findExactAssetNameKey } from '../../utils/product-image-asset-names'
import {
  buildExpandedNormalizedCandidates,
  findTopS3Matches,
  normalizeSearchTerm,
  type RankedS3MatchCandidate
} from '../../utils/product-image-matching'

/**
 * Busca em batch: recebe array de nomes de produtos,
 * retorna a melhor imagem do Wasabi para cada um.
 *
 * Body: { terms: string[] }
 * Response: { results: Record<string, { image: string; image_wasabi_key: string; key: string; url: string; name: string } | null> }
 */
export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-batch-search:${tenant.id}`, 10, 60_000)

  const config = useRuntimeConfig()
  const bucket = config.wasabiBucket
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'Wasabi bucket not configured' })
  }

  const body = await readBody<{ terms: string[] }>(event)
  const terms = body?.terms
  if (!terms || !Array.isArray(terms) || terms.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'terms array is required' })
  }

  if (terms.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Maximum 100 terms per batch' })
  }

  const s3 = getS3Client()
  const assetNamesByKey = await getUserAssetNamesMap(String(tenant.id || ''))
  const isImageKey = (key: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(String(key || '').split('?')[0] || '')

  // Extract display name from S3 key
  const extractName = (key: string): string => {
    const fileName = key.split('/').pop() || ''
    try {
      return decodeURIComponent(fileName)
        .replace(/^\d+-/, '')        // remove timestamp prefix
        .replace(/\.[^.]+$/, '')     // remove extension
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    } catch {
      return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
    }
  }

  const buildResult = (key: string, score?: number, reason?: string, kind?: string) => {
    const url = `/api/storage/p?key=${encodeURIComponent(key)}`
    return {
      image: url,
      image_wasabi_key: key,
      key,
      url,
      name: assetNamesByKey.get(key) || extractName(key),
      score,
      reason,
      kind
    }
  }

  const isAutoFillSafe = (candidate: RankedS3MatchCandidate, runnerUp?: RankedS3MatchCandidate): boolean => {
    if (candidate.kind !== 'exact' && candidate.kind !== 'strict') return false
    if (candidate.kind === 'exact') return candidate.score >= 390
    if (candidate.score < 328) return false

    const nextScore = Number(runnerUp?.score || 0)
    if (nextScore > 0 && candidate.score - nextScore < 18) return false
    return true
  }

  // Process each term
  const results: Record<string, ReturnType<typeof buildResult> | null> = {}

  for (const rawTerm of terms) {
    const term = String(rawTerm || '').trim()
    if (!term || term.length < 2) {
      results[term] = null
      continue
    }

    const normalizedTerm = normalizeSearchTerm(term)
    if (!normalizedTerm) {
      results[term] = null
      continue
    }

    const normalizedCandidates = buildExpandedNormalizedCandidates({
      rawInputs: [term],
      enforceWeight: false,
      maxCandidates: 10
    })

    const exactAssetNameKey = findExactAssetNameKey(normalizedCandidates, assetNamesByKey)
    if (exactAssetNameKey && isImageKey(exactAssetNameKey)) {
      results[term] = buildResult(exactAssetNameKey, 999, 'Match exato por nome renomeado', 'exact')
      continue
    }

    try {
      const ranked = await findTopS3Matches({
        s3,
        bucketName: String(bucket),
        prefixes: ['uploads/', 'imagens/'],
        normalizedCandidates,
        strictOnly: false,
        keyAliases: assetNamesByKey,
        cacheNamespace: String(tenant.id || ''),
        maxKeysPerPrefix: 12_000,
        limit: 3
      })

      const imageRanked = ranked.filter((item) => isImageKey(item.key))
      const best = imageRanked[0]
      if (best && isAutoFillSafe(best, imageRanked[1])) {
        results[term] = buildResult(best.key, best.score, best.reason, best.kind)
      } else {
        results[term] = null
      }
    } catch (err) {
      console.warn('Builder batch image search failed:', err)
      results[term] = null
    }
  }

  return { results }
})
