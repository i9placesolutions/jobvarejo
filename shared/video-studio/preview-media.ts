/** Mantém a imagem completa na memória durante todos os loops do Player. */
export function createPreviewImageCache(decode = async (url: string) => {
  const image = new Image()
  image.src = url
  await image.decode()
}) {
  type Entry = { promise: Promise<string>; controller: AbortController; url?: string }
  const entries = new Map<string, Entry>()
  let disposed = false
  const release = (entry: Entry) => {
    entry.controller.abort()
    if (entry.url) { URL.revokeObjectURL(entry.url); entry.url = undefined }
  }
  return {
    // A composição nova conserva mídia compartilhada e cancela downloads obsoletos.
    retain(sources: Iterable<string>) {
      const keep = new Set(sources)
      for (const [src, entry] of entries) if (!keep.has(src)) {
        entries.delete(src)
        release(entry)
      }
    },
    get(src: string) {
      if (disposed) return Promise.reject(new Error('Prévia encerrada.'))
      let entry = entries.get(src)
      if (!entry) {
        entry = { controller: new AbortController(), promise: undefined! }
        const current = entry
        entries.set(src, current)
        current.promise = (async () => {
          const response = await fetch(src.startsWith('/api/videos/assets/') ? src + (src.includes('?') ? '&' : '?') + 'preview=1' : src, {signal: current.controller.signal})
          if (!response.ok) throw new Error('Não foi possível carregar uma imagem do vídeo.')
          const blob = await response.blob()
          if (!blob.type.startsWith('image/')) throw new Error('O arquivo não é uma imagem válida.')
          if (disposed || current.controller.signal.aborted) throw new Error('Prévia encerrada.')
          const url = URL.createObjectURL(blob)
          current.url = url
          await decode(url)
          if (disposed || current.controller.signal.aborted) throw new Error('Prévia encerrada.')
          return url
        })().catch(error => {
          if (entries.get(src) === current) entries.delete(src)
          release(current)
          throw error
        })
      }
      return entry.promise
    },
    dispose() {
      disposed = true
      for (const entry of entries.values()) release(entry)
      entries.clear()
    },
  }
}
