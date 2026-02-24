import { assertSafeExternalHttpUrl } from './url-safety'

export type SerperImageCandidate = {
  url: string
  title?: string
  source?: string
  domain?: string
  imageWidth?: number
  imageHeight?: number
  score?: number
}

type SerperSearchError =
  | { kind: 'http'; status: number; statusText?: string; body?: string }
  | { kind: 'invalid_response'; message?: string }
  | { kind: 'network'; message?: string }

export type SerperSearchResult = {
  candidates: SerperImageCandidate[]
  error?: SerperSearchError
}

const normalizeText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)

const QUERY_NOISE_TOKENS = new Set([
  'embalagem',
  'produto',
  'frente',
  'foto',
  'supermercado',
  'original',
  'imagem',
  'imagens',
  'pack',
  'pacote',
  'lata',
  'garrafa',
  'caixa',
  'frasco'
])

const buildQueryTokens = (query: string): string[] => {
  const tokens = tokenize(query)
    .filter((token) => token.length >= 3)
    .filter((token) => !QUERY_NOISE_TOKENS.has(token))
  return [...new Set(tokens)]
}

const PRODUCT_HINTS_RE = /(produto|embalagem|pack|lata|garrafa|caixa|frasco|sache|display|packshot|frente)/i
const BAD_HINTS_RE = /(logo|vetor|vector|icone|icon|clipart|mockup|banner|wallpaper|papel parede|sticker|figura|figurinha|svg|eps|cdr|psd)/i
const BAD_DOMAIN_RE = /(pinterest|pinimg|freepik|wikimedia|wikipedia|shutterstock|depositphotos|istockphoto|vectorstock)/i

const normalizeUrlForDedup = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl)
    parsed.hash = ''
    parsed.search = ''
    const host = parsed.host.toLowerCase()
    const pathname = decodeURIComponent(parsed.pathname || '/').replace(/\/+/g, '/')
    return `${parsed.protocol}//${host}${pathname}`
  } catch {
    return rawUrl.split('?')[0] || rawUrl
  }
}

const extractDomain = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const scoreByQueryRelevance = (
  entry: { title?: string; source?: string; domain?: string; url: string; imageWidth?: number; imageHeight?: number },
  queryTokens: string[]
): number => {
  const titleText = normalizeText(entry.title || '')
  const sourceText = normalizeText(entry.source || '')
  const urlText = normalizeText(entry.url || '')
  const domainText = normalizeText(entry.domain || '')
  const haystack = [titleText, sourceText, urlText, domainText].filter(Boolean).join(' ')
  let score = 0

  let totalTokenHits = 0
  for (const token of queryTokens) {
    if (titleText.includes(token)) {
      score += 3
      totalTokenHits++
      continue
    }
    if (sourceText.includes(token)) {
      score += 2
      totalTokenHits++
      continue
    }
    if (urlText.includes(token) || domainText.includes(token)) {
      score += 1.4
      totalTokenHits++
    }
  }

  if (PRODUCT_HINTS_RE.test(haystack)) score += 3
  if (BAD_HINTS_RE.test(haystack)) score -= 10
  if (BAD_DOMAIN_RE.test(entry.domain || '')) score -= 5
  if (/thumb|thumbnail|sprite|avatar|icon/i.test(entry.url)) score -= 4
  if (/\.(svg|eps|pdf)(?:$|\?)/i.test(entry.url)) score -= 8

  const width = Number(entry.imageWidth || 0)
  const height = Number(entry.imageHeight || 0)
  if (width > 0 && height > 0) {
    const minSide = Math.min(width, height)
    const maxSide = Math.max(width, height)
    const area = width * height
    const aspect = maxSide / Math.max(1, minSide)

    if (minSide >= 280) score += 2.2
    else if (minSide < 120) score -= 4.5
    if (area >= 250_000) score += 1.2
    if (aspect > 3.8) score -= 3.2
  }

  if (queryTokens.length > 0) {
    const coverage = totalTokenHits / queryTokens.length
    if (coverage >= 0.8) score += 2
    else if (coverage >= 0.5) score += 1
    else if (coverage <= 0.2) score -= 2
  }

  return score
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

export const searchSerperImageCandidates = async (opts: {
  apiKey: string
  query: string
  gl?: string
  hl?: string
  num?: number
  maxCandidates?: number
  timeoutMs?: number
}): Promise<SerperSearchResult> => {
  const apiKey = String(opts.apiKey || '').trim()
  const query = String(opts.query || '').trim()
  if (!apiKey || !query) return { candidates: [] }

  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(1000, Number(opts.timeoutMs)) : 12_000
  const maxCandidates = Number.isFinite(opts.maxCandidates) ? Math.max(1, Math.min(10, Number(opts.maxCandidates))) : 5
  const queryTokens = buildQueryTokens(query)

  try {
    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      signal: getTimeoutSignal(timeoutMs),
      body: JSON.stringify({
        q: query,
        gl: String(opts.gl || 'br'),
        hl: String(opts.hl || 'pt-br'),
        num: Number.isFinite(opts.num) ? Number(opts.num) : 10
      })
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

    const images = Array.isArray(result?.images) ? result.images : []
    if (images.length === 0) return { candidates: [] }

    const seen = new Set<string>()
    const rawCandidates: SerperImageCandidate[] = []
    for (const img of images) {
      const safeUrl = normalizeSafeExternalCandidateUrl(String(img?.imageUrl || '').trim())
      if (!safeUrl) continue
      const dedupeKey = normalizeUrlForDedup(safeUrl)
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      const imageWidth = Number(img?.imageWidth || img?.image_width || img?.width || 0)
      const imageHeight = Number(img?.imageHeight || img?.image_height || img?.height || 0)
      rawCandidates.push({
        url: safeUrl,
        title: String(img?.title || '').trim(),
        source: String(img?.source || img?.link || '').trim(),
        domain: String(img?.domain || extractDomain(safeUrl) || '').trim().toLowerCase(),
        imageWidth: Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : undefined,
        imageHeight: Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : undefined
      })
    }

    const ranked = rawCandidates
      .map((entry) => ({
        entry,
        score: scoreByQueryRelevance(entry, queryTokens)
      }))
      .sort((a, b) => b.score - a.score)

    const minAcceptedScore = queryTokens.length >= 4 ? 2.8 : 1.6
    const filtered = ranked.filter((item) => item.score >= minAcceptedScore)
    const selected = (filtered.length > 0 ? filtered : ranked)
      .slice(0, maxCandidates)
      .map((item) => ({ ...item.entry, score: Number(item.score.toFixed(3)) }))

    return { candidates: selected }
  } catch (err: any) {
    return {
      candidates: [],
      error: { kind: 'network', message: err?.message || String(err) }
    }
  }
}
