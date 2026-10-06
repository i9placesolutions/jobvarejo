import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultProductCardConfiguration,
  normalizeProductCardConfiguration,
  normalizeProductCardElementLayout,
  PRODUCT_CARD_ELEMENT_KEYS,
  PRODUCT_ALCOHOL_BADGE_ASSET_URL
} from '../../utils/product-card-configuration'

const { descriptor } = parse(readFileSync(new URL('../../components/ProductCardConfigurationManager.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'product-card-configuration-preview-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const componentModule: any = { exports: {} }
const trimImage = vi.fn(async (value: string) => value)
new Function('require', 'module', 'exports', source)((id: string) => {
  if (id === 'vue') return Vue
  if (id === 'lucide-vue-next') return {}
  if (id.includes('/types/product-zone')) return {}
  if (id.includes('/utils/product-card-configuration')) return {
    createDefaultProductCardConfiguration,
    normalizeProductCardConfiguration,
    normalizeProductCardElementLayout,
    PRODUCT_CARD_ELEMENT_KEYS,
    PRODUCT_ALCOHOL_BADGE_ASSET_URL
  }
  if (id.includes('/utils/fabricImageHelpers')) return { trimImageSourceToDataUrl: trimImage }
  throw new Error(`Unexpected ProductCardConfigurationManager import: ${id}`)
}, componentModule, componentModule.exports)

const component = componentModule.exports.default
const renderer = Vue.createRenderer({
  createElement: (type: string) => ({ type, attributes: {} as Record<string, string>, setAttribute(name: string, value: string) { this.attributes[name] = value }, getAttribute(name: string) { return this.attributes[name] } }),
  createText: (text: string) => ({ text }), createComment: () => ({}), insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})

type PendingPreview = { resolve: (value: any) => void; reject: (error: any) => void }
let pendingPreviews = new Map<string, PendingPreview>()
let observer: MockIntersectionObserver | null = null
let app: ReturnType<typeof renderer.createApp> | null = null

class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) { observer = this }
  observe = vi.fn()
  disconnect = vi.fn()
  trigger(element: any) {
    this.callback([{ target: element, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

const flush = async () => {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolve) => setImmediate(resolve))
    await Vue.nextTick()
  }
}

const mount = (fetch: ReturnType<typeof vi.fn>) => {
  const configuration = Vue.ref(createDefaultProductCardConfiguration())
  vi.stubGlobal('useProductCardConfiguration', () => ({
    configuration,
    isLoading: Vue.ref(false),
    lastError: Vue.ref(null),
    load: vi.fn(async () => configuration.value),
    save: vi.fn(async () => configuration.value),
    publishLive: vi.fn()
  }))
  vi.stubGlobal('useApiAuth', () => ({ getApiAuthHeaders: async () => ({ Authorization: 'session' }) }))
  vi.stubGlobal('$fetch', fetch)
  app = renderer.createApp({ ...component, render: () => null })
  app.mount({} as any)
  return (app as any)._instance.setupState
}

afterEach(() => {
  app?.unmount()
  app = null
  pendingPreviews.clear()
  observer = null
  trimImage.mockClear()
  vi.unstubAllGlobals()
})

describe('ProductCardConfigurationManager label previews', () => {
  it('loads every metadata row, requests only selected and visible images with two workers, and keeps trims for product assets only', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `label-${index}`,
      name: `Etiqueta ${index}`,
      preview_data_url: null
    }))
    let activeRequests = 0
    let maxActiveRequests = 0
    const fetch = vi.fn((url: string, options?: any) => {
      if (url === '/api/label-templates') return Promise.resolve({ templates: rows })
      if (url.includes('/preview')) {
        const id = decodeURIComponent(url.split('/').at(-2) || '')
        activeRequests += 1
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
        return new Promise((resolve, reject) => {
          pendingPreviews.set(id, {
            resolve: (value) => { activeRequests -= 1; resolve(value) },
            reject: (error) => { activeRequests -= 1; reject(error) }
          })
          options?.signal?.addEventListener('abort', () => {
            const pending = pendingPreviews.get(id)
            if (pending) pending.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          }, { once: true })
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const state = mount(fetch)
    await flush()

    expect(fetch).toHaveBeenCalledWith('/api/label-templates', expect.objectContaining({ query: { preview: '0' } }))
    expect(state.labelTemplatePreviews).toHaveLength(5)
    expect(state.labelTemplatePreviews.map((item: any) => item.id)).toEqual(rows.map((item) => item.id))
    expect([...pendingPreviews.keys()]).toEqual(expect.arrayContaining(['label-0']))
    expect(trimImage).toHaveBeenCalledTimes(2)
    expect(trimImage.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      '/coins/LEITE%20PO%20INTEGRAL%20ITALAC%20400G.png',
      PRODUCT_ALCOHOL_BADGE_ASSET_URL
    ]))

    const visibleTwo = { attributes: { 'data-label-preview-id': 'label-2' } as Record<string, string>, getAttribute(name: string) { return this.attributes[name] }, setAttribute(name: string, value: string) { this.attributes[name] = value } }
    const visibleThree = { attributes: { 'data-label-preview-id': 'label-3' } as Record<string, string>, getAttribute(name: string) { return this.attributes[name] }, setAttribute(name: string, value: string) { this.attributes[name] = value } }
    state.observeLabelPreviewElement('label-2', visibleTwo)
    state.observeLabelPreviewElement('label-3', visibleThree)
    observer!.trigger(visibleTwo)
    observer!.trigger(visibleThree)
    await flush()

    expect(maxActiveRequests).toBe(2)
    expect(pendingPreviews.size).toBe(2)
    const firstPending = pendingPreviews.get('label-0')!
    pendingPreviews.delete('label-0')
    firstPending.resolve({ url: 'https://signed.example/label-0.webp', revision: 'revision-0' })
    await flush()
    expect(pendingPreviews.has('label-3')).toBe(true)

    for (const [id, pending] of [...pendingPreviews]) {
      pendingPreviews.delete(id)
      pending.resolve({ url: `https://signed.example/${id}.webp`, revision: `revision-${id}` })
    }
    await flush()
    expect(state.labelTemplatePreviews.find((item: any) => item.id === 'label-0').previewUrl)
      .toBe('https://signed.example/label-0.webp')
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/preview')).length).toBe(3)
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/preview'))
      .every(([url]) => String(url).endsWith('/preview?crop=1'))).toBe(true)
  })

  it('ignores an older catalogue response after a newer reload', async () => {
    let resolveFirstCatalog!: (value: any) => void
    const fetch = vi.fn((url: string) => {
      if (url !== '/api/label-templates') throw new Error(`Unexpected URL: ${url}`)
      if (fetch.mock.calls.filter(([calledUrl]) => calledUrl === url).length === 1) {
        return new Promise((resolve) => { resolveFirstCatalog = resolve })
      }
      return Promise.resolve({ templates: [] })
    })

    const state = mount(fetch)
    await flush()
    await state.loadLabelTemplatePreviews()
    expect(state.labelTemplatePreviews).toEqual([])

    resolveFirstCatalog({ templates: [{ id: 'stale-label', name: 'Stale' }] })
    await flush()
    expect(state.labelTemplatePreviews).toEqual([])
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/preview'))).toHaveLength(0)
  })
})
