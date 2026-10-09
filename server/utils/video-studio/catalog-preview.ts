import sharp from 'sharp'

export const CATALOG_PREVIEW_VERSION = 'webp-1280-v1'

// Apenas arquivos públicos do manifesto entram neste cache. Dois trabalhos por
// vez limitam os buffers originais e o custo de decodificação durante a galeria.
export function createCatalogPreviewCache(maxBytes = 32 * 1024 * 1024) {
  const ready = new Map<string, Buffer>()
  const pending = new Map<string, Promise<Buffer>>()
  const waiting: Array<() => void> = []
  let bytes = 0, active = 0
  async function run(load: () => Promise<Buffer>) {
    if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve))
    else active++
    try {
      return await sharp(await load(), { limitInputPixels: 24_000_000, animated: false })
        .rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 3 }).toBuffer()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
  return (hash: string, load: () => Promise<Buffer>): Promise<Buffer> => {
    const hit = ready.get(hash)
    if (hit) {
      ready.delete(hash); ready.set(hash, hit)
      return Promise.resolve(hit)
    }
    const existing = pending.get(hash)
    if (existing) return existing
    if (pending.size >= 64) return Promise.reject(new Error('Fila de prévias ocupada.'))
    const task = run(load).then(result => {
      if (result.length <= maxBytes) {
        while (bytes + result.length > maxBytes && ready.size) {
          const oldest = ready.keys().next().value!
          bytes -= ready.get(oldest)!.length; ready.delete(oldest)
        }
        ready.set(hash, result); bytes += result.length
      }
      return result
    }).finally(() => pending.delete(hash))
    pending.set(hash, task)
    return task
  }
}

export const catalogPreview = createCatalogPreviewCache()
