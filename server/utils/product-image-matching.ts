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
  // Bebidas
  refri: 'refrigerante',
  refrigerantes: 'refrigerante',
  coca: 'cocacola',
  cocacola: 'cocacola',
  cocacolaoriginal: 'cocacola',
  guarana: 'guarana',
  guaranaantarctica: 'guarana',
  ant: 'antarctica',

  // Marcas comuns (sub-marca -> marca principal quando ajuda a colar)
  ninho: 'ninho',
  leiteninho: 'ninho',
  toddy: 'toddy',
  nescau: 'nescau',
  neston: 'neston',
  danone: 'danone',
  itambe: 'itambe',
  parmalat: 'parmalat',
  piracanjuba: 'piracanjuba',
  nestle: 'nestle',
  unilever: 'unilever',
  bauducco: 'bauducco',
  nestlebrasil: 'nestle',

  // Variantes
  tradicional: 'original',
  classico: 'original',
  classic: 'original',
  regular: 'original',
  normal: 'original',

  // Zero/sem acucar
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

  // So extrai pesos quando ja vem como TOKEN UNICO (5kg, 400g, 2x500ml).
  // O branch antigo "digito solitario + unidade qualquer no set" gerava
  // pesos fantasma quando o nome trazia coisas como "TP-1" + "und" → "1un".
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
  }

  return [...new Set(weightParts)].sort()
}

type FuzzyRejectReason = 'variant' | 'weight_mismatch' | 'weight_missing'
type FuzzyRejectMeta = { reason: FuzzyRejectReason; message: string }
type FuzzyRejectCollector = (meta: FuzzyRejectMeta) => void

// Checa compatibilidade entre termo buscado e termo da key.
// - Variante diferente (zero vs original): rejeita.
// - Peso explicitamente diferente (500g vs 1kg): rejeita.
// - Peso ausente na key (key nao traz gramatura no nome): ACEITA por default,
//   porque a maioria das imagens internas nao tem gramatura no path. Passe
//   requireWeightInKey=true para aplicar o gate duro (modo estrito).
const isFuzzyMatchValid = (
  searchNormalized: string,
  matchSearchTerm: string,
  onReject?: FuzzyRejectCollector,
  opts?: { requireWeightInKey?: boolean }
): boolean => {
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
    // Aceita o match se PELO MENOS UM peso for comum entre busca e key.
    // Antes a comparacao era stringificada exata, o que rejeitava casos
    // onde a busca tinha pesos extras (ex: pacote "2x500ml" + volume total)
    // mas a key tinha so um deles.
    const matchSet = new Set(matchWeights)
    const anyShared = searchWeights.some((w) => matchSet.has(w))
    if (!anyShared) {
      onReject?.({
        reason: 'weight_mismatch',
        message: `peso/gramatura difere - busca="${searchWeights.join('|')}" vs match="${matchWeights.join('|')}"`
      })
      return false
    }
  }

  if (opts?.requireWeightInKey && searchWeights.length > 0 && matchWeights.length === 0) {
    onReject?.({
      reason: 'weight_missing',
      message: `busca tem peso "${searchWeights.join('|')}" mas match nao tem`
    })
    return false
  }

  return true
}

const tokenSet = (normalized: string): Set<string> => new Set(normalized.split(' ').filter(Boolean))

// Distancia de Levenshtein com cap (corta cedo se passar do limite).
const levenshteinCapped = (a: string, b: string, cap: number): number => {
  if (a === b) return 0
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > cap) return cap + 1
  if (!la) return lb
  if (!lb) return la

  let prev = new Array(lb + 1)
  let curr = new Array(lb + 1)
  for (let j = 0; j <= lb; j++) prev[j] = j

  for (let i = 1; i <= la; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      )
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > cap) return cap + 1
    const tmp = prev
    prev = curr
    curr = tmp
  }

  return prev[lb]
}

