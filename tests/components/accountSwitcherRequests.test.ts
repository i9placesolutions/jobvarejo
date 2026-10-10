import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'

const { descriptor } = parse(readFileSync(new URL('../../components/AccountSwitcher.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'account-requests-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const component: any = {}
new Function('require', 'exports', source)((id: string) => id === 'vue' ? Vue : {}, component)
const host = () => ({})
const renderer = Vue.createRenderer({
  createElement: host, createText: host, createComment: host, insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: any[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.useRealTimers(); vi.unstubAllGlobals() })
function deferred() {
  let resolve!: (value: any) => void
  const promise = new Promise<any>(done => { resolve = done })
  return { promise, resolve }
}
const result = (id: string) => ({ accounts: [{ id, label: id, email: '' }], selectedId: id })
function mount(fetch: ReturnType<typeof vi.fn>) {
  for (const name of ['ref', 'computed', 'watch', 'onMounted', 'onUnmounted'] as const) vi.stubGlobal(name, Vue[name])
  vi.stubGlobal('useAuth', () => ({ isStaff: Vue.ref(true), user: Vue.ref({ email: 'admin@example.test' }) }))
  vi.stubGlobal('$fetch', fetch)
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('window', { location: { assign: vi.fn() } })
  const app = renderer.createApp({ ...component.default, render: () => null })
  apps.push(app); app.mount({})
  return { app, state: (app as any)._instance.setupState }
}
const settle = async () => { await Promise.resolve(); await Vue.nextTick() }

it('cancela a busca anterior e não deixa resposta atrasada substituir resultados atuais', async () => {
  vi.useFakeTimers()
  const first = deferred(); const second = deferred()
  const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { state } = mount(fetch)
  state.search = 'novo'
  await Vue.nextTick()
  expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(250)
  second.resolve(result('novo')); await settle()
  first.resolve(result('antigo')); await settle()
  expect(state.accounts).toEqual(result('novo').accounts)
  expect(state.selectedId).toBe('novo')
  expect(state.loading).toBe(false)
})
it('invalida a resposta antiga durante o debounce sem retirar o indicador da nova busca', async () => {
  vi.useFakeTimers()
  const first = deferred()
  const { state } = mount(vi.fn().mockReturnValue(first.promise))
  state.search = 'abc'; await Vue.nextTick()
  first.resolve(result('antigo')); await settle()
  expect(state.accounts).toEqual([])
  expect(state.loading).toBe(true)
})
it('agrupa digitação rápida em uma única nova chamada', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue(result('inicial'))
  const { state } = mount(fetch)
  for (const value of ['a', 'ab', 'abc']) {
    state.search = value; await Vue.nextTick(); await vi.advanceTimersByTimeAsync(100)
  }
  await vi.advanceTimersByTimeAsync(150)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1]![1].query.search).toBe('abc')
})
it('cancela requisição e debounce ao sair da página', async () => {
  vi.useFakeTimers()
  const first = deferred(); const fetch = vi.fn().mockReturnValue(first.promise)
  const { app, state } = mount(fetch)
  state.search = 'abc'; await Vue.nextTick(); app.unmount()
  await vi.advanceTimersByTimeAsync(500)
  first.resolve(result('antigo')); await settle()
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true)
  expect(state.accounts).toEqual([])
})
it('não permite que uma consulta antiga sobrescreva a conta durante a troca', async () => {
  const first = deferred(); const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce({})
  const { state } = mount(fetch)
  state.selectedId = 'cliente'
  await state.selectAccount()
  first.resolve(result('antigo')); await settle()
  expect(state.selectedId).toBe('cliente')
  expect(fetch.mock.calls[1]![1].body).toEqual({ id: 'cliente' })
  expect(window.location.assign).toHaveBeenCalledWith('/')
})
