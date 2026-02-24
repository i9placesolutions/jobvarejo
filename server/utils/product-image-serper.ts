import { assertSafeExternalHttpUrl } from './url-safety'

export type SerperImageCandidate = {
  url: string
  title?: string
  source?: string
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

const buildQueryTokens = (query: string): string[] => {
  const tokens = normalizeText(query).split(' ').filter(Boolean)
  return [...new Set(tokens.filter((token) => token.length >= 3))]
}

const scoreByQueryRelevance = (entry: { title?: string; source?: string; url: string }, queryTokens: string[]): number => {
  const haystack = normalizeText([entry.title, entry.source, entry.url].filter(Boolean).join(' '))
  let score = 0
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1.5
  }
  if (/(embalagem|pack|produto|lata|garrafa|caixa|frasco|sache)/i.test(haystack)) score += 2
  if (/(logo|vetor|vector|icone|icon|clipart|mockup|banner|wallpaper)/i.test(haystack)) score -= 4
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
      if (!safeUrl || seen.has(safeUrl)) continue
      seen.add(safeUrl)
      rawCandidates.push({
        url: safeUrl,
        title: String(img?.title || '').trim(),
        source: String(img?.source || img?.link || '').trim()
      })
    }

    const candidates = rawCandidates
      .map((entry) => ({
        entry,
        score: scoreByQueryRelevance(entry, queryTokens)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates)
      .map((item) => item.entry)

    return { candidates }
  } catch (err: any) {
    return {
      candidates: [],
      error: { kind: 'network', message: err?.message || String(err) }
    }
  }
}
