import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { REDESIGN_VERSION } from '../../shared/pageEnhancementVersion'
import { latestReadyEnhancements } from '../../utils/pageEnhancementResults'
import { runPageEnhancementBatch } from '../../utils/pageEnhancementBatch'

// Exercises the actual SFC setup with Vue's renderer and mocked IO; no browser,
// storage writes or paid generation, and no extra component-test dependency.
const { descriptor } = parse(readFileSync(new URL('../../components/PageEnhancementDialog.vue', import.meta.url), 'utf8'))
const source = ts.transpileModule(compileScript(descriptor, { id: 'enhancement-test' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const exports: any = {}
new Function('require', 'exports', source)((id: string) => {
  if (id === 'vue') return Vue
  if (id === '~/shared/pageEnhancementVersion') return { REDESIGN_VERSION }
  if (id === '~/utils/pageEnhancementResults') return { latestReadyEnhancements }
  if (id === '~/utils/pageEnhancementBatch') return { runPageEnhancementBatch }
  if (id === 'lucide-vue-next') return {}
  throw new Error(`Unexpected import: ${id}`)
}, exports)
const host = () => ({})
const renderer = Vue.createRenderer({
  createElement: host, createText: host, createComment: host, insert: () => {}, remove: () => {},
  setText: () => {}, setElementText: () => {}, parentNode: () => null, nextSibling: () => null, patchProp: () => {}
})
const apps: ReturnType<typeof renderer.createApp>[] = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals() })
const original = (value: string) => `data:image/png;base64,${Buffer.from(value).toString('base64')}`
const hash = (value: string) => createHash('sha256').update(Buffer.from(value.split(',')[1]!, 'base64')).digest('hex')
const flush = async () => { for (let i = 0; i < 15; i++) { await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick() } }

async function mount(initialPageId?: string) {
  vi.stubGlobal('document', { activeElement: null, body: { style: { overflow: '' } } })
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  const current = { a: original('corrected a'), b: original('corrected b') }
  const history = ['a', 'b'].map(pageId => ({
    id: `saved-${pageId}`, pageId, quality: 'high', mode: 'redesign', pipelineVersion: REDESIGN_VERSION,
    sourceHash: hash(original(`old ${pageId}`)), status: 'completed', createdAt: '2026-09-29T19:31:00Z',
    originalUrl: `/saved-original-${pageId}.png`, resultUrl: `/saved-result-${pageId}.png`
  }))
  const fetch = vi.fn(async (url: string, options?: any) => {
    if (url.endsWith('/config')) return { configured: true, available: true }
    if (options?.method === 'POST') return {
      ...history[0], id: 'new-result', pageId: options.body.pageId, sourceHash: options.body.sourceHash,
      originalUrl: '/new-original.png', resultUrl: '/new-result.png'
    }
    return { items: history }
  })
  vi.stubGlobal('$fetch', fetch)
  const prepare = vi.fn(async (id: 'a' | 'b', _mode?: string, _previewOnly?: boolean) => ({
    original: current[id], mask: original('mask'), width: 100, height: 100, protectedCount: 1,
    pipelineVersion: REDESIGN_VERSION
  }))
  const app = renderer.createApp({ ...exports.default, render: () => null }, {
    projectId: 'project', initialPageId, pages: [{ id: 'a', name: 'Page A' }, { id: 'b', name: 'Page B' }], preparePage: prepare
  })
  apps.push(app); app.mount({})
  await flush()
  return { state: (app as any)._instance.setupState, prepare, fetch, current, history }
}

it('opens with the current original even when a saved improvement exists', async () => {
  const { state, prepare, current } = await mount()
  expect(prepare).toHaveBeenCalledWith('a', 'redesign', true)
  expect(state.localPreview).toMatchObject({ pageId: 'a', original: current.a })
  expect(state.selected.resultUrl).toBe('/saved-result-a.png')
  expect(state.sourceHashes.a).toBe(hash(current.a))
  expect(state.actionablePages.map((page: any) => page.id)).toEqual(['a'])
})

it('selecting a checkbox switches the preview to that page and hashes its current image', async () => {
  const { state, prepare, current } = await mount()
  state.togglePage('b'); await flush()
  expect(state.pageId).toBe('b')
  expect(prepare).toHaveBeenLastCalledWith('b', 'redesign', true)
  expect(state.localPreview.original).toBe(current.b)
  expect(state.selected.pageId).toBe('b')
  expect(state.sourceHashes.b).toBe(hash(current.b))
})

it('opens on the page being edited and keeps a single selection aligned with the preview', async () => {
  const { state, current } = await mount('b')
  expect(state.localPreview.original).toBe(current.b)
  expect(state.selectedPageIds).toEqual(['b'])
  await state.selectPageForPreview('a')
  expect(state.localPreview.original).toBe(current.a)
  expect(state.targetPages.map((page: any) => page.id)).toEqual(['a'])
})

it('reselecting a page after viewing history refreshes corrections instead of showing the saved original', async () => {
  const { state, current, history } = await mount()
  await state.showResult(history[0]); expect(state.localPreview).toBeNull()
  current.a = original('another correction')
  await state.selectPageForPreview('a')
  expect(state.previewingCurrent).toBe(true)
  expect(state.localPreview.original).toBe(current.a)
  expect(state.sourceHashes.a).toBe(hash(current.a))
})

it('regeneration submits the corrected original and rechecks it before sending', async () => {
  const { state, prepare, fetch, current } = await mount()
  await state.run()
  expect(prepare).toHaveBeenLastCalledWith('a', 'redesign', false)
  const post = fetch.mock.calls.find(([, options]) => options?.method === 'POST')!
  expect(post[1].body).toMatchObject({ pageId: 'a', original: current.a, sourceHash: hash(current.a) })
  expect(state.selected.id).toBe('new-result')
  expect(state.localPreview).toBeNull()
})

it('verifies all selected originals before sending two independent pages in parallel', async () => {
  const { state, prepare, fetch } = await mount()
  state.scope = 'all'
  const releases: (() => void)[] = []
  const sent: string[] = []
  fetch.mockImplementation(async (url: string, options?: any) => {
    if (options?.method === 'POST') {
      expect(prepare.mock.calls.some(([id, , previewOnly]) => id === 'a' && previewOnly === false)).toBe(true)
      expect(prepare.mock.calls.some(([id, , previewOnly]) => id === 'b' && previewOnly === false)).toBe(true)
      sent.push(options.body.pageId)
      await new Promise<void>(resolve => releases.push(resolve))
      return { id: 'new-' + options.body.pageId, pageId: options.body.pageId, status: 'completed',
        mode: 'redesign', quality: 'high', pipelineVersion: REDESIGN_VERSION,
        sourceHash: options.body.sourceHash, resultUrl: '/result.png' } as any
    }
    return { items: [] }
  })
  const run = state.run()
  await flush()
  expect(sent).toEqual(['a', 'b'])
  expect(state.busy).toBe(true)
  expect(state.message).toContain('2 em processamento')
  releases[1]!()
  await flush()
  expect(state.batchDone).toBe(1)
  expect(state.busy).toBe(true)
  releases[0]!()
  await run
  expect(state.batchDone).toBe(2)
  expect(state.busy).toBe(false)
  expect(state.receipts.filter((r: any) => r.id.startsWith('new-'))).toHaveLength(2)
})
