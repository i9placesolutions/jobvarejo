import { assertSafeExternalHttpUrl } from '~/server/utils/url-safety'

type SiteStyleResult = {
  url: string
  title?: string
  description?: string
  styleNotes?: string
  ogImage?: string
}

const MAX_SITE_HTML_BYTES = 1_500_000
const FETCH_TIMEOUT_MS = 10_000

const getFetchTimeoutSignal = (): AbortSignal | undefined => {
  const timeoutFactory = (AbortSignal as any)?.timeout
  if (typeof timeoutFactory !== 'function') return undefined
  return timeoutFactory(FETCH_TIMEOUT_MS)
}

const readBodyTextWithLimit = async (res: Response, maxBytes: number): Promise<string> => {
  const contentLength = Number.parseInt(String(res.headers.get('content-length') || ''), 10)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Site content is too large')
  }

  if (!res.body?.getReader) {
    const txt = await res.text()
    if (Buffer.byteLength(txt, 'utf8') > maxBytes) throw new Error('Site content is too large')
    return txt
  }

  const reader = res.body.getReader()
  const chunks: Buffer[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value || new Uint8Array())
    total += chunk.length
    if (total > maxBytes) {
      try { await reader.cancel() } catch { /* ignore */ }
      throw new Error('Site content is too large')
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

const stripHtml = (html: string) => {
  // Very lightweight sanitization for prompt context.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractMeta = (html: string) => {
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim()
  const desc =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]?.trim() ||
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]?.trim()
  const ogImage =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]?.trim() ||
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]?.trim()
  return { title, description: desc, ogImage }
}

export const describeSiteStyle = async (url: string): Promise<SiteStyleResult> => {
  const u = assertSafeExternalHttpUrl(url, { maxLength: 2048 })

  const res = await fetch(u, {
    headers: { 'user-agent': 'Mozilla/5.0 (AI Style Fetcher)' },
    signal: getFetchTimeoutSignal()
  })
  if (!res.ok) throw new Error(`Failed to fetch site: ${res.status}`)
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
    throw new Error('Unsupported site content type')
  }
  const html = await readBodyTextWithLimit(res, MAX_SITE_HTML_BYTES)

  const { title, description, ogImage } = extractMeta(html)
  const normalizeUrl = (raw?: string) => {
    const s = String(raw || '').trim()
    if (!s) return undefined
    try {
      return new URL(s, u).toString()
    } catch {
      return s
    }
  }
  const ogImageUrl = normalizeUrl(ogImage)
  const text = stripHtml(html).slice(0, 10000)

  const config = useRuntimeConfig()
  const apiKey = config.openaiApiKey
  if (!apiKey) return { url: u, title, description, ogImage: ogImageUrl }

  const prompt = `Você é um especialista em design. Analise a descrição textual de uma página e devolva um resumo do estilo visual em bullets curtos.
Retorne SOMENTE texto (sem markdown). Foque em: paleta (cores), tipografia, estética (clean, bold, minimal, etc), vibe (premium, varejo, neon), e elementos comuns.

URL: ${u}
TITLE: ${title || ''}
DESCRIPTION: ${description || ''}
EXCERPT: ${text}`

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Responda em português.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    })
  })
  if (!r.ok) {
    return { url: u, title, description, ogImage: ogImageUrl }
  }

  let data: any = null
  try {
    data = await r.json()
  } catch {
    return { url: u, title, description, ogImage: ogImageUrl }
  }

  if (data?.error) {
    return { url: u, title, description, ogImage: ogImageUrl }
  }

  const styleNotesRaw = String(data?.choices?.[0]?.message?.content || '').trim()
  const styleNotes = styleNotesRaw ? styleNotesRaw.slice(0, 2000) : undefined

  return { url: u, title, description, styleNotes, ogImage: ogImageUrl }
}
