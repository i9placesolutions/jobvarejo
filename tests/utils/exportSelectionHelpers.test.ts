import { describe, it, expect } from 'vitest'
import {
  isBlockedObjectForScopedExport,
  isExportableSelectionObject,
  getSelectedObjectExportFileBaseName
} from '~/utils/exportSelectionHelpers'

describe('isBlockedObjectForScopedExport', () => {
  it('null/undefined retornam true (nao exportavel)', () => {
    expect(isBlockedObjectForScopedExport(null)).toBe(true)
    expect(isBlockedObjectForScopedExport(undefined)).toBe(true)
  })

  it('aceita por excludeFromExport', () => {
    expect(isBlockedObjectForScopedExport({ excludeFromExport: true })).toBe(true)
  })

  it('aceita por isFrame', () => {
    expect(isBlockedObjectForScopedExport({ isFrame: true })).toBe(true)
  })

  it('aceita por product zone (via isLikelyProductZone)', () => {
    expect(isBlockedObjectForScopedExport({
      type: 'group',
      isProductZone: true
    })).toBe(true)
  })

  it('rejeita objeto comum (text/image/rect/etc)', () => {
    expect(isBlockedObjectForScopedExport({ type: 'text' })).toBe(false)
    expect(isBlockedObjectForScopedExport({ type: 'image' })).toBe(false)
    expect(isBlockedObjectForScopedExport({ type: 'rect' })).toBe(false)
  })
})

describe('isExportableSelectionObject', () => {
  it('rejeita null', () => {
    expect(isExportableSelectionObject(null)).toBe(false)
  })

  it('aceita objeto unico exportavel', () => {
    expect(isExportableSelectionObject({ type: 'image' })).toBe(true)
    expect(isExportableSelectionObject({ type: 'text' })).toBe(true)
  })

  it('rejeita objeto bloqueado', () => {
    expect(isExportableSelectionObject({ excludeFromExport: true })).toBe(false)
    expect(isExportableSelectionObject({ isFrame: true })).toBe(false)
  })

  it('activeSelection vazia rejeita', () => {
    expect(isExportableSelectionObject({
      type: 'activeSelection',
      getObjects: () => []
    })).toBe(false)
  })

  it('activeSelection com algum child bloqueado rejeita', () => {
    expect(isExportableSelectionObject({
      type: 'activeSelection',
      getObjects: () => [
        { type: 'text' },
        { isFrame: true }
      ]
    })).toBe(false)
  })

  it('activeSelection com children todos exportaveis aceita', () => {
    expect(isExportableSelectionObject({
      type: 'activeSelection',
      getObjects: () => [
        { type: 'text' },
        { type: 'image' }
      ]
    })).toBe(true)
  })

  it('REGRESSAO: filter(Boolean) descarta children null', () => {
    expect(isExportableSelectionObject({
      type: 'activeSelection',
      getObjects: () => [null, { type: 'text' }, undefined]
    })).toBe(true)
  })
})

describe('getSelectedObjectExportFileBaseName', () => {
  it('prioridade layerName > name > type > "objeto"', () => {
    expect(getSelectedObjectExportFileBaseName({ layerName: 'My Layer' }))
      .toBe('my-layer')
    expect(getSelectedObjectExportFileBaseName({ name: 'foo bar' }))
      .toBe('foo-bar')
    expect(getSelectedObjectExportFileBaseName({ type: 'image' }))
      .toBe('image')
    expect(getSelectedObjectExportFileBaseName({})).toBe('objeto')
  })

  it('aplica slug ASCII', () => {
    expect(getSelectedObjectExportFileBaseName({ name: 'Café com Açúcar!' }))
      .toBe('caf-com-a-car')
  })

  it('colapsa multiplos hifens em um', () => {
    expect(getSelectedObjectExportFileBaseName({ name: 'a--b---c' }))
      .toBe('a-b-c')
  })

  it('remove hifens das pontas', () => {
    expect(getSelectedObjectExportFileBaseName({ name: '!!!hello!!!' }))
      .toBe('hello')
  })

  it('retorna "objeto" se slug ficar vazio', () => {
    expect(getSelectedObjectExportFileBaseName({ name: '!@#$%' }))
      .toBe('objeto')
    expect(getSelectedObjectExportFileBaseName({ name: '' }))
      .toBe('objeto')
  })

  it('null retorna "objeto"', () => {
    expect(getSelectedObjectExportFileBaseName(null)).toBe('objeto')
  })
})
