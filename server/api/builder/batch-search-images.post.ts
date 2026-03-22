import { requireBuilderTenant } from '../../utils/builder-auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { getCachedS3Objects } from '../../utils/s3-object-cache'
import { normalizeSearchTerm } from '../../utils/product-image-matching'

/**
 * Busca em batch: recebe array de nomes de produtos,
 * retorna a melhor imagem do Wasabi para cada um.
 *
 * Body: { terms: string[] }
 * Response: { results: Record<string, { key: string; url: string; name: string } | null> }
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

  // Get cached S3 objects
  const objects = await getCachedS3Objects({
    s3,
    bucket,
    prefixes: ['imagens/', 'uploads/'],
    ttlMs: 90_000,
    maxKeysPerPrefix: 5000,
    excludeKeyPrefixes: ['imagens/bg-removed-', 'uploads/bg-removed-'],
  })

  // Pre-filter to only image files
  const imageObjects = objects.filter(obj => /\.(png|jpe?g|webp|gif|avif)$/i.test(obj.key))

  // Normalize helper: remove accents, lowercase, clean separators
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/[^a-z0-9\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

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

  // Pre-compute normalized names and search terms for all S3 objects
  const indexedObjects = imageObjects.map(obj => {
    const displayName = extractName(obj.key)
    const normalizedName = normalize(displayName)
    const searchTerm = normalizeSearchTerm(displayName)
    const tokens = normalizedName.split(/\s+/).filter(t => t.length > 1)
    return { key: obj.key, displayName, normalizedName, searchTerm, tokens }
  })

  // Process each term
  const results: Record<string, { key: string; url: string; name: string } | null> = {}

  for (const rawTerm of terms) {
    const term = String(rawTerm || '').trim()
    if (!term || term.length < 2) {
      results[term] = null
      continue
    }

    const normalizedTerm = normalize(term)
    const searchTermNormalized = normalizeSearchTerm(term)
    const searchTokens = normalizedTerm.split(/\s+/).filter(t => t.length > 1)
    const advancedTokens = searchTermNormalized.split(/\s+/).filter(t => t.length > 0)

    if (searchTokens.length === 0) {
      results[term] = null
      continue
    }

    let bestMatch: { key: string; displayName: string; score: number } | null = null

    for (const obj of indexedObjects) {
      let score = 0
      let matchedTokens = 0

      // --- Stage 1: Basic token matching ---
      for (const token of searchTokens) {
        if (obj.normalizedName.includes(token)) {
          score += 2
          matchedTokens++
        }
      }

      // No basic match at all — skip
      if (matchedTokens === 0) continue

      // Percentage of search tokens matched
      score += (matchedTokens / searchTokens.length) * 3

      // --- Stage 2: Advanced normalized matching (uses normalizeSearchTerm) ---
      let advancedMatched = 0
      for (const token of advancedTokens) {
        if (obj.searchTerm.includes(token)) {
          advancedMatched++
        }
      }
      if (advancedTokens.length > 0) {
        score += (advancedMatched / advancedTokens.length) * 4
      }

      // --- Stage 3: Full phrase match bonuses ---
      if (obj.normalizedName.includes(normalizedTerm)) score += 6
      if (obj.normalizedName.startsWith(normalizedTerm)) score += 4

      // --- Stage 4: Exact name match (highest bonus) ---
      if (obj.normalizedName === normalizedTerm) score += 10

      // --- Stage 5: Token count similarity bonus ---
      // Prefer images whose name length is similar to the search term
      // (avoids matching "leite" to "leite condensado moca 395g")
      const nameTkLen = obj.tokens.length
      const searchTkLen = searchTokens.length
      if (nameTkLen > 0 && searchTkLen > 0) {
        const ratio = Math.min(nameTkLen, searchTkLen) / Math.max(nameTkLen, searchTkLen)
        score += ratio * 2
      }

      // --- Stage 6: All search tokens matched bonus ---
      if (matchedTokens === searchTokens.length) {
        score += 3
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key: obj.key, displayName: obj.displayName, score }
      }
    }

    // Minimum score threshold to avoid garbage matches
    if (bestMatch && bestMatch.score >= 4) {
      results[term] = {
        key: bestMatch.key,
        url: `/api/storage/p?key=${encodeURIComponent(bestMatch.key)}`,
        name: bestMatch.displayName,
      }
    } else {
      results[term] = null
    }
  }

  return { results }
})
