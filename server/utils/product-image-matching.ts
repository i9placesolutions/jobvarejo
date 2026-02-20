import { createHash } from 'crypto'
import { getCachedS3Objects } from './s3-object-cache'

const UNIT_MAP: Record<string, string> = {
  mililitros: 'ml', mililitro: 'ml', mls: 'ml',
  gramas: 'g', grama: 'g', gram: 'g', gr: 'g', grs: 'g', gs: 'g',
  quilos: 'kg', quilo: 'kg', quilogramas: 'kg', quilograma: 'kg', kgs: 'kg',
  unidades: 'un', unidade: 'un', und: 'un', unds: 'un', uns: 'un',
  litro: 'l', litros: 'l', lt: 'l', lts: 'l', litr: 'l', litrs: 'l',
  pacote: 'pct', pacotes: 'pct', pcts: 'pct',
  caixa: 'cx', caixas: 'cx',
  fardo: 'fd', fardos: 'fd'
}

const STOP_WORDS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'com', 'em', 'e', 'para', 'por', 'no', 'na'])

const normalizeWeightNumber = (value: string): string => {
  const n = Number(String(value || '').replace(',', '.'))
  if (!Number.isFinite(n)) return String(value || '').replace(',', '.')
  const normalized = String(n)
  return normalized.includes('.') ? normalized.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : normalized
}

const normalizeWeightToken = (rawWeight: string): string => {
  const compact = String(rawWeight || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/grs?\b/g, 'g')
    .replace(/lt\b/g, 'l')

  const multipack = compact.match(/^(\d+)x(\d+(?:\.\d+)?)(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/)
  if (multipack) {
    const multiplier = String(Number(multipack[1] || '0'))
    const qty = normalizeWeightNumber(multipack[2] || '0')
    const unitRaw = multipack[3] || ''
    const unit = unitRaw === 'gr' || unitRaw === 'grs'
      ? 'g'
      : unitRaw === 'lt' || unitRaw === 'lts'
        ? 'l'
        : unitRaw === 'kgs'
          ? 'kg'
          : unitRaw === 'mls'
            ? 'ml'
            : unitRaw
    return `${multiplier}x${qty}${unit}`
  }

  const single = compact.match(/^(\d+(?:\.\d+)?)(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/)
  if (single) {
    const qty = normalizeWeightNumber(single[1] || '0')
    const unitRaw = single[2] || ''
    const unit = unitRaw === 'gr' || unitRaw === 'grs'
      ? 'g'
      : unitRaw === 'lt' || unitRaw === 'lts'
        ? 'l'
        : unitRaw === 'kgs'
          ? 'kg'
          : unitRaw === 'mls'
            ? 'ml'
            : unitRaw
    return `${qty}${unit}`
  }

  return compact
}

export const normalizeSearchTerm = (term: string): string => {
  const words = term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d)[,](\d)/g, '$1.$2')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => !STOP_WORDS.has(w) && w.length > 0)
    .map((w) => UNIT_MAP[w] || w)

  return [...new Set(words)].sort().join(' ')
}

const WEIGHT_TOKENS = new Set(['kg', 'kgs', 'g', 'gr', 'grs', 'mg', 'ml', 'mls', 'l', 'lt', 'lts', 'un', 'pct', 'cx', 'fd'])
const BUCKET_SEARCH_NOISE_TOKENS = new Set([
  'sabor', 'sabores', 'sortido', 'sortidos', 'variado', 'variados', 'diverso', 'diversos',
  'produto', 'produtos', 'embalagem', 'embalagens',
  'energetico', 'refrigerante', 'bebida', 'suco',
  'lata', 'latinha', 'garrafa', 'pet', 'pack'
])

