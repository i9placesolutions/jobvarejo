/* Cache do kiosk da Rádio Indoor. Mídias com tokens diferentes ficam isoladas. */
const CACHE_NAME = 'jobvarejo-radio-indoor-v2'
const AUDIO_PATH = '/api/radio-indoor/audio'
const MEDIA_PATH = '/api/radio-indoor/media'
const MAX_ENTRIES = 20
const MAX_OFFLINE_AGE_MS = 45 * 60 * 1000

const canonicalKey = async (request) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('playerToken') || url.searchParams.get('token')
  if (!token) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const scope = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  url.searchParams.delete('cache')
  url.searchParams.delete('t')
  url.searchParams.delete('playerToken')
  url.searchParams.delete('token')
  url.searchParams.set('playerScope', scope)
  return url.toString()
}

const trimCache = async (cache) => {
  const keys = await cache.keys()
  if (keys.length <= MAX_ENTRIES) return
  for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) await cache.delete(key)
}

self.addEventListener('install', () => self.skipWaiting())
const cachedRange = async (response, header) => {
  if (!header) return response
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return response
  const buffer = await response.arrayBuffer()
  const size = buffer.byteLength
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[2] && match[1] ? Math.min(size - 1, Number(match[2])) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  const headers = new Headers(response.headers)
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  headers.set('Accept-Ranges', 'bytes')
  return new Response(buffer.slice(start, end + 1), { status: 206, headers })
}

self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const names = await caches.keys()
  await Promise.all(names.filter((name) => name.startsWith('jobvarejo-radio-indoor-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
  await self.clients.claim()
})()))

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || ![AUDIO_PATH, MEDIA_PATH].includes(url.pathname)) return

  event.respondWith((async () => {
    const key = await canonicalKey(request)
    const cache = key ? await caches.open(CACHE_NAME) : null
    try {
      const response = await fetch(request)
      // Cache.put rejeita respostas parciais (206). O prefetch pede o arquivo
      // completo com cache=1; falha de cache não interrompe o áudio online.
      if (cache && response.status === 200 && (url.searchParams.has('cache') || url.pathname === MEDIA_PATH)) {
        try {
          const copy = response.clone()
          const headers = new Headers(copy.headers)
          headers.set('X-Radio-Cached-At', String(Date.now()))
          await cache.put(key, new Response(copy.body, { status: 200, headers }))
          await trimCache(cache)
        } catch { /* cache indisponível */ }
      }
      return response
    } catch {
      const cached = cache && key ? await cache.match(key) : null
      const cachedAt = Number(cached?.headers.get('X-Radio-Cached-At') || 0)
      if (cached && cachedAt > 0 && Date.now() - cachedAt <= MAX_OFFLINE_AGE_MS) {
        return cachedRange(cached, request.headers.get('Range'))
      }
      if (cached && cache && key) await cache.delete(key)
      return new Response('Rádio Indoor offline: faixa não armazenada', { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  })())
})
