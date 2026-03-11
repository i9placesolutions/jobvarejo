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

const TOKEN_ALIASES: Record<string, string> = {
  // Beverage naming
  refri: 'refrigerante',
  refrigerantes: 'refrigerante',
  coca: 'cocacola',
  cocacola: 'cocacola',
  cocacolaoriginal: 'cocacola',

  // Variant canonicalization
  tradicional: 'original',
  classico: 'original',
  classic: 'original',
  regular: 'original',
  normal: 'original',

  // Sugar-free variants
  zeroacucar: 'zero',
  semacucar: 'zero',
  sugarfree: 'zero',
  semsugar: 'zero',
}

const normalizeQueryPhrases = (value: string): string => {
  let text = String(value || '')
  text = text
    // Keep strong brand identity in one token.
    .replace(/\bcoca[\s-]*cola\b/gi, ' cocacola ')
    // Canonical variant synonyms.
    .replace(/\b(zero\s+acucar|sem\s+acucar|sugar\s*free)\b/gi, ' zero ')
    .replace(/\b(tradicional|classico|classic|regular)\b/gi, ' original ')
    // Canonical unit expressions with quantity.
    .replace(/(\d+(?:[.,]\d+)?)\s*(litros?|lts?|lt)\b/gi, '$1l')
    .replace(/(\d+(?:[.,]\d+)?)\s*(mililitros?|mls?)\b/gi, '$1ml')
  return text
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
  const words = normalizeQueryPhrases(term)
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
    .map((w) => TOKEN_ALIASES[w] || w)

  const set = new Set(words)
  // If only "coca" appears in query, normalize to cocacola semantics.
  if (set.has('coca')) set.add('cocacola')
  // If query has both coca + cola tokens, force the single canonical token too.
  if (set.has('coca') && set.has('cola')) set.add('cocacola')

  return [...set].sort().join(' ')
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
  'original',
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

export type RankedS3MatchCandidate = {
  key: string
  score: number
  ratio?: number
  overlap?: number
  reason: string
  kind: 'exact' | 'strict' | 'relaxed' | 'partial'
  alias?: string
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

const GENERIC_PATH_SEGMENTS = new Set([
  'imagens', 'uploads', 'upload', 'images', 'image', 'img', 'assets', 'asset',
  'produto', 'produtos', 'product', 'products', 'smart', 'processed', 'original',
  'bg-removed', 'tmp', 'temp', 'cache', 'logo', 'logos'
])

const decodeStorageKey = (value: string): string => {
  try {
    return decodeURIComponent(String(value || '').trim())
  } catch {
    return String(value || '').trim()
  }
}

const cleanKeyFragmentForMatch = (value: string): string => {
  const noExt = String(value || '').replace(/\.(webp|png|jpe?g|gif|svg|avif)$/i, '')
  return noExt
    .replace(/^bg-removed-\d+$/i, '')
    .replace(/^\d+-/, '')
    .replace(/^smart-(?:src|ext)?-/, '')
    .replace(/-v\d+$/i, '')
    .replace(/-[0-9a-f]{10,}(-v\d+)?$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
}

const normalizeS3KeyForMatch = (s3Key: string): string => {
  const decoded = decodeStorageKey(s3Key)
  const file = decoded.split('/').pop() || ''
  return normalizeSearchTerm(cleanKeyFragmentForMatch(file))
}

const normalizeS3KeyPathForMatch = (s3Key: string): string => {
  const decoded = decodeStorageKey(s3Key)
  const parts = decoded
    .split('/')
    .map((part) => cleanKeyFragmentForMatch(part))
    .filter(Boolean)
    .filter((part) => {
      const normalized = normalizeSearchTerm(part)
      if (!normalized) return false
      if (GENERIC_PATH_SEGMENTS.has(normalized)) return false
      if (/^\d{4}$/.test(normalized)) return false
      if (/^\d{1,2}$/.test(normalized)) return false
      return true
    })

  return normalizeSearchTerm(parts.join(' '))
}

const normalizeAliasForMatch = (alias: string): string => {
  const cleaned = cleanKeyFragmentForMatch(alias)
  return normalizeSearchTerm(cleaned)
}

const mergeNormalizedSearchTexts = (...values: string[]): string => {
  const tokens = values
    .flatMap((value) => String(value || '').split(' ').map((token) => token.trim()).filter(Boolean))
  if (!tokens.length) return ''
  return [...new Set(tokens)].sort().join(' ')
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

const normalizedS3KeyPathMemo = new Map<string, string>()
const getNormalizedS3KeyPathForMatch = (s3Key: string): string => {
  const cached = normalizedS3KeyPathMemo.get(s3Key)
  if (cached !== undefined) return cached
  const normalized = normalizeS3KeyPathForMatch(s3Key)
  if (normalizedS3KeyPathMemo.size > 20_000) normalizedS3KeyPathMemo.clear()
  normalizedS3KeyPathMemo.set(s3Key, normalized)
  return normalized
}

type BestS3MatchCacheEntry = {
  expiresAt: number
  result: string | null
}

const bestS3MatchMemo = new Map<string, BestS3MatchCacheEntry>()
const buildBestS3MatchCacheKey = (opts: {
  bucketName: string
  prefixes: string[]
  normalizedCandidates: string[]
  brand?: string
  flavor?: string
  weight?: string
  productCode?: string
  strictOnly?: boolean
  cacheNamespace?: string
}) => {
  const bucket = String(opts.bucketName || '').trim()
  const prefixes = [...new Set((opts.prefixes || []).map((p) => String(p || '').trim()).filter(Boolean))].sort()
  const candidates = [...new Set((opts.normalizedCandidates || []).map((p) => String(p || '').trim()).filter(Boolean))].sort()
  const metaBrand = normalizeSearchTerm(String(opts.brand || ''))
  const metaFlavor = normalizeSearchTerm(String(opts.flavor || ''))
  const metaWeight = normalizeSearchTerm(String(opts.weight || ''))
  const metaProductCode = normalizeSearchTerm(String(opts.productCode || ''))
  const cacheNamespace = String(opts.cacheNamespace || '').trim()
  return `${bucket}::${prefixes.join('|')}::${candidates.join('|')}::${metaBrand}::${metaFlavor}::${metaWeight}::${metaProductCode}::${Boolean(opts.strictOnly) ? 'strict' : 'non-strict'}::${cacheNamespace}`
}

const getQueryTokens = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter(Boolean)
    .filter((t) => t.length > 2 || /^\d{2,}$/.test(t))
    .filter((t) => !WEIGHT_TOKENS.has(t))

const getCriticalNumericTokens = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter(Boolean)
    .filter((t) => /^\d{2,}$/.test(t))
    .filter((t, idx, arr) => arr.indexOf(t) === idx)

const scoreKeyMatch = (queryTokens: string[], keyTokenSet: Set<string>) => {
  if (!queryTokens.length) return { ratio: 0, overlap: 0 }
  let overlap = 0
  for (const t of queryTokens) if (keyTokenSet.has(t)) overlap++
  return { ratio: overlap / queryTokens.length, overlap }
}

const getTokenOverlapCount = (tokens: string[], tokenSet: Set<string>): number => {
  let overlap = 0
  for (const token of tokens) {
    if (tokenSet.has(token)) overlap += 1
  }
  return overlap
}

const FLAVOR_NOISE_TOKENS = new Set([
  'sabor', 'sabores', 'sortido', 'sortidos', 'variado', 'variados', 'diverso', 'diversos'
])

const buildMetadataTokens = (value: string, minLen = 2): string[] =>
  normalizeSearchTerm(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= minLen)

const hasAnyToken = (tokens: string[], tokenSet: Set<string>): boolean => {
  for (const token of tokens) if (tokenSet.has(token)) return true
  return false
}

const buildStrongSignalTokens = (input: {
  normalized: string
  productCode?: string
}): string[] => {
  const set = new Set<string>();
  const productCodeTokens = normalizeSearchTerm(String(input.productCode || ''))
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => /^\d{4,}$/.test(token))
    .filter((token, idx, arr) => arr.indexOf(token) === idx);

  for (const token of productCodeTokens) {
    if (token) set.add(token);
  }

  for (const token of normalizeSearchTerm(input.normalized).split(' ').filter(Boolean)) {
    if (!token) continue
    if (VARIANT_KEYWORDS.has(token)) set.add(token)
    if (/^\d{2,}$/.test(token)) set.add(token)
  }

  return Array.from(set)
}

export const findBestS3Match = async (opts: {
  s3: any
  bucketName: string
  prefixes: string[]
  normalizedCandidates: string[]
  brand?: string
  flavor?: string
  weight?: string
  productCode?: string
  strictOnly?: boolean
  keyAliases?: Map<string, string>
  cacheNamespace?: string
  maxKeysPerPrefix?: number
}): Promise<string | null> => {
  const bestMatchCacheKey = buildBestS3MatchCacheKey(opts)
  const now = Date.now()
  const cachedBest = bestS3MatchMemo.get(bestMatchCacheKey)
  if (cachedBest && cachedBest.expiresAt > now) {
    return cachedBest.result
  }

  const queryVariants = opts.normalizedCandidates
    .filter(Boolean)
    .map((normalized) => ({
      normalized,
      tokens: getQueryTokens(normalized),
      criticalNumericTokens: getCriticalNumericTokens(normalized)
    }))
    .filter((entry) => entry.tokens.length > 0)

  if (!queryVariants.length) {
    bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: now + 20_000, result: null })
    return null
  }

  const requiredBrandTokens = buildMetadataTokens(String(opts.brand || ''), 2)
  const requiredFlavorTokens = buildMetadataTokens(String(opts.flavor || ''))
    .filter((token) => !FLAVOR_NOISE_TOKENS.has(token))
  const requiredWeightTokens = extractWeightTokens(tokenSet(normalizeSearchTerm(String(opts.weight || ''))))
  const requiredWeightSet = new Set(requiredWeightTokens)
  const requiredProductCodeTokens = normalizeSearchTerm(String(opts.productCode || ''))
    .split(' ')
    .filter(Boolean)
    .filter((token) => /^\d{4,}$/.test(token));
  const hasStrictSignalContext = requiredWeightTokens.length > 0 || requiredFlavorTokens.length > 0 || requiredProductCodeTokens.length > 0

  let bestStrict: { key: string; ratio: number; overlap: number; score: number } | null = null
  let bestRelaxed: { key: string; ratio: number; overlap: number; score: number } | null = null
  let bestExact: { key: string; score: number; reason: string } | null = null
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
    maxKeysPerPrefix: Math.max(1_000, Number(opts.maxKeysPerPrefix || 8_000)),
    excludeKeyPrefixes: ['uploads/bg-removed-']
  })

  for (const item of listedObjects) {
    const key = item.key
    if (!key) continue

    const alias = String(opts.keyAliases?.get(key) || '').trim()
    const normalizedKeyBase = getNormalizedS3KeyForMatch(key)
    const normalizedKeyPath = getNormalizedS3KeyPathForMatch(key)
    const aliasNormalized = alias ? normalizeAliasForMatch(alias) : ''
    const normalizedKey = mergeNormalizedSearchTexts(normalizedKeyBase, normalizedKeyPath, aliasNormalized)
    const exactKeyTokens = tokenSet(normalizedKey || aliasNormalized || normalizedKeyPath || normalizedKeyBase)

    const exactVariant = queryVariants.find(({ normalized }) =>
      normalized === normalizedKeyBase ||
      normalized === normalizedKeyPath ||
      normalized === aliasNormalized ||
      normalized === normalizedKey
    )
    if (exactVariant) {
      let exactScore = 3
      if (exactVariant.normalized === aliasNormalized) exactScore += 1.35
      if (exactVariant.normalized === normalizedKeyBase) exactScore += 0.95
      if (exactVariant.normalized === normalizedKeyPath) exactScore += 0.75
      if (exactVariant.normalized === normalizedKey) exactScore += 0.55
      if (key.startsWith('uploads/')) exactScore += 0.2
      if (requiredBrandTokens.length > 0 && hasAnyToken(requiredBrandTokens, exactKeyTokens)) exactScore += 0.15
      if (requiredWeightTokens.length > 0 && requiredWeightTokens.some((token) => exactKeyTokens.has(token))) exactScore += 0.18
      if (!bestExact || exactScore > bestExact.score) {
        const exactReason = exactVariant.normalized === aliasNormalized
          ? 'alias-exato'
          : exactVariant.normalized === normalizedKeyBase
            ? 'arquivo-exato'
            : exactVariant.normalized === normalizedKeyPath
              ? 'caminho-exato'
              : 'combinado-exato'
        bestExact = { key, score: exactScore, reason: exactReason }
      }
      continue
    }

    if (!normalizedKey) continue
    const keyTokens = tokenSet(normalizedKey)
    if (keyTokens.size < 2) continue
    const aliasTokens = tokenSet(aliasNormalized)

    const hasQueryVariantSignal = requiredWeightTokens.length > 0 || requiredFlavorTokens.length > 0
    const hasRequiredProductCodeSignal = requiredProductCodeTokens.length > 0

    if (requiredBrandTokens.length > 0 && !hasAnyToken(requiredBrandTokens, keyTokens)) {
      continue
    }
    if (requiredFlavorTokens.length > 0 && !hasAnyToken(requiredFlavorTokens, keyTokens)) {
      const hasVariantSignalInKey = Array.from(VARIANT_KEYWORDS).some((token) => keyTokens.has(token))
      if (hasVariantSignalInKey) continue
    }

    const keyWeightTokens = extractWeightTokens(keyTokens)
    const keyWeightSet = new Set(keyWeightTokens)
    if (requiredWeightTokens.length > 0) {
      if (opts.strictOnly && keyWeightTokens.length === 0) {
        continue
      }
      if (requiredWeightTokens.length > 0 && !requiredWeightTokens.some((token) => keyWeightSet.has(token))) {
        continue
      }
    }

    if (hasRequiredProductCodeSignal && opts.strictOnly && !requiredProductCodeTokens.some((token) => keyTokens.has(token))) {
      continue
    }

    for (let idx = 0; idx < queryVariants.length; idx++) {
      const queryNormalized = queryVariants[idx]!.normalized
      if (!isFuzzyMatchValid(queryNormalized, normalizedKey, collectFuzzyReject)) continue

      const queryTokens = queryVariants[idx]!.tokens
      const criticalNumericTokens = queryVariants[idx]!.criticalNumericTokens
      const strictSignals = buildStrongSignalTokens({ normalized: queryNormalized, productCode: opts.productCode })
      const hasStrongSignalFromQuery = strictSignals.some((token) => keyTokens.has(token))
      const hasStrongWeightSignal = requiredWeightSet.size > 0 && requiredWeightTokens.some((token) => keyWeightSet.has(token))
      const hasStrongFlavorSignal = requiredFlavorTokens.length > 0 && hasAnyToken(requiredFlavorTokens, keyTokens)
      const hasStrongCodeSignal = requiredProductCodeTokens.length > 0 && requiredProductCodeTokens.some((token) => keyTokens.has(token))
      const hasStrictFallbackSignal = hasStrongSignalFromQuery || hasStrongWeightSignal || hasStrongFlavorSignal || hasStrongCodeSignal
      if (opts.strictOnly && (hasStrictSignalContext || hasQueryVariantSignal) && !hasStrictFallbackSignal) {
        continue
      }

      // Guard rail: códigos numéricos curtos (ex: 51, 29) são discriminadores fortes.
      if (criticalNumericTokens.length > 0 && criticalNumericTokens.some((token) => !keyTokens.has(token))) {
        continue
      }

      const { ratio, overlap } = scoreKeyMatch(queryTokens, keyTokens)
      const aliasOverlap = aliasTokens.size > 0 ? getTokenOverlapCount(queryTokens, aliasTokens) : 0
      const pathOverlap = normalizedKeyPath ? getTokenOverlapCount(queryTokens, tokenSet(normalizedKeyPath)) : 0
      const requiresWeightStrict = hasWeightInNormalized(queryNormalized)
      const shouldEnforceStrictSignals = opts.strictOnly && (hasStrictSignalContext || hasQueryVariantSignal)
      const minRatio = shouldEnforceStrictSignals
        ? (queryTokens.length <= 3
          ? 1
          : queryTokens.length <= 5
            ? 0.92
            : 0.9)
        : (requiresWeightStrict
          ? (queryTokens.length <= 3 ? 1 : queryTokens.length <= 5 ? 0.9 : 0.86)
          : (queryTokens.length <= 3 ? 1 : queryTokens.length <= 5 ? 0.86 : 0.8))
      const minOverlap = queryTokens.length >= 6
        ? (shouldEnforceStrictSignals ? 5 : 4)
        : Math.min(shouldEnforceStrictSignals ? 4 : 3, queryTokens.length)

      if (ratio >= minRatio && overlap >= minOverlap) {
        const aliasBoost = aliasOverlap > 0
          ? ((aliasOverlap / Math.max(1, queryTokens.length)) * 0.26) + (aliasOverlap === queryTokens.length ? 0.24 : 0)
          : 0
        const pathBoost = pathOverlap > 0 ? Math.min(0.16, pathOverlap * 0.025) : 0
        const prefixBoost = key.startsWith('uploads/') ? 0.08 : (key.startsWith('imagens/') ? 0.03 : 0)
        const exactishBoost =
          queryNormalized === aliasNormalized ? 0.65 :
          queryNormalized === normalizedKeyBase ? 0.48 :
          queryNormalized === normalizedKeyPath ? 0.34 :
          queryNormalized === normalizedKey ? 0.28 :
          0
        const strictScore =
          ratio +
          (overlap * 0.02) +
          (Math.min(queryTokens.length, 8) * 0.03) +
          aliasBoost +
          pathBoost +
          prefixBoost +
          exactishBoost
        if (
          !bestStrict ||
          strictScore > bestStrict.score ||
          (strictScore === bestStrict.score && overlap > bestStrict.overlap)
        ) {
          bestStrict = { key, ratio, overlap, score: strictScore }
        }
        continue
      }

      if (queryTokens.length >= 5) {
        const relaxedMinRatio = requiresWeightStrict ? 0.72 : 0.68
        const relaxedMinOverlap = queryTokens.length >= 7 ? 4 : 3
        if (ratio >= relaxedMinRatio && overlap >= relaxedMinOverlap) {
          const aliasBoost = aliasOverlap > 0
            ? ((aliasOverlap / Math.max(1, queryTokens.length)) * 0.18)
            : 0
          const pathBoost = pathOverlap > 0 ? Math.min(0.1, pathOverlap * 0.018) : 0
          const prefixBoost = key.startsWith('uploads/') ? 0.05 : (key.startsWith('imagens/') ? 0.02 : 0)
          const relaxedScore =
            ratio +
            (overlap * 0.015) +
            (Math.min(queryTokens.length, 8) * 0.02) +
            aliasBoost +
            pathBoost +
            prefixBoost
          if (
            !bestRelaxed ||
            relaxedScore > bestRelaxed.score ||
            (relaxedScore === bestRelaxed.score && overlap > bestRelaxed.overlap)
          ) {
            bestRelaxed = { key, ratio, overlap, score: relaxedScore }
          }
        }
      }
    }
  }

  if (bestExact) {
    console.log(`OK [S3 Match:exact] Reuse: "${bestExact.key}" (${bestExact.reason}, score=${bestExact.score.toFixed(3)})`)
    bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: Date.now() + 45_000, result: bestExact.key })
    if (bestS3MatchMemo.size > 5000) {
      bestS3MatchMemo.clear()
    }
    return bestExact.key
  }

  const best = opts.strictOnly ? bestStrict : (bestStrict || bestRelaxed)
  if (best) {
    if (verboseFuzzy && fuzzyRejectStats.total > 0) {
      console.log(`INFO [Fuzzy] Summary: total=${fuzzyRejectStats.total}, variant=${fuzzyRejectStats.variant}, weight_mismatch=${fuzzyRejectStats.weight_mismatch}, weight_missing=${fuzzyRejectStats.weight_missing}`)
      if (fuzzyRejectSamples.length > 0) {
        fuzzyRejectSamples.forEach((sample) => console.log(`   - ${sample}`))
      }
    }

    const mode = bestStrict ? 'strict' : 'relaxed'
    console.log(`OK [S3 Match:${mode}] Reuse: "${best.key}" (ratio=${best.ratio.toFixed(2)} overlap=${best.overlap} score=${best.score.toFixed(3)})`)
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

export const findTopS3Matches = async (opts: {
  s3: any
  bucketName: string
  prefixes: string[]
  normalizedCandidates: string[]
  brand?: string
  flavor?: string
  weight?: string
  productCode?: string
  strictOnly?: boolean
  keyAliases?: Map<string, string>
  cacheNamespace?: string
  maxKeysPerPrefix?: number
  limit?: number
}): Promise<RankedS3MatchCandidate[]> => {
  const queryVariants = opts.normalizedCandidates
    .filter(Boolean)
    .map((normalized) => ({
      normalized,
      tokens: getQueryTokens(normalized),
      criticalNumericTokens: getCriticalNumericTokens(normalized)
    }))
    .filter((entry) => entry.tokens.length > 0)

  if (!queryVariants.length) return []

  const requiredBrandTokens = buildMetadataTokens(String(opts.brand || ''), 2)
  const requiredFlavorTokens = buildMetadataTokens(String(opts.flavor || ''))
    .filter((token) => !FLAVOR_NOISE_TOKENS.has(token))
  const requiredWeightTokens = extractWeightTokens(tokenSet(normalizeSearchTerm(String(opts.weight || ''))))
  const requiredWeightSet = new Set(requiredWeightTokens)
  const requiredProductCodeTokens = normalizeSearchTerm(String(opts.productCode || ''))
    .split(' ')
    .filter(Boolean)
    .filter((token) => /^\d{4,}$/.test(token))
  const hasStrictSignalContext = requiredWeightTokens.length > 0 || requiredFlavorTokens.length > 0 || requiredProductCodeTokens.length > 0

  const listedObjects = await getCachedS3Objects({
    s3: opts.s3,
    bucket: opts.bucketName,
    prefixes: opts.prefixes,
    ttlMs: 60_000,
    maxKeysPerPrefix: Math.max(1_000, Number(opts.maxKeysPerPrefix || 8_000)),
    excludeKeyPrefixes: ['uploads/bg-removed-']
  })

  const rankedByKey = new Map<string, RankedS3MatchCandidate>()
  const pushCandidate = (candidate: RankedS3MatchCandidate) => {
    const existing = rankedByKey.get(candidate.key)
    if (!existing) {
      rankedByKey.set(candidate.key, candidate)
      return
    }

    if (candidate.score > existing.score) {
      rankedByKey.set(candidate.key, candidate)
      return
    }

    if (candidate.score === existing.score) {
      const candidateOverlap = Number(candidate.overlap || 0)
      const existingOverlap = Number(existing.overlap || 0)
      if (candidateOverlap > existingOverlap) {
        rankedByKey.set(candidate.key, candidate)
      }
    }
  }

  for (const item of listedObjects) {
    const key = item.key
    if (!key) continue

    const alias = String(opts.keyAliases?.get(key) || '').trim()
    const normalizedKeyBase = getNormalizedS3KeyForMatch(key)
    const normalizedKeyPath = getNormalizedS3KeyPathForMatch(key)
    const aliasNormalized = alias ? normalizeAliasForMatch(alias) : ''
    const normalizedKey = mergeNormalizedSearchTexts(normalizedKeyBase, normalizedKeyPath, aliasNormalized)
    const keyTokens = tokenSet(normalizedKey || aliasNormalized || normalizedKeyPath || normalizedKeyBase)

    const exactVariant = queryVariants.find(({ normalized }) =>
      normalized === normalizedKeyBase ||
      normalized === normalizedKeyPath ||
      normalized === aliasNormalized ||
      normalized === normalizedKey
    )
    if (exactVariant) {
      let exactScore = 400
      if (exactVariant.normalized === aliasNormalized) exactScore += 12
      if (exactVariant.normalized === normalizedKeyBase) exactScore += 9
      if (exactVariant.normalized === normalizedKeyPath) exactScore += 7
      if (exactVariant.normalized === normalizedKey) exactScore += 5
      if (key.startsWith('uploads/')) exactScore += 2
      if (requiredBrandTokens.length > 0 && hasAnyToken(requiredBrandTokens, keyTokens)) exactScore += 2
      if (requiredWeightTokens.length > 0 && requiredWeightTokens.some((token) => keyTokens.has(token))) exactScore += 3
      const exactReason = exactVariant.normalized === aliasNormalized
        ? 'Match interno exato por nome renomeado'
        : exactVariant.normalized === normalizedKeyBase
          ? 'Match interno exato por nome de arquivo'
          : exactVariant.normalized === normalizedKeyPath
            ? 'Match interno exato por caminho do storage'
            : 'Match interno exato pelo texto combinado'
      pushCandidate({
        key,
        score: exactScore,
        ratio: 1,
        overlap: exactVariant.tokens.length,
        reason: exactReason,
        kind: 'exact',
        alias: alias || undefined
      })
      continue
    }

    if (!normalizedKey) continue
    if (keyTokens.size < 2) continue

    if (requiredBrandTokens.length > 0 && !hasAnyToken(requiredBrandTokens, keyTokens)) {
      continue
    }
    if (requiredFlavorTokens.length > 0 && !hasAnyToken(requiredFlavorTokens, keyTokens)) {
      const hasVariantSignalInKey = Array.from(VARIANT_KEYWORDS).some((token) => keyTokens.has(token))
      if (hasVariantSignalInKey) continue
    }

    const keyWeightTokens = extractWeightTokens(keyTokens)
    const keyWeightSet = new Set(keyWeightTokens)
    if (requiredWeightTokens.length > 0) {
      if (opts.strictOnly && keyWeightTokens.length === 0) {
        continue
      }
      if (!requiredWeightTokens.some((token) => keyWeightSet.has(token))) {
        continue
      }
    }

    if (requiredProductCodeTokens.length > 0 && opts.strictOnly && !requiredProductCodeTokens.some((token) => keyTokens.has(token))) {
      continue
    }

    let bestForKey: RankedS3MatchCandidate | null = null
    const aliasTokens = tokenSet(aliasNormalized)
    const pathTokens = normalizedKeyPath ? tokenSet(normalizedKeyPath) : new Set<string>()

    for (let idx = 0; idx < queryVariants.length; idx++) {
      const queryNormalized = queryVariants[idx]!.normalized
      if (!isFuzzyMatchValid(queryNormalized, normalizedKey)) continue

      const queryTokens = queryVariants[idx]!.tokens
      const criticalNumericTokens = queryVariants[idx]!.criticalNumericTokens
      const strictSignals = buildStrongSignalTokens({ normalized: queryNormalized, productCode: opts.productCode })
      const hasStrongSignalFromQuery = strictSignals.some((token) => keyTokens.has(token))
      const hasStrongWeightSignal = requiredWeightSet.size > 0 && requiredWeightTokens.some((token) => keyWeightSet.has(token))
      const hasStrongFlavorSignal = requiredFlavorTokens.length > 0 && hasAnyToken(requiredFlavorTokens, keyTokens)
      const hasStrongCodeSignal = requiredProductCodeTokens.length > 0 && requiredProductCodeTokens.some((token) => keyTokens.has(token))
      const hasStrictFallbackSignal = hasStrongSignalFromQuery || hasStrongWeightSignal || hasStrongFlavorSignal || hasStrongCodeSignal

      if (criticalNumericTokens.length > 0 && criticalNumericTokens.some((token) => !keyTokens.has(token))) {
        continue
      }

      const { ratio, overlap } = scoreKeyMatch(queryTokens, keyTokens)
      const aliasOverlap = aliasTokens.size > 0 ? getTokenOverlapCount(queryTokens, aliasTokens) : 0
      const pathOverlap = pathTokens.size > 0 ? getTokenOverlapCount(queryTokens, pathTokens) : 0
      const requiresWeightStrict = hasWeightInNormalized(queryNormalized)
      const shouldEnforceStrictSignals = !!opts.strictOnly && (hasStrictSignalContext || requiredFlavorTokens.length > 0 || requiredWeightTokens.length > 0)
      const minRatio = shouldEnforceStrictSignals
        ? (queryTokens.length <= 3 ? 1 : queryTokens.length <= 5 ? 0.92 : 0.9)
        : (requiresWeightStrict
          ? (queryTokens.length <= 3 ? 1 : queryTokens.length <= 5 ? 0.9 : 0.86)
          : (queryTokens.length <= 3 ? 1 : queryTokens.length <= 5 ? 0.86 : 0.8))
      const minOverlap = queryTokens.length >= 6
        ? (shouldEnforceStrictSignals ? 5 : 4)
        : Math.min(shouldEnforceStrictSignals ? 4 : 3, queryTokens.length)

      let candidate: RankedS3MatchCandidate | null = null

      if (ratio >= minRatio && overlap >= minOverlap) {
        const aliasBoost = aliasOverlap > 0
          ? ((aliasOverlap / Math.max(1, queryTokens.length)) * 26) + (aliasOverlap === queryTokens.length ? 10 : 0)
          : 0
        const pathBoost = pathOverlap > 0 ? Math.min(10, pathOverlap * 1.6) : 0
        const prefixBoost = key.startsWith('uploads/') ? 8 : (key.startsWith('imagens/') ? 3 : 0)
        const exactishBoost =
          queryNormalized === aliasNormalized ? 18 :
          queryNormalized === normalizedKeyBase ? 14 :
          queryNormalized === normalizedKeyPath ? 10 :
          queryNormalized === normalizedKey ? 8 :
          0
        candidate = {
          key,
          score: 250 + (ratio * 100) + (overlap * 2) + aliasBoost + pathBoost + prefixBoost + exactishBoost,
          ratio,
          overlap,
          reason: 'Match interno forte por nome, metadata e sinais do produto',
          kind: 'strict',
          alias: alias || undefined
        }
      } else if (queryTokens.length >= 5) {
        const relaxedMinRatio = requiresWeightStrict ? 0.72 : 0.68
        const relaxedMinOverlap = queryTokens.length >= 7 ? 4 : 3
        if (ratio >= relaxedMinRatio && overlap >= relaxedMinOverlap) {
          const aliasBoost = aliasOverlap > 0
            ? ((aliasOverlap / Math.max(1, queryTokens.length)) * 14)
            : 0
          const pathBoost = pathOverlap > 0 ? Math.min(8, pathOverlap * 1.1) : 0
          const prefixBoost = key.startsWith('uploads/') ? 5 : (key.startsWith('imagens/') ? 2 : 0)
          candidate = {
            key,
            score: 150 + (ratio * 100) + (overlap * 1.8) + aliasBoost + pathBoost + prefixBoost,
            ratio,
            overlap,
            reason: 'Match interno plausível; precisa de confirmação visual',
            kind: 'relaxed',
            alias: alias || undefined
          }
        }
      }

      if (!candidate && hasStrictFallbackSignal && overlap >= Math.min(Math.max(2, queryTokens.length - 2), queryTokens.length) && ratio >= 0.58) {
        candidate = {
          key,
          score: 90 + (ratio * 100) + (overlap * 1.4) + (hasStrongSignalFromQuery ? 10 : 0) + (key.startsWith('uploads/') ? 4 : 0),
          ratio,
          overlap,
          reason: 'Sinais internos relevantes encontrados, mas ainda com dúvida',
          kind: 'partial',
          alias: alias || undefined
        }
      }

      if (candidate && (!bestForKey || candidate.score > bestForKey.score)) {
        bestForKey = candidate
      }
    }

    if (bestForKey) {
      pushCandidate(bestForKey)
    }
  }

  return Array.from(rankedByKey.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aOverlap = Number(a.overlap || 0)
      const bOverlap = Number(b.overlap || 0)
      if (bOverlap !== aOverlap) return bOverlap - aOverlap
      return a.key.localeCompare(b.key)
    })
    .slice(0, Math.max(1, Number(opts.limit || 6)))
}
