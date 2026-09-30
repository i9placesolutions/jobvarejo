import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { getAvailablePrices } from '../../utils/productPriceHelpers'
import * as family from '../../utils/productSuggestionFamily'
import { collectAssetSearchPages } from '../../utils/collectAssetSearchPages'

const { descriptor } = parse(readFileSync(new URL('../../components/ProductReviewModal.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'import-choice-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const component: any = {}
new Function('require', 'exports', source)((id: string) => {
  if (id === 'vue') return Vue
  if (id.includes('useResponsive')) return { useResponsive: () => ({ isMobile: Vue.ref(false) }) }
  if (id.includes('useProductProcessor')) return { useProductProcessor: () => ({
    products: Vue.ref([]), isParsing: Vue.ref(false), parsingError: Vue.ref(''),
    imageQueueState: Vue.ref({ paused: false, running: false }),
    cancelImageProcessing: vi.fn(), resetImageProcessingState: vi.fn()
  }) }
  if (id.includes('productPriceHelpers')) return { getAvailablePrices }
  if (id.includes('productSuggestionFamily')) return family
  if (id.includes('collectAssetSearchPages')) return { collectAssetSearchPages }
  if (id.includes('storageProxy')) return { toWasabiDirectUrl: (value: string) => value }
  return {}
}, component)
const host = () => ({})
const renderer = Vue.createRenderer({
  createElement: host, createText: host, createComment: host, insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: any[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })
const mount = (fetch: ReturnType<typeof vi.fn>) => {
  vi.stubGlobal('useApiAuth', () => ({ getApiAuthHeaders: async () => ({}) }))
  vi.stubGlobal('$fetch', fetch)
  const app = renderer.createApp({ ...component.default, render: () => null }, { modelValue: false, quickMode: true })
  apps.push(app); app.mount({})
  return (app as any)._instance.setupState
}
const row = (name = 'CAFÉ PILÃO 500G') => ({ index: 0, productId: 'same-product', product: { id: 'same-product', name, brand: '', weight: '500g', status: 'done' } })
const assets = (name: string) => ({ items: [{ key: `imagens/${name}.webp`, name, url: '/image.webp' }], nextCursor: null })
const settle = async () => { await Vue.nextTick(); await Promise.resolve(); await Promise.resolve() }

it('consulta a identidade completa e reaproveita apenas o cache da mesma identidade', async () => {
  const fetch = vi.fn().mockResolvedValue(assets('cafe-pilao-500g'))
  const state = mount(fetch)
  await state.fetchReviewSuggestionsForRow(row())
  expect(fetch.mock.calls[0]![1].query).toMatchObject({ q: 'CAFÉ PILÃO 500G', productName: 'CAFÉ PILÃO 500G', weight: '500G', familySearch: '1', ai: '0' })
  await state.fetchReviewSuggestionsForRow(row())
  expect(fetch).toHaveBeenCalledTimes(1)
  fetch.mockResolvedValue(assets('arroz-tio-joao-5kg'))
  await state.fetchReviewSuggestionsForRow(row('ARROZ TIO JOAO 5KG'))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1]![1].query.weight).toBe('5KG')
  expect(state.reviewSuggestionMap['same-product']).toHaveLength(1)
  expect(state.reviewSuggestionMap['same-product'][0].title).toContain('arroz')
})
it('não deixa uma resposta antiga sobrescrever o produto renomeado durante a busca', async () => {
  let finishOld!: (value: unknown) => void
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockResolvedValue(assets('arroz-tio-joao-5kg'))
  const state = mount(fetch)
  const old = state.fetchReviewSuggestionsForRow(row())
  await settle()
  await state.fetchReviewSuggestionsForRow(row('ARROZ TIO JOAO 5KG'))
  finishOld(assets('cafe-pilao-500g'))
  await old
  expect(state.reviewSuggestionMap['same-product']).toHaveLength(1)
  expect(state.reviewSuggestionMap['same-product'][0].title).toContain('arroz')
  expect(state.reviewSuggestionLoadingMap['same-product']).toBe(false)
})
