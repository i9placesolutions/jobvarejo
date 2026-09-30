import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

// Exercise the actual canvas operation with in-memory Fabric/project IO.
const sfc = readFileSync(new URL('../../components/EditorCanvas.vue', import.meta.url), 'utf8')
const body = sfc.slice(sfc.indexOf('const importOneProductPerPage = async'), sfc.indexOf('const quickCompletedProductReviews'))
const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const clone = (data: any) => JSON.parse(JSON.stringify(data))
const fixture = () => {
  const zone = { isProductZone: true, _customId: 'zone' }
  const original = { objects: [zone, { isProductCard: true, name: 'Produto anterior' }] }
  const page = { id: 'current', canvasData: clone(original) }
  const project = { pages: [page, { id: 'later', canvasData: { objects: [] } }] }
  let objects = clone(original.objects)
  const canvas = { getObjects: () => objects, toObject: () => ({ objects }), remove: (object: any) => { objects = objects.filter((candidate: any) => candidate !== object) } }
  const create = vi.fn(async (source: any, options: any) => {
    project.pages.splice(options.insertAfterIndex + 1, 0, { ...source, id: options.name, canvasData: clone(source.canvasData) })
  })
  const simulate = vi.fn(async (products: any[]) => { objects = [zone, { isProductCard: true, name: products[0].name }] })
  const flush = vi.fn()
  const deps = {
    activePage: { value: page }, canvas: { value: canvas }, project,
    findProductZoneById: () => zone, resolveImportTargetZone: () => zone,
    saveCurrentState: vi.fn(async () => { page.canvasData = clone({ objects }) }),
    collectObjectsDeep: () => objects, isLikelyProductZone: (o: any) => !!o.isProductZone,
    isProductCardContainer: (o: any) => !!o.isProductCard, isLikelyProductCard: (o: any) => !!o.isProductCard,
    getProductZoneId: () => 'zone', isHistoryProcessing: { value: false }, simulateSmartGrid: simulate,
    syncAllZoneStateSnapshots: vi.fn(), restoreViewportCulledObjects: vi.fn(), CANVAS_CUSTOM_PROPS: [],
    loadFromJsonSafe: async (data: any) => { objects = clone(data.objects) },
    refreshCanvasObjects: vi.fn(), safeRequestRenderAll: vi.fn(), createPageFromTemplateSource: create,
    flushPersistenceNow: flush, notifyEditorInfo: vi.fn()
  }
  const run = new Function(...Object.keys(deps), `${code}\nreturn importOneProductPerPage`)(...Object.values(deps))
  return { run, page, project, original, simulate, create, flush, objects: () => objects }
}
const products = [{ name: 'Arroz' }, { name: 'Feijão' }]
it('adicionar preserva a página original e cria uma página para cada produto em ordem', async () => {
  const f = fixture()
  await f.run(products, { mode: 'append' })
  expect(f.page.canvasData).toEqual(f.original)
  expect(f.project.pages.map(p => p.id)).toEqual(['current', 'Arroz', 'Feijão', 'later'])
  expect(f.project.pages[1]!.canvasData.objects.filter((o: any) => o.isProductCard)).toHaveLength(1)
  expect(f.flush).toHaveBeenCalledTimes(1)
})
it('substituir usa página atual para primeiro produto e cria somente a cópia restante', async () => {
  const f = fixture()
  await f.run(products, { mode: 'replace' })
  expect(f.project.pages.map(p => p.id)).toEqual(['current', 'Feijão', 'later'])
  expect(f.page.canvasData.objects.find((o: any) => o.isProductCard)?.name).toBe('Arroz')
})
it('falha na preparação restaura o canvas antes de aplicar ou criar páginas', async () => {
  const f = fixture()
  f.simulate.mockRejectedValueOnce(new Error('Falha de preparação'))
  await expect(f.run(products, { mode: 'append' })).rejects.toThrow('Falha de preparação')
  expect(f.objects()).toEqual(f.original.objects)
  expect(f.page.canvasData).toEqual(f.original)
  expect(f.create).not.toHaveBeenCalled()
  expect(f.flush).not.toHaveBeenCalled()
})
