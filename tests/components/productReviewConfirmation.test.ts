import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { getAvailablePrices } from '../../utils/productPriceHelpers'

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
  return {}
}, component)
const host = () => ({})
const renderer = Vue.createRenderer({
  createElement: host, createText: host, createComment: host, insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: any[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })
const mount = (existingCount: number, quickMode = true) => {
  vi.stubGlobal('useApiAuth', () => ({ getApiAuthHeaders: () => ({}) }))
  vi.stubGlobal('$fetch', vi.fn())
  const imported = vi.fn()
  const app = renderer.createApp({ ...component.default, render: () => null }, {
    modelValue: false, quickMode, destination: 'flyer', existingCount, onImport: imported
  })
  apps.push(app); app.mount({})
  const state = (app as any)._instance.setupState
  state.products = [{ id: 'test-product', name: 'Arroz', price: '9,99', imageUrl: '/test.png', status: 'done' }]
  return { state, imported }
}
it('aguarda escolha e cancelar mantém produtos sem emitir importação', async () => {
  const { state, imported } = mount(5)
  const original = JSON.stringify(state.products)
  await state.handleImport()
  expect(state.showImportModeChoice).toBe(true)
  expect(imported).not.toHaveBeenCalled()
  state.showImportModeChoice = false
  expect(JSON.stringify(state.products)).toBe(original)
  expect(imported).not.toHaveBeenCalled()
})
for (const mode of ['append', 'replace'] as const) it(`confirma ${mode} uma única vez com produtos clonados`, async () => {
  const { state, imported } = mount(5)
  state.oneProductPerPage = true
  await state.handleImport()
  await state.confirmImportMode(mode)
  await state.confirmImportMode(mode)
  expect(imported).toHaveBeenCalledTimes(1)
  expect(imported.mock.calls[0]![1]).toMatchObject({ mode, oneProductPerPage: true })
  expect(imported.mock.calls[0]![0][0]).not.toBe(state.products[0])
})
it('página vazia importa diretamente', async () => {
  const { state, imported } = mount(0)
  await state.handleImport()
  expect(state.showImportModeChoice).toBe(false)
  expect(imported).toHaveBeenCalledTimes(1)
})
it('preserva o fluxo avançado sem a nova pergunta', async () => {
  const { state, imported } = mount(5, false)
  await state.handleImport()
  expect(state.showImportModeChoice).toBe(false)
  expect(imported).toHaveBeenCalledTimes(1)
})
