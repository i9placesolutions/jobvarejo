export interface LazyPreviewTarget<T> {
  id: string
  element: Element
  resolve: () => T | undefined
}

export interface LazyPreviewQueueOptions<T, R> {
  render: (item: T) => Promise<R>
  publish: (item: T, result: R) => void
  isCurrent: (item: T) => boolean
  getId: (item: T) => string
  getRevision: (item: T) => string | number
  concurrency?: number
  rootMargin?: string
  onError?: (item: T, error: unknown) => void
}

/** Limits catalog preview work and starts it only when its card approaches the viewport. */
export const createLazyCatalogPreviewQueue = <T, R>(options: LazyPreviewQueueOptions<T, R>) => {
  const concurrency = Math.max(1, options.concurrency ?? 2)
  const queued = new Map<string, T>()
  const activeIds = new Set<string>()
  const activeItems = new Map<string, T>()
  let activeCount = 0
  let peakConcurrency = 0
  let renderCount = 0
  let disposed = false
  let observer: IntersectionObserver | null = null

  const pump = () => {
    if (disposed) return
    while (activeCount < concurrency) {
      const next = [...queued.entries()].find(([id]) => !activeIds.has(id))
      if (!next) return
      const [id, item] = next
      queued.delete(id)
      activeIds.add(id)
      activeItems.set(id, item)
      activeCount += 1
      peakConcurrency = Math.max(peakConcurrency, activeCount)
      void (async () => {
        try {
          if (!options.isCurrent(item) || disposed) return
          renderCount += 1
          const result = await options.render(item)
          if (!disposed && options.isCurrent(item) && result != null) options.publish(item, result)
        } catch (error) {
          if (!disposed && options.isCurrent(item)) options.onError?.(item, error)
        } finally {
          activeIds.delete(id)
          activeItems.delete(id)
          activeCount -= 1
          pump()
        }
      })()
    }
  }

  const enqueue = (item: T) => {
    if (disposed) return
    const id = options.getId(item)
    if (activeIds.has(id)) {
      const running = activeItems.get(id)
      if (running && options.getRevision(running) === options.getRevision(item)) return
    }
    queued.set(id, item)
    pump()
  }

  const observe = (root: Element | null, targets: LazyPreviewTarget<T>[]) => {
    observer?.disconnect()
    observer = null
    if (disposed || targets.length === 0) return
    if (typeof IntersectionObserver === 'undefined') {
      for (const target of targets) {
        const item = target.resolve()
        if (item !== undefined) enqueue(item)
      }
      return
    }

    const targetByElement = new Map<Element, LazyPreviewTarget<T>>()
    for (const target of targets) targetByElement.set(target.element, target)
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const target = targetByElement.get(entry.target)
        if (!target) continue
        observer?.unobserve(entry.target)
        const item = target.resolve()
        if (item !== undefined) enqueue(item)
      }
    }, { root, rootMargin: options.rootMargin ?? '240px 0px' })
    for (const target of targets) observer.observe(target.element)
  }

  const disconnect = () => {
    observer?.disconnect()
    observer = null
  }

  const dispose = () => {
    disposed = true
    queued.clear()
    disconnect()
  }

  return {
    enqueue,
    observe,
    disconnect,
    dispose,
    getMetrics: () => ({ renderCount, peakConcurrency, queuedCount: queued.size, activeCount })
  }
}