// Retorna score 0..1 de quanto um token da query bate com algum token do set da key.
// 1.0 = exato, 0.92 = substring forte, 0.88 = levenshtein 1, 0.72 = levenshtein 2 (len>=6).
const fuzzyTokenScore = (token: string, keyTokens: Set<string>): number => {
  if (!token) return 0
  if (keyTokens.has(token)) return 1
  if (token.length < 4) return 0

  let best = 0
  for (const kt of keyTokens) {
    if (!kt || kt.length < 4) continue

    // Substring em qualquer direcao (so quando a sobreposicao e grande).
    if (kt.includes(token) || token.includes(kt)) {
      const smaller = Math.min(kt.length, token.length)
      const bigger = Math.max(kt.length, token.length)
      if (smaller / bigger >= 0.7) {
        if (best < 0.92) best = 0.92
        if (best === 1) return 1
        continue
      }
    }

    // Levenshtein: tolera typos e pequenos plurais/prefixos.
    if (Math.abs(kt.length - token.length) <= 2) {
      const dist = levenshteinCapped(token, kt, 2)
      if (dist <= 1 && best < 0.88) best = 0.88
      else if (dist <= 2 && token.length >= 6 && best < 0.72) best = 0.72
    }
  }

  return best
}

// Overlap com fuzzy: devolve ratio (0..1) combinando matches exatos + parciais,
// alem do overlap exato (inteiro) para gates de quantidade minima.
const computeFuzzyOverlap = (
  queryTokens: string[],
  keyTokens: Set<string>
): { ratio: number; overlap: number; fuzzyOverlap: number } => {
  if (!queryTokens.length) return { ratio: 0, overlap: 0, fuzzyOverlap: 0 }
  let exact = 0
  let fuzzy = 0
  for (const t of queryTokens) {
    if (keyTokens.has(t)) { exact++; continue }
    fuzzy += fuzzyTokenScore(t, keyTokens)
  }
  const combined = exact + fuzzy
  return {
    ratio: combined / queryTokens.length,
    overlap: exact,
    fuzzyOverlap: combined
  }
}

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
  const requiredProductCodeTokens = normalizeSearchTerm(String(opts.productCode || ''))
    .split(' ')
    .filter(Boolean)
    .filter((token) => /^\d{4,}$/.test(token));

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
    if (keyTokens.size < 1) continue
    const aliasTokens = tokenSet(aliasNormalized)

    const hasRequiredProductCodeSignal = requiredProductCodeTokens.length > 0

    // Sinais de marca/sabor/peso viram SOFT: nao descartamos a key,
    // apenas penalizamos o score quando o sinal nao aparece.
    const brandPresent = requiredBrandTokens.length === 0 || hasAnyToken(requiredBrandTokens, keyTokens)
    const flavorPresent = requiredFlavorTokens.length === 0 || hasAnyToken(requiredFlavorTokens, keyTokens)

    const keyWeightTokens = extractWeightTokens(keyTokens)
    const keyWeightSet = new Set(keyWeightTokens)
    const weightPresent = requiredWeightTokens.length === 0 || requiredWeightTokens.some((token) => keyWeightSet.has(token))
    const weightConflict = requiredWeightTokens.length > 0 && keyWeightTokens.length > 0 && !weightPresent
    if (weightConflict) {
      // Peso explicitamente diferente continua sendo erro DURO (500g != 1kg).
      continue
    }
    if (opts.strictOnly && requiredWeightTokens.length > 0 && keyWeightTokens.length === 0) {
      // Modo estrito exige gramatura no nome da key.
      continue
    }
    if (opts.strictOnly && requiredBrandTokens.length > 0 && !brandPresent) {
      continue
    }
    if (opts.strictOnly && requiredFlavorTokens.length > 0 && !flavorPresent) {
      continue
    }

    if (hasRequiredProductCodeSignal && opts.strictOnly && !requiredProductCodeTokens.some((token) => keyTokens.has(token))) {
      continue
    }

    for (let idx = 0; idx < queryVariants.length; idx++) {
      const queryNormalized = queryVariants[idx]!.normalized
      if (!isFuzzyMatchValid(queryNormalized, normalizedKey, collectFuzzyReject, { requireWeightInKey: !!opts.strictOnly })) continue

      const queryTokens = queryVariants[idx]!.tokens
      const criticalNumericTokens = queryVariants[idx]!.criticalNumericTokens

      // Guard rail: códigos numéricos curtos (ex: 51, 29) são discriminadores fortes.
      if (criticalNumericTokens.length > 0 && criticalNumericTokens.some((token) => !keyTokens.has(token))) {
        continue
      }

      const { ratio, overlap, fuzzyOverlap } = computeFuzzyOverlap(queryTokens, keyTokens)
      const aliasOverlap = aliasTokens.size > 0 ? getTokenOverlapCount(queryTokens, aliasTokens) : 0
      const pathOverlap = normalizedKeyPath ? getTokenOverlapCount(queryTokens, tokenSet(normalizedKeyPath)) : 0

      // Thresholds calibrados para tolerar nomes parciais/typos/falta de gramatura.
      // Modo strict ainda exige bem mais.
      const minRatio = opts.strictOnly
        ? (queryTokens.length <= 3 ? 0.85 : queryTokens.length <= 5 ? 0.78 : 0.72)
        : (queryTokens.length <= 2 ? 0.7 : queryTokens.length <= 4 ? 0.6 : queryTokens.length <= 6 ? 0.55 : 0.5)
      const minOverlap = opts.strictOnly
        ? Math.min(queryTokens.length, queryTokens.length <= 4 ? 2 : 3)
        : Math.min(queryTokens.length, queryTokens.length <= 3 ? 1 : 2)

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
        // Penalidades por sinais ausentes (soft signals).
        const brandPenalty = brandPresent ? 0 : 0.18
        const flavorPenalty = flavorPresent ? 0 : 0.12
        const weightPenalty = (requiredWeightTokens.length > 0 && keyWeightTokens.length === 0) ? 0.1 : 0
        const fuzzyBonus = (fuzzyOverlap - overlap) * 0.04
        const strictScore =
          ratio +
          (overlap * 0.02) +
          (Math.min(queryTokens.length, 8) * 0.03) +
          aliasBoost +
          pathBoost +
          prefixBoost +
          exactishBoost +
          fuzzyBonus -
          brandPenalty -
          flavorPenalty -
          weightPenalty
        if (
          !bestStrict ||
          strictScore > bestStrict.score ||
          (strictScore === bestStrict.score && overlap > bestStrict.overlap)
        ) {
          bestStrict = { key, ratio, overlap, score: strictScore }
        }
        continue
      }

      // Caminho relaxado para queries de tamanho medio com tokens parciais.
      if (queryTokens.length >= 3) {
        const relaxedMinRatio = opts.strictOnly ? 0.65 : 0.45
        const relaxedMinOverlap = 1
        if (ratio >= relaxedMinRatio && overlap >= relaxedMinOverlap) {
          const aliasBoost = aliasOverlap > 0 ? ((aliasOverlap / Math.max(1, queryTokens.length)) * 0.18) : 0
          const pathBoost = pathOverlap > 0 ? Math.min(0.1, pathOverlap * 0.018) : 0
          const prefixBoost = key.startsWith('uploads/') ? 0.05 : (key.startsWith('imagens/') ? 0.02 : 0)
          const brandPenalty = brandPresent ? 0 : 0.22
          const flavorPenalty = flavorPresent ? 0 : 0.14
          const weightPenalty = (requiredWeightTokens.length > 0 && keyWeightTokens.length === 0) ? 0.12 : 0
          const fuzzyBonus = (fuzzyOverlap - overlap) * 0.05
          const relaxedScore =
            ratio +
            (overlap * 0.015) +
            (Math.min(queryTokens.length, 8) * 0.02) +
            aliasBoost +
            pathBoost +
            prefixBoost +
            fuzzyBonus -
            brandPenalty -
            flavorPenalty -
            weightPenalty
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
  const requiredProductCodeTokens = normalizeSearchTerm(String(opts.productCode || ''))
    .split(' ')
    .filter(Boolean)
    .filter((token) => /^\d{4,}$/.test(token))

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
    if (keyTokens.size < 1) continue

    // Soft signals (mesma logica do findBestS3Match).
    const brandPresent = requiredBrandTokens.length === 0 || hasAnyToken(requiredBrandTokens, keyTokens)
    const flavorPresent = requiredFlavorTokens.length === 0 || hasAnyToken(requiredFlavorTokens, keyTokens)

    const keyWeightTokens = extractWeightTokens(keyTokens)
    const keyWeightSet = new Set(keyWeightTokens)
    const weightPresent = requiredWeightTokens.length === 0 || requiredWeightTokens.some((token) => keyWeightSet.has(token))
    const weightConflict = requiredWeightTokens.length > 0 && keyWeightTokens.length > 0 && !weightPresent
    if (weightConflict) continue
    if (opts.strictOnly && requiredWeightTokens.length > 0 && keyWeightTokens.length === 0) continue
    if (opts.strictOnly && requiredBrandTokens.length > 0 && !brandPresent) continue
    if (opts.strictOnly && requiredFlavorTokens.length > 0 && !flavorPresent) continue

    if (requiredProductCodeTokens.length > 0 && opts.strictOnly && !requiredProductCodeTokens.some((token) => keyTokens.has(token))) {
      continue
    }

    let bestForKey: RankedS3MatchCandidate | null = null
    const aliasTokens = tokenSet(aliasNormalized)
    const pathTokens = normalizedKeyPath ? tokenSet(normalizedKeyPath) : new Set<string>()

    for (let idx = 0; idx < queryVariants.length; idx++) {
      const queryNormalized = queryVariants[idx]!.normalized
      if (!isFuzzyMatchValid(queryNormalized, normalizedKey, undefined, { requireWeightInKey: !!opts.strictOnly })) continue

      const queryTokens = queryVariants[idx]!.tokens
      const criticalNumericTokens = queryVariants[idx]!.criticalNumericTokens

      if (criticalNumericTokens.length > 0 && criticalNumericTokens.some((token) => !keyTokens.has(token))) {
        continue
      }

      const { ratio, overlap, fuzzyOverlap } = computeFuzzyOverlap(queryTokens, keyTokens)
      const aliasOverlap = aliasTokens.size > 0 ? getTokenOverlapCount(queryTokens, aliasTokens) : 0
      const pathOverlap = pathTokens.size > 0 ? getTokenOverlapCount(queryTokens, pathTokens) : 0

      const minRatio = opts.strictOnly
        ? (queryTokens.length <= 3 ? 0.85 : queryTokens.length <= 5 ? 0.78 : 0.72)
        : (queryTokens.length <= 2 ? 0.7 : queryTokens.length <= 4 ? 0.6 : queryTokens.length <= 6 ? 0.55 : 0.5)
      const minOverlap = opts.strictOnly
        ? Math.min(queryTokens.length, queryTokens.length <= 4 ? 2 : 3)
        : Math.min(queryTokens.length, queryTokens.length <= 3 ? 1 : 2)

      const brandPenaltyPts = brandPresent ? 0 : 18
      const flavorPenaltyPts = flavorPresent ? 0 : 12
      const weightPenaltyPts = (requiredWeightTokens.length > 0 && keyWeightTokens.length === 0) ? 10 : 0
      const fuzzyBonusPts = (fuzzyOverlap - overlap) * 4

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
          score: 250 + (ratio * 100) + (overlap * 2) + aliasBoost + pathBoost + prefixBoost + exactishBoost + fuzzyBonusPts - brandPenaltyPts - flavorPenaltyPts - weightPenaltyPts,
          ratio,
          overlap,
          reason: 'Match interno forte por nome, metadata e sinais do produto',
          kind: 'strict',
          alias: alias || undefined
        }
      } else if (queryTokens.length >= 3) {
        const relaxedMinRatio = opts.strictOnly ? 0.65 : 0.45
        if (ratio >= relaxedMinRatio && overlap >= 1) {
          const aliasBoost = aliasOverlap > 0 ? ((aliasOverlap / Math.max(1, queryTokens.length)) * 14) : 0
          const pathBoost = pathOverlap > 0 ? Math.min(8, pathOverlap * 1.1) : 0
          const prefixBoost = key.startsWith('uploads/') ? 5 : (key.startsWith('imagens/') ? 2 : 0)
          candidate = {
            key,
            score: 150 + (ratio * 100) + (overlap * 1.8) + aliasBoost + pathBoost + prefixBoost + fuzzyBonusPts - brandPenaltyPts - flavorPenaltyPts - weightPenaltyPts,
            ratio,
            overlap,
            reason: 'Match interno plausível; precisa de confirmação visual',
            kind: 'relaxed',
            alias: alias || undefined
          }
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
