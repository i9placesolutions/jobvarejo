import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type MaybeGetter<T> = T | (() => T)

type ProgressivePreviewLoaderOptions<T> = {
  getItems: () => T[]
  getId: (item: T) => string
  getSrc: (item: T) => string
  enabled?: () => boolean
  immediateCount?: MaybeGetter<number>
  batchSize?: MaybeGetter<number>
  rootMargin?: MaybeGetter<string>
  threshold?: MaybeGetter<number>
  hydrateVisibleOnly?: MaybeGetter<boolean>
  maxVisibleHydrated?: MaybeGetter<number | null>
}

export const useProgressivePreviewLoader = <T>(opts: ProgressivePreviewLoaderOptions<T>) => {
  const rootEl = ref<HTMLElement | null>(null)
  const hydratedIds = ref<Record<string, boolean>>({})
  const visibleIds = ref<Record<string, boolean>>({})

  const hostMap = new Map<string, Element>()
  const visibilityMeta = new Map<string, { ratio: number; top: number }>()
  const pendingIds: string[] = []
  const pendingSet = new Set<string>()
  const prioritySet = new Set<string>()
  let observer: IntersectionObserver | null = null
  let hydrationTimer: ReturnType<typeof setTimeout> | null = null
  let hydrationIdleId: number | null = null

  const resolveOpt = <V>(value: MaybeGetter<V> | undefined): V | undefined => (
    typeof value === 'function'
      ? (value as (() => V))()
      : value
  )
  const isEnabled = () => opts.enabled ? opts.enabled() !== false : true
  const resolveItems = (): T[] => Array.isArray(opts.getItems?.()) ? opts.getItems() : []
  const getImmediateCount = () => Math.max(0, Math.floor(Number(resolveOpt(opts.immediateCount) ?? 0) || 0))
  const getBatchSize = () => Math.max(1, Math.floor(Number(resolveOpt(opts.batchSize) ?? 2) || 2))
  const shouldHydrateVisibleOnly = () => resolveOpt(opts.hydrateVisibleOnly) === true
  const getMaxVisibleHydrated = () => {
    const rawValue = resolveOpt(opts.maxVisibleHydrated)
    if (rawValue == null) return null
    const raw = Number(rawValue)
    if (!Number.isFinite(raw) || raw <= 0) return null
    return Math.max(1, Math.floor(raw))
  }
  const normalizeId = (value: string) => String(value || '').trim()
  const getImmediateIdSet = (): Set<string> => new Set(getEligibleImmediateIds())

  const clearHydrationSchedule = () => {
    if (hydrationTimer) {
      clearTimeout(hydrationTimer)
      hydrationTimer = null
    }
    if (hydrationIdleId !== null && typeof window !== 'undefined') {
      const cancelIdle = (window as any)?.cancelIdleCallback
      if (typeof cancelIdle === 'function') cancelIdle(hydrationIdleId)
      hydrationIdleId = null
    }
  }

  const getEligibleImmediateIds = (): string[] => {
    const items = resolveItems()
    const immediateCount = getImmediateCount()
    if (!items.length || immediateCount <= 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length && ids.length < immediateCount; i++) {
      const item = items[i] as T
      const id = normalizeId(opts.getId(item))
      const src = String(opts.getSrc(item) || '').trim()
      if (!id || !src) continue
      ids.push(id)
    }
    return ids
  }

  const markHydrated = (id: string) => {
    const normalizedId = normalizeId(id)
    if (!normalizedId) return
    hydratedIds.value[normalizedId] = true
    pendingSet.delete(normalizedId)
    prioritySet.delete(normalizedId)
    const queuedIndex = pendingIds.indexOf(normalizedId)
    if (queuedIndex >= 0) pendingIds.splice(queuedIndex, 1)
  }

  const pruneState = () => {
    const validIds = new Set(resolveItems().map((item) => normalizeId(opts.getId(item))).filter(Boolean))
    for (const id of Object.keys(hydratedIds.value)) {
      if (!validIds.has(id)) delete hydratedIds.value[id]
    }
    for (const id of Object.keys(visibleIds.value)) {
      if (!validIds.has(id)) delete visibleIds.value[id]
    }
    visibilityMeta.forEach((_value, id) => {
      if (!validIds.has(id)) visibilityMeta.delete(id)
    })
    for (let i = pendingIds.length - 1; i >= 0; i--) {
      const id = normalizeId(pendingIds[i] || '')
      if (validIds.has(id)) continue
      pendingSet.delete(id)
      prioritySet.delete(id)
      pendingIds.splice(i, 1)
    }
  }

  const primeImmediate = () => {
    getEligibleImmediateIds().forEach((id) => markHydrated(id))
  }

  const countHydratedVisible = (): number => {
    const immediateIds = getImmediateIdSet()
    let total = 0
    for (const [id, isVisible] of Object.entries(visibleIds.value)) {
      if (!isVisible) continue
      if (immediateIds.has(id)) continue
      if (!hydratedIds.value[id]) continue
      total += 1
    }
    return total
  }

  const compareIdsByViewportPriority = (
    left: string,
    right: string,
    fallbackOrder?: Map<string, number>
  ): number => {
    const leftPriority = prioritySet.has(left)
    const rightPriority = prioritySet.has(right)
    if (leftPriority !== rightPriority) return leftPriority ? -1 : 1

    const leftVisible = !!visibleIds.value[left]
    const rightVisible = !!visibleIds.value[right]
    if (leftVisible !== rightVisible) return leftVisible ? -1 : 1

    const leftMeta = visibilityMeta.get(left)
    const rightMeta = visibilityMeta.get(right)
    if (leftVisible && rightVisible && leftMeta && rightMeta) {
      if (leftMeta.top !== rightMeta.top) return leftMeta.top - rightMeta.top
      if (leftMeta.ratio !== rightMeta.ratio) return rightMeta.ratio - leftMeta.ratio
    }

    if (fallbackOrder) {
      return (fallbackOrder.get(left) ?? 0) - (fallbackOrder.get(right) ?? 0)
    }

    return left.localeCompare(right)
  }

  const sortPendingByViewportPriority = () => {
    if (pendingIds.length <= 1) return
    const originalIndex = new Map<string, number>()
    pendingIds.forEach((id, index) => originalIndex.set(id, index))
    pendingIds.sort((left, right) => compareIdsByViewportPriority(left, right, originalIndex))
  }

  const getRenderableHydratedIdSet = (): Set<string> => {
    const immediateIds = getImmediateIdSet()
    const renderable = new Set<string>(immediateIds)
    const candidates = Object.keys(hydratedIds.value)
      .filter((id) => hydratedIds.value[id])
      .filter((id) => !immediateIds.has(id))
      .filter((id) => {
        if (!shouldHydrateVisibleOnly()) return true
        return !!visibleIds.value[id] || prioritySet.has(id)
      })
      .sort((left, right) => compareIdsByViewportPriority(left, right))

    const maxVisibleHydrated = getMaxVisibleHydrated()
    const limitedCandidates = maxVisibleHydrated == null
      ? candidates
      : candidates.slice(0, maxVisibleHydrated)

    limitedCandidates.forEach((id) => renderable.add(id))
    return renderable
  }

  const canHydrateNext = (id: string): boolean => {
    const normalizedId = normalizeId(id)
    if (!normalizedId) return false
    if (hydratedIds.value[normalizedId]) return false

    const isPriority = prioritySet.has(normalizedId)
    if (isPriority) return true

    if (shouldHydrateVisibleOnly() && !visibleIds.value[normalizedId] && !getImmediateIdSet().has(normalizedId)) {
      return false
    }

    const maxVisibleHydrated = getMaxVisibleHydrated()
    if (maxVisibleHydrated != null && visibleIds.value[normalizedId]) {
      if (countHydratedVisible() >= maxVisibleHydrated) return false
    }

    return true
  }

  const dequeueHydratableId = (): string | null => {
    sortPendingByViewportPriority()
    for (let index = 0; index < pendingIds.length; index++) {
      const candidateId = normalizeId(pendingIds[index] || '')
      if (!candidateId) {
        pendingIds.splice(index, 1)
        index -= 1
        continue
      }
      if (hydratedIds.value[candidateId]) {
        pendingIds.splice(index, 1)
        pendingSet.delete(candidateId)
        prioritySet.delete(candidateId)
        index -= 1
        continue
      }
      if (!canHydrateNext(candidateId)) continue
      pendingIds.splice(index, 1)
      pendingSet.delete(candidateId)
      prioritySet.delete(candidateId)
      return candidateId
    }
    return null
  }

  const schedulePump = (delayMs = 180) => {
    if (typeof window === 'undefined') return
    if (!isEnabled()) return
    if (hydrationTimer || hydrationIdleId !== null) return

    hydrationTimer = setTimeout(() => {
      hydrationTimer = null

      const run = () => {
        hydrationIdleId = null
        if (!isEnabled()) return
        primeImmediate()

        let processed = 0
        const batchSize = getBatchSize()
        while (processed < batchSize && pendingIds.length > 0) {
          const nextId = dequeueHydratableId()
          if (!nextId) break
          hydratedIds.value[nextId] = true
          processed += 1
        }

        if (pendingIds.length > 0) {
          schedulePump(220)
        }
      }

      const requestIdle = (window as any)?.requestIdleCallback
      if (typeof requestIdle === 'function') {
        hydrationIdleId = requestIdle(() => run(), { timeout: 220 })
        return
      }
      run()
    }, Math.max(0, Number(delayMs) || 0))
  }

  const enqueue = (id: string, priority = false) => {
    const normalizedId = normalizeId(id)
    if (!normalizedId || hydratedIds.value[normalizedId]) return
    if (pendingSet.has(normalizedId)) {
      if (!priority) return
      prioritySet.add(normalizedId)
      const idx = pendingIds.indexOf(normalizedId)
      if (idx >= 0) pendingIds.splice(idx, 1)
      pendingIds.unshift(normalizedId)
      schedulePump(40)
      return
    }
    pendingSet.add(normalizedId)
    if (priority) prioritySet.add(normalizedId)
    if (priority) pendingIds.unshift(normalizedId)
    else pendingIds.push(normalizedId)
    schedulePump(priority ? 40 : 180)
  }

  const shouldShowPreview = (item: T, index: number): boolean => {
    const id = normalizeId(opts.getId(item))
    const src = String(opts.getSrc(item) || '').trim()
    if (!id || !src) return false
    return index < getImmediateCount() || getRenderableHydratedIdSet().has(id)
  }

  const getPreviewSrc = (item: T, index: number): string => (
    shouldShowPreview(item, index) ? String(opts.getSrc(item) || '').trim() : ''
  )

  const promote = (item: T, index: number) => {
    const id = normalizeId(opts.getId(item))
    const src = String(opts.getSrc(item) || '').trim()
    if (!id || !src) return
    if (index < getImmediateCount()) {
      markHydrated(id)
      return
    }
    enqueue(id, true)
  }

  const setHost = (id: string, el: Element | null) => {
    const normalizedId = normalizeId(id)
    if (!normalizedId) return
    if (el) {
      hostMap.set(normalizedId, el)
      if (observer && isEnabled()) observer.observe(el)
      return
    }
    const prev = hostMap.get(normalizedId)
    if (prev && observer) observer.unobserve(prev)
    hostMap.delete(normalizedId)
  }

  const refreshObserver = async () => {
    if (typeof window === 'undefined') return
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (!isEnabled()) return

    await nextTick()
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement
        const id = normalizeId(String(el?.dataset?.previewId || ''))
        if (!id) return
        visibleIds.value[id] = entry.isIntersecting
        if (entry.isIntersecting) {
          visibilityMeta.set(id, {
            ratio: Number(entry.intersectionRatio || 0),
            top: Number(entry.boundingClientRect?.top || 0)
          })
          enqueue(id, false)
          return
        }
        visibilityMeta.delete(id)
      })
    }, {
      root: rootEl.value || null,
      rootMargin: String(resolveOpt(opts.rootMargin) ?? '96px'),
      threshold: Number(resolveOpt(opts.threshold) ?? 0.2)
    })

    hostMap.forEach((el) => {
      observer?.observe(el)
    })
  }

  watch(
    () => {
      const items = resolveItems()
      return [
        isEnabled() ? '1' : '0',
        String(getImmediateCount()),
        String(getBatchSize()),
        String(resolveOpt(opts.rootMargin) ?? '96px'),
        String(resolveOpt(opts.threshold) ?? 0.2),
        shouldHydrateVisibleOnly() ? 'visible' : 'all',
        String(getMaxVisibleHydrated() ?? 'none'),
        String(items.length),
        ...items.map((item) => {
          const id = normalizeId(opts.getId(item))
          const src = String(opts.getSrc(item) || '').trim()
          return `${id}:${src.length}`
        })
      ].join('|')
    },
    async () => {
      pruneState()
      primeImmediate()
      await refreshObserver()
      schedulePump(180)
    },
    { immediate: true }
  )

  onMounted(() => {
    primeImmediate()
    void refreshObserver()
    schedulePump(180)
  })

  onBeforeUnmount(() => {
    clearHydrationSchedule()
    visibilityMeta.clear()
    prioritySet.clear()
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  return {
    rootEl,
    hydratedIds,
    visibleIds,
    shouldShowPreview,
    getPreviewSrc,
    promotePreview: promote,
    setPreviewHost: setHost,
    refreshPreviewObserver: refreshObserver
  }
}
