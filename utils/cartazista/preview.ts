import type { ArtComposition } from '~/types/art-studio'

const MAX_CONCURRENT_PREVIEWS = 2
const MAX_CACHED_PREVIEWS = 30
let activePreviews = 0
const pendingPreviews: Array<() => void> = []
const cachedPreviews = new Map<string, string>()
const inFlightPreviews = new Map<string, Promise<string>>()

const fingerprint = (composition: ArtComposition): string => JSON.stringify(composition)

const rememberPreview = (key: string, svg: string) => {
  cachedPreviews.delete(key)
  cachedPreviews.set(key, svg)
  if (cachedPreviews.size > MAX_CACHED_PREVIEWS) {
    const oldestKey = cachedPreviews.keys().next().value
    if (oldestKey) cachedPreviews.delete(oldestKey)
  }
}

const drainPreviewQueue = () => {
  while (activePreviews < MAX_CONCURRENT_PREVIEWS && pendingPreviews.length) {
    pendingPreviews.shift()?.()
  }
}

/** Reutiliza prévias idênticas e limita o uso simultâneo do Fabric na galeria. */
export const getCartazistaPreviewSvg = (
  composition: ArtComposition,
  render: (composition: ArtComposition) => Promise<string>
): Promise<string> => {
  const key = fingerprint(composition)
  const cached = cachedPreviews.get(key)
  if (cached) {
    // Refresh insertion order so the cache behaves as a small LRU.
    cachedPreviews.delete(key)
    cachedPreviews.set(key, cached)
    return Promise.resolve(cached)
  }

  const pending = inFlightPreviews.get(key)
  if (pending) return pending

  const task = new Promise<string>((resolve, reject) => {
    pendingPreviews.push(() => {
      activePreviews += 1
      void Promise.resolve()
        .then(() => render(composition))
        .then((svg) => {
          rememberPreview(key, svg)
          resolve(svg)
        })
        .catch(reject)
        .finally(() => {
          activePreviews -= 1
          drainPreviewQueue()
        })
    })
    drainPreviewQueue()
  }).finally(() => {
    if (inFlightPreviews.get(key) === task) inFlightPreviews.delete(key)
  })

  inFlightPreviews.set(key, task)
  return task
}
