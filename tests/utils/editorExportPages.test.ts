import { describe, it, expect, vi } from 'vitest'
import { performExport } from '../../utils/editorExportShareController'

vi.mock('../../utils/editorFileTransfer', () => ({
  downloadBlob: vi.fn(), downloadFile: vi.fn(), downloadMultipleFiles: vi.fn(), shareFileFromDataUrl: vi.fn()
}))
vi.mock('../../utils/editorExportPipeline', () => ({ buildPdfBlob: vi.fn(async () => new Blob(['pdf'])) }))

const makeContext = (scope: string, selectedPageIds: string[]) => ({
  canvas: { value: { getActiveObject: () => null, discardActiveObject() {}, getObjects: () => [] } },
  exportSettings: { value: { format: 'pdf', exportScope: scope, selectedPageIds, qualityPreset: 'digital' } },
  isExportDownloadInProgress: { value: false }, showExportModal: { value: true },
  getExportPageIds: () => ['first', 'second', 'third'],
  exportProjectPages: vi.fn(async (ids: string[]) => ids.map(id => ({
    blob: new Blob([id]), fileName: id, baseWidth: 1080, baseHeight: 1080, reducedFromRequested: false
  }))),
  getAllFrames: () => [], safeRequestRenderAll() {}, getExportZoneDiagnostics: () => [],
  startExportDownloadFeedback: () => 1, stopExportDownloadFeedback: vi.fn(),
  makeExportBatchBaseName: () => 'encarte', notifyEditorInfo: vi.fn(), notifyEditorError: vi.fn()
})

describe('Seleção de páginas para exportação', () => {
  it('envia somente as páginas marcadas para renderização', async () => {
    const ctx = makeContext('selected-pages', ['second'])
    await performExport(ctx as any)
    expect(ctx.exportProjectPages).toHaveBeenCalledWith(['second'], 'png', 'digital')
    expect(ctx.notifyEditorError).not.toHaveBeenCalled()
  })
  it('todas inclui as páginas fechadas do projeto', async () => {
    const ctx = makeContext('all-pages', ['second'])
    await performExport(ctx as any)
    expect(ctx.exportProjectPages).toHaveBeenCalledWith(['first', 'second', 'third'], 'png', 'digital')
  })
  it('seleção vazia não gera download e libera o estado de exportação', async () => {
    const ctx = makeContext('selected-pages', [])
    await performExport(ctx as any)
    expect(ctx.exportProjectPages).not.toHaveBeenCalled()
    expect(ctx.notifyEditorInfo).toHaveBeenCalledWith('Selecione pelo menos uma página.')
    expect(ctx.stopExportDownloadFeedback).toHaveBeenCalledWith(1)
  })
})
