import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'

const { descriptor } = parse(readFileSync(new URL('../../components/cartazista/CartazistaPreview.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'cartazista-preview-lazy-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const renderSvg = vi.fn(async (composition: any) => `svg:${composition.layers[0].text}`)
const componentModule: any = { exports: {} }
new Function('require', 'module', 'exports', source)((id: string) => {
  if (id === 'vue') return Vue
  if (id.includes('/cartazista/render')) return { renderCartazistaSvg: renderSvg }
  if (id.includes('/cartazista/preview')) return {
    getCartazistaPreviewSvg: (composition: any, render: (value: any) => Promise<string>) => render(composition)
  }
  return {}
}, componentModule, componentModule.exports)

const component = componentModule.exports.default
const renderer = Vue.createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})

let lastObserver: any
class MockIntersectionObserver {
  static options: IntersectionObserverInit | undefined
  disconnect = vi.fn()
  constructor(private readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    MockIntersectionObserver.options = options
    lastObserver = this
  }
  observe = vi.fn()
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  renderSvg.mockClear()
  lastObserver = null
})

it('aguarda interseção, usa a composição mais recente e desconecta ao desmontar', async () => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  vi.stubGlobal('ref', Vue.ref)
  vi.stubGlobal('onMounted', Vue.onMounted)
  vi.stubGlobal('watch', Vue.watch)
  vi.stubGlobal('onBeforeUnmount', Vue.onBeforeUnmount)
  const app = renderer.createApp({
    props: ['composition', 'label', 'lazy'],
    setup(props: any, context: any) {
      const bindings = component.setup(props, context)
      bindings.host.value = {}
      return () => null
    }
  }, {
    composition: { width: 10, height: 10, background: '#fff', layers: [{ text: 'initial' }] },
    label: 'sample',
    lazy: true
  })
  app.mount({})

  expect(lastObserver.observe).toHaveBeenCalledOnce()
  expect(MockIntersectionObserver.options).toMatchObject({ rootMargin: '180px' })
  expect(renderSvg).not.toHaveBeenCalled()

  lastObserver.trigger(false)
  app._instance!.props.composition = { width: 10, height: 10, background: '#fff', layers: [{ text: 'updated' }] }
  await Vue.nextTick()
  expect(renderSvg).not.toHaveBeenCalled()

  lastObserver.trigger(true)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(renderSvg).toHaveBeenCalledOnce()
  expect(renderSvg.mock.calls[0]?.[0].layers[0].text).toBe('updated')

  app.unmount()
  expect(lastObserver.disconnect).toHaveBeenCalledOnce()
})
