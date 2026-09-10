import { expect, it, vi } from 'vitest'
import { createEditorHistoryController } from '../../utils/editorHistoryController'

it.each(['user', 'system'] as const)('bloqueia salvamento %s enquanto outra página carrega', async source => {
  let save: any
  const serialize = vi.fn()
  const values: Record<string, any> = {
    canvas: { value: { getObjects: () => [] } },
    project: { activePageIndex: 1, pages: [{ id: 'A' }, { id: 'B', canvasData: { objects: [{}] } }] },
    isHistoryProcessing: { value: false }, isDesignLoading: { value: true },
    isCanvasDestroyed: { value: false }, storageDegraded: { value: false },
    getActiveProjectPageId: () => 'B', setSaveCurrentState: (fn: any) => { save = fn },
    prepareCanvasForSerialization: serialize,
    getHistoryRestoreCooldownUntil: () => 0,
  }
  const ctx = new Proxy(values, { get: (target, key: string) => key in target ? target[key] : vi.fn() })
  createEditorHistoryController(ctx).setupHistory()
  await save({ source, reason: 'delayed-save', skipCoalesce: true })
  expect(serialize).not.toHaveBeenCalled()
  expect(values.project.pages[1].canvasData).toEqual({ objects: [{}] })
})

it('bloqueia canvas antigo mesmo depois de um callback liberar o indicador de carregamento', async () => {
  let save: any
  const serialize = vi.fn()
  const values: Record<string, any> = {
    canvas: { value: { getObjects: () => [] } },
    project: { activePageIndex: 1, pages: [{ id: 'A' }, { id: 'B', canvasData: { objects: [{}] } }] },
    isHistoryProcessing: { value: false }, isDesignLoading: { value: false },
    isCanvasDestroyed: { value: false }, storageDegraded: { value: false },
    getActiveProjectPageId: () => 'B', isCanvasPageCurrent: () => false,
    setSaveCurrentState: (fn: any) => { save = fn }, prepareCanvasForSerialization: serialize,
    getHistoryRestoreCooldownUntil: () => 0,
  }
  createEditorHistoryController(new Proxy(values, { get: (target, key: string) => key in target ? target[key] : vi.fn() })).setupHistory()
  await save({ source: 'system', reason: 'late-job', skipCoalesce: true })
  expect(serialize).not.toHaveBeenCalled()
})
