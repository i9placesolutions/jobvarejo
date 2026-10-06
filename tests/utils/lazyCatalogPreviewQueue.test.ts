import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLazyCatalogPreviewQueue, type LazyPreviewTarget } from '~/utils/lazyCatalogPreviewQueue'

type Item = { id: string; revision: number }

class ControlledIntersectionObserver {
  static instances: ControlledIntersectionObserver[] = []
  readonly observed: Element[] = []
  disconnected = false

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    ControlledIntersectionObserver.instances.push(this)
  }

  observe(target: Element) { this.observed.push(target) }
  unobserve(target: Element) { this.observed.splice(this.observed.indexOf(target), 1) }
  disconnect() { this.disconnected = true }
  enter(target: Element) {
    this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

const installObserver = () => {
  ControlledIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver)
}

afterEach(() => vi.unstubAllGlobals())

describe('lazy catalog preview queue', () => {
  it('renders only the cards intersecting the scroll root plus the configured margin', async () => {
    installObserver()
    const rendered: string[] = []
    const queue = createLazyCatalogPreviewQueue<Item, string>({
      getId: item => item.id,
      getRevision: item => item.revision,
      isCurrent: () => true,
      render: async item => { rendered.push(item.id); return item.id },
      publish: () => undefined
    })
    const root = documentLikeElement()
    const targets: LazyPreviewTarget<Item>[] = Array.from({ length: 100 }, (_, index) => {
      const item = { id: `label-${index}`, revision: 1 }
      return { id: item.id, element: documentLikeElement(), resolve: () => item }
    })

    queue.observe(root, targets)
    const observer = ControlledIntersectionObserver.instances[0]!
    expect(observer.options?.root).toBe(root)
    expect(observer.options?.rootMargin).toBe('240px 0px')
    for (const target of targets.slice(0, 8)) observer.enter(target.element)
    await vi.waitFor(() => expect(rendered).toHaveLength(8))
    expect(queue.getMetrics()).toMatchObject({ renderCount: 8, peakConcurrency: 2 })
    expect(rendered).toHaveLength(8)
    queue.dispose()
  })

  it('shares the two-render limit across failed-image retries and newer revisions', async () => {
    installObserver()
    const revisions = new Map([['a', 1], ['b', 1]])
    const published: string[] = []
    const pending = new Map<string, (value: string) => void>()
    const queue = createLazyCatalogPreviewQueue<Item, string>({
      concurrency: 2,
      getId: item => item.id,
      getRevision: item => item.revision,
      isCurrent: item => revisions.get(item.id) === item.revision,
      render: item => new Promise(resolve => pending.set(`${item.id}:${item.revision}`, resolve)),
      publish: (item, result) => published.push(`${item.id}:${item.revision}:${result}`)
    })

    queue.enqueue({ id: 'a', revision: 1 })
    queue.enqueue({ id: 'a', revision: 1 }) // repeated image error for the in-flight fallback
    revisions.set('a', 2)
    queue.enqueue({ id: 'a', revision: 2 }) // an upsert while revision 1 is rendering
    queue.enqueue({ id: 'b', revision: 1 })
    expect(queue.getMetrics().peakConcurrency).toBe(2)
    pending.get('a:1')?.('old')
    pending.get('b:1')?.('current')
    await vi.waitFor(() => expect(pending.has('a:2')).toBe(true))
    pending.get('a:2')?.('new')
    await vi.waitFor(() => expect(published).toEqual(['b:1:current', 'a:2:new']))
    expect(queue.getMetrics().peakConcurrency).toBeLessThanOrEqual(2)
    expect(queue.getMetrics().renderCount).toBe(3)
    queue.dispose()
  })

  it('does not publish an error from a preview request made stale by a newer revision', async () => {
    const revisions = new Map([['label', 1]])
    const onError = vi.fn()
    let rejectOld: ((error: Error) => void) | undefined
    const queue = createLazyCatalogPreviewQueue<Item, string>({
      getId: item => item.id,
      getRevision: item => item.revision,
      isCurrent: item => revisions.get(item.id) === item.revision,
      render: () => new Promise((_, reject) => { rejectOld = reject }),
      publish: () => undefined,
      onError
    })
    queue.enqueue({ id: 'label', revision: 1 })
    revisions.set('label', 2)
    rejectOld?.(new Error('stale request'))
    await vi.waitFor(() => expect(queue.getMetrics().activeCount).toBe(0))
    expect(onError).not.toHaveBeenCalled()
    queue.dispose()
  })

  it('does not start queued work after disconnect and falls back to all targets without IntersectionObserver', async () => {
    installObserver()
    let resolveFirst: ((value: string) => void) | undefined
    const render = vi.fn((item: Item) => new Promise<string>((resolve) => {
      if (item.id === '0') resolveFirst = resolve
      else resolve(item.id)
    }))
    const publish = vi.fn()
    const queue = createLazyCatalogPreviewQueue<Item, string>({
      concurrency: 1,
      getId: item => item.id,
      getRevision: item => item.revision,
      isCurrent: () => true,
      render,
      publish
    })
    const targets = Array.from({ length: 3 }, (_, index) => ({
      id: `${index}`,
      element: documentLikeElement(),
      resolve: () => ({ id: `${index}`, revision: 1 })
    }))
    queue.observe(null, targets)
    const observer = ControlledIntersectionObserver.instances[0]!
    for (const target of targets) observer.enter(target.element)
    expect(render).toHaveBeenCalledTimes(1)
    queue.dispose()
    resolveFirst?.('0')
    await Promise.resolve()
    observer.enter(targets[0]!.element)
    expect(render).toHaveBeenCalledTimes(1)
    expect(publish).not.toHaveBeenCalled()

    vi.stubGlobal('IntersectionObserver', undefined)
    const fallbackRender = vi.fn(async (item: Item) => item.id)
    const fallback = createLazyCatalogPreviewQueue<Item, string>({
      getId: item => item.id,
      getRevision: item => item.revision,
      isCurrent: () => true,
      render: fallbackRender,
      publish: () => undefined
    })
    fallback.observe(null, targets)
    await vi.waitFor(() => expect(fallbackRender).toHaveBeenCalledTimes(3))
    fallback.dispose()
  })
})

function documentLikeElement(): Element {
  return {} as Element
}
