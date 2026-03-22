import { requireBuilderTenant } from '../../utils/builder-auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { getCachedS3Objects } from '../../utils/s3-object-cache'
import { normalizeSearchTerm } from '../../utils/product-image-matching'

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

  const objects = await getCachedS3Objects({
    s3,
    bucket,
    prefixes: ['imagens/', 'uploads/'],
    ttlMs: 90_000,
    maxKeysPerPrefix: 5000,
    excludeKeyPrefixes: ['imagens/bg-removed-', 'uploads/bg-removed-'],
  })

  // Basic normalize: remove accents, lowercase, clean separators
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/[^a-z0-9\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const normalizedTerm = normalize(term)
  const searchTokens = normalizedTerm.split(/\s+/).filter(t => t.length > 1)

  // Advanced normalization (handles brand aliases, weight units, variants)
  const advancedTerm = normalizeSearchTerm(term)
  const advancedTokens = advancedTerm.split(/\s+/).filter(t => t.length > 0)

  if (searchTokens.length === 0 && advancedTokens.length === 0) {
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

  const scored = objects
    .filter(obj => /\.(png|jpe?g|webp|gif|avif)$/i.test(obj.key))
    .map(obj => {
      const displayName = extractName(obj.key)
      const normalizedName = normalize(displayName)
      const advancedName = normalizeSearchTerm(displayName)

      let score = 0
      let matchedTokens = 0

      // --- Basic token matching ---
      for (const token of searchTokens) {
        if (normalizedName.includes(token)) {
          score += 2
          matchedTokens++
        }
      }

      if (matchedTokens === 0) {
        // Try advanced tokens as fallback
        let advMatched = 0
        for (const token of advancedTokens) {
          if (advancedName.includes(token)) advMatched++
        }
        if (advMatched === 0) return { key: obj.key, displayName, score: 0 }
        score += advMatched * 1.5
        matchedTokens = advMatched
      }

      // Percentage of tokens matched
      if (searchTokens.length > 0) {
        score += (matchedTokens / searchTokens.length) * 3
      }

      // Advanced token matching (brand aliases, weight normalization)
      let advMatchCount = 0
      for (const token of advancedTokens) {
        if (advancedName.includes(token)) advMatchCount++
      }
      if (advancedTokens.length > 0) {
        score += (advMatchCount / advancedTokens.length) * 4
      }

      // Full phrase match
      if (normalizedName.includes(normalizedTerm)) score += 6
      if (normalizedName.startsWith(normalizedTerm)) score += 4

      // Exact match
      if (normalizedName === normalizedTerm) score += 10

      // All search tokens matched
      if (matchedTokens === searchTokens.length && searchTokens.length > 0) score += 3

      // Token count similarity (prefer names with similar word count)
      const nameTokens = normalizedName.split(/\s+/).filter(t => t.length > 1)
      if (nameTokens.length > 0 && searchTokens.length > 0) {
        const ratio = Math.min(nameTokens.length, searchTokens.length) / Math.max(nameTokens.length, searchTokens.length)
        score += ratio * 2
      }

      return { key: obj.key, displayName, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  const candidates = scored.map(item => ({
    key: item.key,
    url: `/api/storage/p?key=${encodeURIComponent(item.key)}`,
    name: item.displayName,
  }))

  return { candidates, total: candidates.length }
})