const stripWeightLikeTokens = (normalizedTerm: string): string => {
  const tokens = normalizedTerm.split(' ').filter(Boolean)
  const filtered = tokens.filter((t) => {
    if (WEIGHT_TOKENS.has(t)) return false
    if (/^\d+(?:[.,]\d+)?$/.test(t)) return false
    if (/^\d+(?:[.,]\d+)?(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un|pct|cx|fd)$/.test(t)) return false
    if (/^\d+x\d+(?:[.,]\d+)?(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un|pct|cx|fd)$/.test(t)) return false
    return true
  })
  return [...new Set(filtered)].sort().join(' ')
}

const VARIANT_KEYWORDS = new Set([
  'zero', 'light', 'diet', 'sem', 'sugar', 'free',
  'original', 'tradicional', 'classic', 'classico',
  'plus', 'max', 'mini', 'mega', 'ultra', 'pro',
  'suave', 'forte', 'extra', 'premium', 'gold', 'silver',
  'integral', 'desnatado', 'semidesnatado', 'light',
  'lactose', 'sem lactose', 'organico', 'natural',
  'limao', 'laranja', 'uva', 'morango', 'manga', 'abacaxi',
  'maca', 'pessego', 'maracuja', 'guarana', 'cereja',
  'chocolate', 'baunilha', 'caramelo', 'menta', 'hortela',
  'coco', 'amendoim', 'cafe', 'leite', 'mel'
])

