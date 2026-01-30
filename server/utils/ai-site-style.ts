type SiteStyleResult = {
  url: string
  title?: string
  description?: string
  styleNotes?: string
  ogImage?: string
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
  const u = String(url || '').trim()
  if (!u) throw new Error('url required')

  const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (AI Style Fetcher)' } })
  if (!res.ok) throw new Error(`Failed to fetch site: ${res.status}`)
  const html = await res.text()

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
  const data: any = await r.json()
  const styleNotes = String(data?.choices?.[0]?.message?.content || '').trim() || undefined

  return { url: u, title, description, styleNotes, ogImage: ogImageUrl }
}
