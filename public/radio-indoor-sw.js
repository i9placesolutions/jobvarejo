/* Cache local da Rádio Indoor. Só intercepta o proxy autenticado do próprio
 * JobVarejo; URLs públicas e o editor de artes permanecem fora deste cache. */
const CACHE_NAME = 'jobvarejo-radio-indoor-v1'
const AUDIO_PATH = '/api/radio-indoor/audio'
const MEDIA_PATH = '/api/radio-indoor/media'
const MAX_ENTRIES = 20

const canonicalKey = (request) => {
  const url = new URL(request.url)
  url.searchParams.delete('cache')
  url.searchParams.delete('t')
  return url.toString()
}

const trimCache = async (cache) => {
  const keys = await cache.keys()
  if (keys.length <= MAX_ENTRIES) return
  for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) await cache.delete(key)
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || (!url.pathname.startsWith(AUDIO_PATH) && !url.pathname.startsWith(MEDIA_PATH))) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const key = canonicalKey(request)
    try {
      const response = await fetch(request)
      if (response.ok || response.type === 'opaque') {
        await cache.put(key, response.clone())
        await trimCache(cache)
      }
      return response
    } catch {
      const cached = await cache.match(key)
      if (cached) return cached
      // A range request may not have an exact cache key. Reuse the full file
      // prefetched by the player when the browser is offline.
      const candidates = await cache.keys()
      const fallback = candidates.find((candidate) => canonicalKey(candidate).split('?')[0] === key.split('?')[0])
      if (fallback) return cache.match(fallback)
      return new Response('Rádio Indoor offline: faixa não armazenada', { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  })())
})
