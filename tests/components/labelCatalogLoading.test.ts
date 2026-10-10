import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { createLazyCatalogPreviewQueue } from '../../utils/lazyCatalogPreviewQueue'
import * as labelHelpers from '../../utils/labelTemplateHelpers'

const { descriptor } = parse(readFileSync(new URL('../../pages/label-templates.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'label-catalog-loading-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
let realQueue = false
const observePreviews = vi.fn()
const component: any = {}
new Function('require', 'exports', source)((id: string) => {
  if (id === 'vue') return Vue
  if (id === 'vue-router') return { onBeforeRouteLeave: vi.fn() }
  if (id.includes('labelTemplateHelpers')) return labelHelpers
  if (id.includes('lazyCatalogPreviewQueue')) return { createLazyCatalogPreviewQueue: (options: any) => realQueue ? createLazyCatalogPreviewQueue(options) : ({ dispose: vi.fn(), observe: observePreviews, sync: vi.fn(), enqueue: vi.fn() }) }
  return {}
}, component)
class PreviewElement { closest() { return null } }
const host = () => new PreviewElement()
const renderer = Vue.createRenderer({
  createElement: host, createText: host, createComment: host, insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: any[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })
const summary = { id: labelHelpers.BUILTIN_DEFAULT_LABEL_TEMPLATE_ID, name: 'Padrão', kind: 'priceGroup-v1', created_at: '2026-01-01', updated_at: '2026-01-01' }
const group = { type: 'group', objects: [{ type: 'text', text: '9,99' }] }
const settle = async () => { for (let i = 0; i < 10; i++) await Vue.nextTick() }
async function mount(fetch: ReturnType<typeof vi.fn>, withCards = false, requestPreviews = false) {
  realQueue = requestPreviews
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: any) {}
    observe(target: any) { queueMicrotask(() => this.callback([{ target, isIntersecting: true }])) }
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal("Element", PreviewElement)
  observePreviews.mockClear()
  for (const name of ['ref', 'computed', 'watch', 'onMounted', 'onBeforeUnmount', 'nextTick'] as const) vi.stubGlobal(name, Vue[name])
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ query: {} }))
  vi.stubGlobal('useApiAuth', () => ({ getApiAuthHeaders: async () => ({}) }))
  vi.stubGlobal('useUpload', () => ({ uploadFile: vi.fn() }))
  vi.stubGlobal('$fetch', fetch)
  const app = renderer.createApp({ ...component.default, render(this: any) {
    const state = this.$.setupState
    if (!withCards || state.isLoading) return null
    return Vue.h('div', state.filteredTemplates.map((template: any) => Vue.h('article', {
      key: template.id, ref: (element: any) => state.setPreviewElement(template.id, element)
    })))
  } })
  apps.push(app); app.mount(new PreviewElement()); await settle()
  return { app, state: (app as any)._instance.setupState }
}

it('carrega só metadados e busca um único desenho ao abrir; reabertura reaproveita o desenho', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ success: true, templates: [summary] })
    .mockResolvedValueOnce({ success: true, templates: [{ ...summary, group }] })
  const { state } = await mount(fetch)
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch.mock.calls[0]![1].query).toEqual({ summary: '1' })
  expect(state.templates).toHaveLength(1)
  expect(state.templates[0].group).toBeUndefined()
  await state.openEditor(state.templates[0])
  expect(fetch.mock.calls[1]![1].query).toEqual({ ids: summary.id, preview: '0' })
  expect(state.editingTemplate.group).toEqual(group)
  state.closeEditor(); await state.openEditor(state.templates[0])
  expect(fetch).toHaveBeenCalledTimes(2)
  state.editingTemplate.group.objects[0].text = 'editado'
  expect(state.templates[0].group.objects[0].text).toBe('9,99')
})
it('não abre desenho vazio quando a API falha e permite tentar novamente', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ success: true, templates: [summary] })
    .mockResolvedValueOnce({ success: true, templates: [] })
    .mockResolvedValueOnce({ success: true, templates: [{ ...summary, group }] })
  const { state } = await mount(fetch)
  await state.openEditor(state.templates[0])
  expect(state.editingTemplate).toBeNull()
  expect(state.openingTemplateId).toBeNull()
  expect(state.toast.type).toBe('error')
  await state.openEditor(state.templates[0])
  expect(state.editingTemplate.group).toEqual(group)
})
it('carrega o desenho antes de duplicar e não salva metadados como etiqueta vazia', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ success: true, templates: [summary] })
    .mockResolvedValueOnce({ success: true, templates: [{ ...summary, group }] })
    .mockResolvedValueOnce({ success: true })
  const { state } = await mount(fetch)
  await state.duplicateTemplate(state.templates[0])
  expect(fetch).toHaveBeenCalledTimes(3)
  const save = fetch.mock.calls[2]![1]
  expect(save.method).toBe('POST')
  expect(save.body.group).toEqual(group)
  expect(save.body.id).not.toBe(summary.id)
  expect(state.templates).toHaveLength(2)
})
it('não abre editor após sair da página durante o download do desenho', async () => {
  let resolve!: (value: any) => void
  const fetch = vi.fn().mockResolvedValueOnce({ success: true, templates: [summary] })
    .mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const { app, state } = await mount(fetch)
  const pending = state.openEditor(state.templates[0]); await settle(); app.unmount()
  resolve({ templates: [{ ...summary, group }] }); await pending
  expect(state.editingTemplate).toBeNull()
})

it('observa os cards na primeira abertura depois de remover o loading, sem precisar buscar ou recarregar', async () => {
  const fetch = vi.fn().mockResolvedValue({ success: true, templates: [summary] })
  const { state } = await mount(fetch, true)
  expect(state.isLoading).toBe(false)
  expect(observePreviews.mock.calls.some(([, targets]) => targets.some((target: any) => target.id === summary.id))).toBe(true)
})

it('primeira abertura e recarga solicitam e publicam a imagem sem interação do usuário', async () => {
  const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith('/preview')
    ? { url: 'https://example.test/label.webp', revision: 'r1' }
    : { success: true, templates: [summary] }))
  const { state } = await mount(fetch, true, true)
  await vi.waitFor(() => expect(state.previewSrc(state.templates[0])).toBe('https://example.test/label.webp'))
  await state.loadTemplates()
  await vi.waitFor(() => expect(state.previewSrc(state.templates[0])).toBe('https://example.test/label.webp'))
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/preview'))).toHaveLength(2)
})