const extractWeightTokens = (words: Set<string>): string[] => {
  const weightParts: string[] = []
  const unitTokens = new Set(['kg', 'kgs', 'g', 'gr', 'grs', 'mg', 'ml', 'mls', 'l', 'lt', 'lts', 'un'])

  for (const w of words) {
    const token = String(w || '').trim().toLowerCase()
    if (!token) continue

    if (/^\d+x\d+(?:[.,]\d+)?(?:kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/i.test(token)) {
      weightParts.push(normalizeWeightToken(token))
      continue
    }

    if (/^\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/i.test(token)) {
      weightParts.push(normalizeWeightToken(token))
      continue
    }

    if (/^\d+(?:[.,]\d+)?$/.test(token)) {
      for (const u of unitTokens) {
        if (words.has(u)) {
          weightParts.push(normalizeWeightToken(`${token}${u}`))
          break
        }
      }
    }
  }

  return [...new Set(weightParts)].sort()
}

type FuzzyRejectReason = 'variant' | 'weight_mismatch' | 'weight_missing'
type FuzzyRejectMeta = { reason: FuzzyRejectReason; message: string }
type FuzzyRejectCollector = (meta: FuzzyRejectMeta) => void

const isFuzzyMatchValid = (searchNormalized: string, matchSearchTerm: string, onReject?: FuzzyRejectCollector): boolean => {
  const searchWords = new Set(searchNormalized.split(' '))
  const matchNormalized = normalizeSearchTerm(matchSearchTerm)
  const matchWords = new Set(matchNormalized.split(' '))

  for (const variant of VARIANT_KEYWORDS) {
    const inSearch = searchWords.has(variant)
    const inMatch = matchWords.has(variant)
    if (inSearch !== inMatch) {
      onReject?.({
        reason: 'variant',
        message: `variante "${variant}" presente em ${inSearch ? 'busca' : 'match'} mas nao no ${inSearch ? 'match' : 'busca'}`
      })
      return false
    }
  }

  const searchWeights = extractWeightTokens(searchWords)
  const matchWeights = extractWeightTokens(matchWords)

  if (searchWeights.length > 0 && matchWeights.length > 0) {
    const searchWeightStr = searchWeights.join('|')
    const matchWeightStr = matchWeights.join('|')
    if (searchWeightStr !== matchWeightStr) {
      onReject?.({
        reason: 'weight_mismatch',
        message: `peso/gramatura difere - busca="${searchWeightStr}" vs match="${matchWeightStr}"`
      })
      return false
    }
  }

  if (searchWeights.length > 0 && matchWeights.length === 0) {
    onReject?.({
      reason: 'weight_missing',
      message: `busca tem peso "${searchWeights.join('|')}" mas match nao tem`
    })
    return false
  }

  return true
}

const tokenSet = (normalized: string): Set<string> => new Set(normalized.split(' ').filter(Boolean))

export const hasWeightInNormalized = (normalized: string): boolean => {
  const words = tokenSet(normalized)
  return extractWeightTokens(words).length > 0
}

export const buildExpandedNormalizedCandidates = (opts: {
  rawInputs: string[]
  enforceWeight: boolean
  maxCandidates?: number
}): string[] => {
  const normalizedSet = new Set<string>()
  const addNormalized = (raw: any) => {
    const text = String(raw || '').trim()
    if (!text) return
    const normalized = normalizeSearchTerm(text)
    if (!normalized) return
    normalizedSet.add(normalized)
  }

  for (const rawInput of opts.rawInputs) {
    const raw = String(rawInput || '').trim()
    if (!raw) continue
    addNormalized(raw)

    const parts = raw
      .split(/[.;|,/]+/g)
      .map((p) => p.trim())
      .filter(Boolean)
    for (const part of parts) addNormalized(part)
  }

  const base = Array.from(normalizedSet)
  for (const normalized of base) {
    const tokens = normalized.split(' ').filter(Boolean)
    if (!tokens.length) continue

    const withoutNoise = tokens.filter((t) => !BUCKET_SEARCH_NOISE_TOKENS.has(t))
    if (withoutNoise.length >= 2) {
      normalizedSet.add(withoutNoise.join(' '))
    }

    if (!opts.enforceWeight) {
      const noWeight = stripWeightLikeTokens(normalized)
      if (noWeight) normalizedSet.add(noWeight)
      if (withoutNoise.length >= 2) {
        const withoutNoiseNoWeight = stripWeightLikeTokens(withoutNoise.join(' '))
        if (withoutNoiseNoWeight) normalizedSet.add(withoutNoiseNoWeight)
      }
    }
  }

  const ranked = Array.from(normalizedSet)
    .filter(Boolean)
    .sort((a, b) => {
      const aTokens = a.split(' ').filter(Boolean).length
      const bTokens = b.split(' ').filter(Boolean).length
      if (bTokens !== aTokens) return bTokens - aTokens
      return b.length - a.length
    })

  return ranked.slice(0, Math.max(3, Number(opts.maxCandidates || 12)))
}

const termHash = (normalizedTerm: string): string => {
  return createHash('sha256').update(normalizedTerm).digest('hex').substring(0, 12)
}

const PROCESS_VERSION = 'v2'

export const buildDeterministicS3Key = (normalizedTerm: string): string => {
  const safeName = normalizedTerm.replace(/[^a-z0-9]/g, '-').substring(0, 50)
  const hash = termHash(normalizedTerm)
  return `imagens/smart-${safeName}-${hash}-${PROCESS_VERSION}.webp`
}

export const buildSourceDerivedS3Key = (sourceKey: string): string => {
  const normalizedSource = String(sourceKey || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
  const sourceHash = createHash('sha256').update(normalizedSource).digest('hex').substring(0, 16)
  return `imagens/smart-src-${sourceHash}-${PROCESS_VERSION}.webp`
}

const normalizeExternalImageUrl = (rawUrl: string): string => {
  const value = String(rawUrl || '').trim()
  if (!value) return ''
  try {
    const parsed = new URL(value)
    const host = parsed.host.toLowerCase()
    const pathname = decodeURIComponent(parsed.pathname || '/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'
    return `${parsed.protocol}//${host}${pathname}`
  } catch {
    return value.split('?')[0] || value
  }
}

export const buildExternalSourceDerivedS3Key = (imageUrl: string): string => {
  const normalizedExternal = normalizeExternalImageUrl(imageUrl)
  const sourceHash = createHash('sha256')
    .update(normalizedExternal || imageUrl)
    .digest('hex')
    .substring(0, 16)
  return `imagens/smart-ext-${sourceHash}-${PROCESS_VERSION}.webp`
}

export const isProcessedSmartKey = (key: string): boolean => {
  const k = String(key || '').trim().toLowerCase()
  if (!k.startsWith('imagens/')) return false
  if (!k.includes('/smart-') && !k.startsWith('imagens/smart-')) return false
  return k.includes(`-${PROCESS_VERSION}.webp`) || k.includes(`-${PROCESS_VERSION}.png`)
}

const normalizeS3KeyForMatch = (s3Key: string): string => {
  let file = String(s3Key).split('/').pop() || ''
  try {
    file = decodeURIComponent(file)
  } catch {
    // keep raw filename if malformed URI component
  }

  const noExt = file.replace(/\.(webp|png|jpe?g|gif|svg)$/i, '')
  const cleaned = noExt
    .replace(/^bg-removed-\d+$/i, '')
    .replace(/^\d+-/, '')
    .replace(/^smart-/, '')
    .replace(/-v\d+$/i, '')
    .replace(/-[0-9a-f]{10,}(-v\d+)?$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()

  return normalizeSearchTerm(cleaned)
}

const normalizedS3KeyMemo = new Map<string, string>()
const getNormalizedS3KeyForMatch = (s3Key: string): string => {
  const cached = normalizedS3KeyMemo.get(s3Key)
  if (cached !== undefined) return cached
  const normalized = normalizeS3KeyForMatch(s3Key)
  if (normalizedS3KeyMemo.size > 20_000) normalizedS3KeyMemo.clear()
  normalizedS3KeyMemo.set(s3Key, normalized)
  return normalized
}

type BestS3MatchCacheEntry = {
  expiresAt: number
  result: string | null
}

const bestS3MatchMemo = new Map<string, BestS3MatchCacheEntry>()
const buildBestS3MatchCacheKey = (opts: { bucketName: string; prefixes: string[]; normalizedCandidates: string[] }) => {
  const bucket = String(opts.bucketName || '').trim()
  const prefixes = [...new Set((opts.prefixes || []).map((p) => String(p || '').trim()).filter(Boolean))].sort()
  const candidates = [...new Set((opts.normalizedCandidates || []).map((p) => String(p || '').trim()).filter(Boolean))].sort()
  return `${bucket}::${prefixes.join('|')}::${candidates.join('|')}`
}

const getQueryTokens = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter(Boolean)
    .filter((t) => t.length > 2)
    .filter((t) => !/^\d+$/.test(t))
    .filter((t) => !WEIGHT_TOKENS.has(t))

const scoreKeyMatch = (queryTokens: string[], keyTokenSet: Set<string>) => {
  if (!queryTokens.length) return { ratio: 0, overlap: 0 }
  let overlap = 0
  for (const t of queryTokens) if (keyTokenSet.has(t)) overlap++
  return { ratio: overlap / queryTokens.length, overlap }
}

export const findBestS3Match = async (opts: {
  s3: any
  bucketName: string
  prefixes: string[]
  normalizedCandidates: string[]
}): Promise<string | null> => {
  const bestMatchCacheKey = buildBestS3MatchCacheKey(opts)
  const now = Date.now()
  const cachedBest = bestS3MatchMemo.get(bestMatchCacheKey)
  if (cachedBest && cachedBest.expiresAt > now) {
    return cachedBest.result
  }

  const queryVariants = opts.normalizedCandidates
    .filter(Boolean)
    .map((normalized) => ({ normalized, tokens: getQueryTokens(normalized) }))
    .filter((entry) => entry.tokens.length > 0)

  if (!queryVariants.length) {
    bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: now + 20_000, result: null })
    return null
  }

  let bestStrict: { key: string; ratio: number; overlap: number } | null = null
  let bestRelaxed: { key: string; ratio: number; overlap: number } | null = null
  const fuzzyRejectStats = {
    total: 0,
    variant: 0,
    weight_mismatch: 0,
    weight_missing: 0
  }

  const fuzzyRejectSamples: string[] = []
  const verboseFuzzy = process.env.DEBUG_FUZZY === '1'
  const collectFuzzyReject: FuzzyRejectCollector = (meta) => {
    fuzzyRejectStats.total++
    fuzzyRejectStats[meta.reason]++
    if (verboseFuzzy && fuzzyRejectSamples.length < 6) {
      fuzzyRejectSamples.push(meta.message)
    }
  }

  const listedObjects = await getCachedS3Objects({
    s3: opts.s3,
    bucket: opts.bucketName,
    prefixes: opts.prefixes,
    ttlMs: 60_000,
    maxKeysPerPrefix: 8_000,
    excludeKeyPrefixes: ['uploads/bg-removed-']
  })

  for (const item of listedObjects) {
    const key = item.key
    if (!key) continue

    const normalizedKey = getNormalizedS3KeyForMatch(key)
    if (!normalizedKey) continue
    const keyTokens = tokenSet(normalizedKey)

    for (let idx = 0; idx < queryVariants.length; idx++) {
      const queryNormalized = queryVariants[idx]!.normalized
      if (!isFuzzyMatchValid(queryNormalized, normalizedKey, collectFuzzyReject)) continue

      const queryTokens = queryVariants[idx]!.tokens
      const { ratio, overlap } = scoreKeyMatch(queryTokens, keyTokens)
      const requiresWeightStrict = hasWeightInNormalized(queryNormalized)
      const minRatio = requiresWeightStrict
        ? (queryTokens.length <= 3 ? 1 : 0.85)
        : (queryTokens.length <= 3 ? 0.95 : 0.75)
      const minOverlap = Math.min(3, queryTokens.length)

      if (ratio >= minRatio && overlap >= minOverlap) {
        if (!bestStrict || ratio > bestStrict.ratio || (ratio === bestStrict.ratio && overlap > bestStrict.overlap)) {
          bestStrict = { key, ratio, overlap }
        }
        continue
      }

      if (queryTokens.length >= 4) {
        const relaxedMinRatio = requiresWeightStrict ? 0.62 : 0.58
        const relaxedMinOverlap = Math.min(3, queryTokens.length)
        if (ratio >= relaxedMinRatio && overlap >= relaxedMinOverlap) {
          if (!bestRelaxed || ratio > bestRelaxed.ratio || (ratio === bestRelaxed.ratio && overlap > bestRelaxed.overlap)) {
            bestRelaxed = { key, ratio, overlap }
          }
        }
      }
    }
  }

  const best = bestStrict || bestRelaxed
  if (best) {
    if (verboseFuzzy && fuzzyRejectStats.total > 0) {
      console.log(`INFO [Fuzzy] Summary: total=${fuzzyRejectStats.total}, variant=${fuzzyRejectStats.variant}, weight_mismatch=${fuzzyRejectStats.weight_mismatch}, weight_missing=${fuzzyRejectStats.weight_missing}`)
      if (fuzzyRejectSamples.length > 0) {
        fuzzyRejectSamples.forEach((sample) => console.log(`   - ${sample}`))
      }
    }

    const mode = bestStrict ? 'strict' : 'relaxed'
    console.log(`OK [S3 Match:${mode}] Reuse: "${best.key}" (ratio=${best.ratio.toFixed(2)} overlap=${best.overlap})`)
    bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: Date.now() + 45_000, result: best.key })
    if (bestS3MatchMemo.size > 5000) {
      bestS3MatchMemo.clear()
    }
    return best.key
  }

  if (verboseFuzzy && fuzzyRejectStats.total > 0) {
    console.log(`INFO [Fuzzy] Summary: total=${fuzzyRejectStats.total}, variant=${fuzzyRejectStats.variant}, weight_mismatch=${fuzzyRejectStats.weight_mismatch}, weight_missing=${fuzzyRejectStats.weight_missing}`)
    if (fuzzyRejectSamples.length > 0) {
      fuzzyRejectSamples.forEach((sample) => console.log(`   - ${sample}`))
    }
  }

  bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: Date.now() + 20_000, result: null })
  if (bestS3MatchMemo.size > 5000) {
    bestS3MatchMemo.clear()
  }

  return null
}
