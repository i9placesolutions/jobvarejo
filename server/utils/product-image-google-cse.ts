import { assertSafeExternalHttpUrl } from './url-safety'

export type GoogleCseImageCandidate = {
  url: string
  title?: string
  source?: string
  imageWidth?: number
  imageHeight?: number
}

export type RankedGoogleCseImageCandidate = GoogleCseImageCandidate & {
  domain?: string
  score: number
  confidence: number
  reason: string
  recommended?: boolean
}

type GoogleCseSearchError =
  | { kind: 'http'; status: number; statusText?: string; body?: string }
  | { kind: 'invalid_response'; message?: string }
  | { kind: 'network'; message?: string }

export type GoogleCseSearchResult = {
  candidates: GoogleCseImageCandidate[]
  error?: GoogleCseSearchError
}

const getTimeoutSignal = (timeoutMs: number): AbortSignal | undefined => {
  const timeoutFactory = (AbortSignal as any)?.timeout
  if (typeof timeoutFactory !== 'function') return undefined
  return timeoutFactory(timeoutMs)
}

const normalizeSafeExternalCandidateUrl = (rawUrl: string): string | null => {
  try {
    return assertSafeExternalHttpUrl(rawUrl, { maxLength: 2048 })
  } catch {
    return null
  }
}

const normalizeText = (value: string): string => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const tokenize = (value: string): string[] => normalizeText(value)
  .split(' ')
  .filter(token => token.length >= 3)

const QUERY_NOISE_TOKENS = new Set([
  'produto', 'produtos', 'imagem', 'imagens', 'foto', 'fotos', 'embalagem',
  'embalagens', 'frente', 'packshot', 'supermercado', 'original', 'lata',
  'garrafa', 'caixa', 'frasco', 'pacote'
])

const BAD_HINTS_RE = /(logo|vetor|vector|icone|icon|clipart|mockup|banner|wallpaper|papel parede|sticker|figurinha|svg|eps|cdr|psd|adesivo)/i
const BAD_DOMAIN_RE = /(pinterest|pinimg|freepik|wikimedia|wikipedia|shutterstock|depositphotos|istockphoto|vectorstock)/i

