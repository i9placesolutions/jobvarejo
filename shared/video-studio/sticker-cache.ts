/** Compartilha a preparação entre a abertura, fechamento e loops do Player. */
export function createStickerLogoCache(render: (src: string) => Promise<string>, limit = 8) {
  const entries = new Map<string, Promise<string>>()
  return (src: string): Promise<string> => {
    const hit = entries.get(src)
    if (hit) {
      entries.delete(src); entries.set(src, hit)
      return hit
    }
    const task = Promise.resolve().then(() => render(src)).catch(error => {
      if (entries.get(src) === task) entries.delete(src)
      throw error
    })
    entries.set(src, task)
    while (entries.size > Math.max(1, limit)) entries.delete(entries.keys().next().value!)
    return task
  }
}
