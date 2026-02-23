import { assertSafeExternalHttpUrl } from './url-safety'

export type GoogleCseImageCandidate = {
  url: string
  title?: string
  source?: string
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
        source: String(item?.image?.contextLink || item?.displayLink || '').trim()
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
