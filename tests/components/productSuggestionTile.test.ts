import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'

const { descriptor } = parse(readFileSync(new URL('../../components/ProductSuggestionTile.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'suggestion-tile-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const component: any = {}
new Function('require', 'exports', source)((id: string) => id === 'vue' ? Vue : {}, component)
const renderer = Vue.createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: any[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.useRealTimers() })
const mount = () => {
  const selected = vi.fn()
  const app = renderer.createApp({ ...component.default, render: () => null }, { src: '/image.webp', label: 'Café Pilão', onSelect: selected })
  apps.push(app); app.mount({})
  return { state: (app as any)._instance.setupState, selected }
}
it('mostra carregamento e só permite selecionar uma imagem que carregou', () => {
  const { state, selected } = mount()
  expect(state.status).toBe('loading')
  state.activate()
  expect(selected).not.toHaveBeenCalled()
  state.loaded({ target: { naturalWidth: 500, naturalHeight: 500 } })
  expect(state.status).toBe('ready')
  state.activate()
  expect(selected).toHaveBeenCalledTimes(1)
})
it('imagem com erro permite tentar novamente sem aplicar ao produto', () => {
  const { state, selected } = mount()
  state.failed()
  expect(state.status).toBe('error')
  const attempt = state.attempt
  state.activate()
  expect(state.attempt).toBe(attempt + 1)
  expect(state.status).toBe('loading')
  expect(selected).not.toHaveBeenCalled()
})
it('detecta o pixel transparente usado pelo proxy para um arquivo ausente', () => {
  const { state, selected } = mount()
  state.loaded({ target: { naturalWidth: 1, naturalHeight: 1 } })
  expect(state.status).toBe('error')
  state.activate()
  expect(selected).not.toHaveBeenCalled()
})
it('uma conexão que não responde sai do carregamento e permite nova tentativa', () => {
  vi.useFakeTimers()
  const { state } = mount()
  vi.advanceTimersByTime(30_000)
  expect(state.status).toBe('error')
})
