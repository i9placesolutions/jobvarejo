import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, nextTick, ref } from 'vue'
import { useProgressivePreviewLoader } from '../../composables/useProgressivePreviewLoader'
const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
const apps: any[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })
function mount() {
  vi.stubGlobal('window', {})
  const observers: any[] = []
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn()
    constructor() { observers.push(this) }
  })
  const ready = ref(false)
  let loader!: ReturnType<typeof useProgressivePreviewLoader<any>>
  const app = renderer.createApp({ setup() {
    loader = useProgressivePreviewLoader({ getItems: () => [{ id: 'a', src: '/a.png' }], getId: item => item.id, getSrc: item => item.src, enabled: () => ready.value })
    return () => null
  } })
  apps.push(app); app.mount({})
  return { app, loader, ready, observers }
}
it('observa cards registrados depois que o carregamento acaba', async () => {
  const h = mount(); h.ready.value = true
  await nextTick(); await nextTick()
  const card = {} as Element
  h.loader.setPreviewHost('a', card)
  expect(h.observers.at(-1).observe).toHaveBeenCalledWith(card)
})
it('não recria observador quando sai da página durante nextTick', async () => {
  const h = mount(); h.ready.value = true
  const pending = h.loader.refreshPreviewObserver()
  h.app.unmount(); await pending; await nextTick()
  expect(h.observers).toHaveLength(0)
})
it('atualizações simultâneas não deixam observadores duplicados ativos', async () => {
  const h = mount(); h.ready.value = true
  await Promise.all([h.loader.refreshPreviewObserver(), h.loader.refreshPreviewObserver()]); await nextTick()
  expect(h.observers.filter(o => o.disconnect.mock.calls.length === 0)).toHaveLength(1)
})
