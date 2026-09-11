import { describe, expect, it, vi } from 'vitest'
import { computeCanvasFingerprint } from '../../utils/editorCanvasState'
import { persistSerializedPageState } from '../../utils/editorPagePersistence'
import { shouldSkipAutoSave } from '../../utils/editorSavePolicy'

describe('edições chegam ao agendamento de persistência', () => {
  it.each([
    ['fontSize', 32], ['fontFamily', 'Arial'], ['fill', '#ff0000'],
    ['left', 80], ['top', 90], ['scaleX', 2], ['angle', 45],
    ['text', 'Novo produto'], ['src', 'https://example.com/nova.png'],
    ['__manualTypography', true], ['_zoneGlobalStyles', { prodNameScale: 2 }]
  ])('detecta e agenda a alteração de %s', (property, value) => {
    const original = { objects: [{ type: 'Textbox', fontSize: 16 }] }
    const json = { objects: [{ ...original.objects[0], [property]: value }] }
    expect(computeCanvasFingerprint(json)).not.toBe(computeCanvasFingerprint(original))
    const pages = [{ id: 'page-1', canvasData: original }]
    const triggerAutoSave = vi.fn()
    const result = persistSerializedPageState({
      targetPageId: 'page-1', json, source: 'user', reason: 'object:modified',
      currentFingerprint: computeCanvasFingerprint(json), markUnsaved: true, pages,
      resolvePageIndexById: () => 0,
      updatePageData: (index, data) => { pages[index]!.canvasData = data; return true },
      shouldSkipAutoSave, triggerAutoSave
    })
    expect(result.didUpdate).toBe(true)
    expect(pages[0]!.canvasData).toEqual(json)
    expect(triggerAutoSave).toHaveBeenCalledOnce()
  })
  it.each(['object:added', 'object:removed', 'object:modified(zone)', 'history:undo', 'history:redo', 'properties-panel', 'text-edit', 'global-style:color'])('persiste %s', reason => {
    expect(shouldSkipAutoSave('user', reason)).toBe(false)
  })
})
