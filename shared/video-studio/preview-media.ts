/** Mantém a imagem completa na memória durante todos os loops do Player. */
export function createPreviewImageCache(decode = async (url: string) => {
  const image = new Image()
  image.src = url
  await image.decode()
}) {
  const entries = new Map<string, Promise<string>>()
  const urls = new Set<string>()
  const controller = new AbortController()
  let disposed = false
  return {
    get(src: string) {
      let pending = entries.get(src)
      if (!pending) {
        pending = (async () => {
          const response = await fetch(src.startsWith('/api/videos/assets/') ? src + '?preview=1' : src, {signal: controller.signal})
          if (!response.ok) throw new Error('Não foi possível carregar uma imagem do vídeo.')
          const blob = await response.blob()
          if (!blob.type.startsWith('image/')) throw new Error('O arquivo não é uma imagem válida.')
          if (disposed) throw new Error('Prévia encerrada.')
          const url = URL.createObjectURL(blob)
          urls.add(url)
          try { await decode(url) } catch (error) { URL.revokeObjectURL(url); urls.delete(url); throw error }
          if (disposed) throw new Error('Prévia encerrada.')
          return url
        })().catch(error => { entries.delete(src); throw error })
        entries.set(src, pending)
      }
      return pending
    },
    dispose() {
      disposed = true
      controller.abort()
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
      entries.clear()
    },
  }
}