const extractDomain = (value: string): string => {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const normalizeCandidateText = (candidate: GoogleCseImageCandidate): string => [
  candidate.title,
  candidate.source,
  candidate.url,
  extractDomain(candidate.source || ''),
  extractDomain(candidate.url)
].filter(Boolean).join(' ')

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * Classifica resultados do Google antes de qualquer download. O worker e a
 * API usam a mesma regra: o storage interno já foi tentado antes, e só uma
 * sugestão que parece ser o produto pedido pode seguir para o Wasabi.
 */
export const rankGoogleCseImageCandidates = (
  candidates: GoogleCseImageCandidate[],
  opts: { query: string; brand?: string; flavor?: string; weight?: string; productCode?: string }
): RankedGoogleCseImageCandidate[] => {
  const queryTokens = [...new Set([
    ...tokenize(opts.query),
    ...tokenize(opts.brand || ''),
    ...tokenize(opts.flavor || ''),
    ...tokenize(opts.weight || ''),
    ...tokenize(opts.productCode || '')
  ].filter(token => !QUERY_NOISE_TOKENS.has(token)))]
  if (!queryTokens.length) return []

  const ranked = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => {
      const domain = extractDomain(candidate.source || '') || extractDomain(candidate.url)
      const titleText = normalizeText(candidate.title || '')
      const sourceText = normalizeText(candidate.source || '')
      const urlText = normalizeText(candidate.url || '')
      const domainText = normalizeText(domain)
      const haystack = normalizeCandidateText(candidate)
      let score = 0
      let hits = 0

      for (const token of queryTokens) {
        if (titleText.includes(token)) {
          score += 3.4
          hits++
        } else if (sourceText.includes(token)) {
          score += 2.1
          hits++
        } else if (urlText.includes(token) || domainText.includes(token)) {
          score += 1.1
          hits++
        }
      }

      if (/(produto|embalagem|pack|lata|garrafa|caixa|frasco|sache|display)/i.test(haystack)) score += 1.8
      if (BAD_HINTS_RE.test(haystack)) score -= 12
      if (BAD_DOMAIN_RE.test(domain)) score -= 6
      if (/\.(svg|eps|pdf)(?:$|[?#])/i.test(candidate.url)) score -= 10
      if (/thumb|thumbnail|sprite|avatar|favicon|icon/i.test(candidate.url)) score -= 4

      const width = Number(candidate.imageWidth || 0)
      const height = Number(candidate.imageHeight || 0)
      if (width > 0 && height > 0) {
        const minSide = Math.min(width, height)
        const aspect = Math.max(width, height) / Math.max(1, minSide)
        if (minSide >= 280) score += 1.8
        if (minSide < 120) score -= 4
        if (aspect > 4) score -= 3
      }

      const coverage = hits / queryTokens.length
      if (coverage >= 0.8) score += 2.4
      else if (coverage >= 0.5) score += 1.1
      else if (coverage < 0.25) score -= 2.2

      const confidence = clamp(0.42 + (Math.max(0, score) / 20) + (coverage * 0.18), 0, 0.98)
      return {
        ...candidate,
        domain: domain || undefined,
        score: Number(score.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        reason: hits > 0
          ? `${hits}/${queryTokens.length} termos encontrados; resultado filtrado por produto/embalagem`
          : 'Nenhum termo relevante encontrado'
      }
    })
    .filter(candidate => candidate.score > 0 && !!candidate.domain && !BAD_HINTS_RE.test(normalizeCandidateText(candidate)))
    .sort((a, b) => b.score - a.score)

  return ranked.map((candidate, index) => ({ ...candidate, recommended: index === 0 }))
}

export const searchGoogleCseImageCandidates = async (opts: {
  apiKey: string
  cx: string
  query: string
  gl?: string
  hl?: string
  num?: number
  maxCandidates?: number
  timeoutMs?: number
}): Promise<GoogleCseSearchResult> => {
  const apiKey = String(opts.apiKey || '').trim()
  const cx = String(opts.cx || '').trim()
  const query = String(opts.query || '').trim()
  if (!apiKey || !cx || !query) return { candidates: [] }

  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(1000, Number(opts.timeoutMs)) : 12_000
  const maxCandidates = Number.isFinite(opts.maxCandidates) ? Math.max(1, Math.min(10, Number(opts.maxCandidates))) : 5
  const num = Number.isFinite(opts.num) ? Math.max(1, Math.min(10, Number(opts.num))) : 10

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', cx)
    url.searchParams.set('q', query)
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('num', String(num))
    url.searchParams.set('gl', String(opts.gl || 'br'))
    url.searchParams.set('hl', String(opts.hl || 'pt-BR'))
    url.searchParams.set('safe', 'off')

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: getTimeoutSignal(timeoutMs)
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        candidates: [],
        error: {
          kind: 'http',
          status: response.status,
          statusText: response.statusText,
          body: body?.slice?.(0, 600) || undefined
        }
      }
    }

    let result: any = null
    try {
      result = await response.json()
    } catch (err: any) {
      return {
        candidates: [],
        error: { kind: 'invalid_response', message: err?.message || 'Invalid JSON response' }
      }
    }

    const items = Array.isArray(result?.items) ? result.items : []
    if (items.length === 0) return { candidates: [] }

    const seen = new Set<string>()
    const candidates: GoogleCseImageCandidate[] = []
    for (const item of items) {
      if (candidates.length >= maxCandidates) break
      const safeUrl = normalizeSafeExternalCandidateUrl(String(item?.link || '').trim())
      if (!safeUrl || seen.has(safeUrl)) continue
      seen.add(safeUrl)
      candidates.push({
        url: safeUrl,
        title: String(item?.title || '').trim(),
        source: String(item?.image?.contextLink || item?.displayLink || '').trim(),
        imageWidth: Number.isFinite(Number(item?.image?.width)) && Number(item?.image?.width) > 0 ? Number(item.image.width) : undefined,
        imageHeight: Number.isFinite(Number(item?.image?.height)) && Number(item?.image?.height) > 0 ? Number(item.image.height) : undefined
      })
    }

    return { candidates }
  } catch (err: any) {
    return {
      candidates: [],
      error: { kind: 'network', message: err?.message || String(err) }
    }
  }
}
