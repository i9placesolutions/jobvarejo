import { describe, expect, it, vi } from 'vitest'
import {
  getTextSelectionRange,
  getTextSelectionSnapshotMeta
} from '~/utils/editorSelectionSnapshot'
import { applySelectionTextStyle } from '~/utils/editorSelectionTextOps'

const createInlineStyledText = (): any => ({
  type: 'i-text',
  text: '@SUALOJA',
  fontSize: 8,
  fill: '#ffffff',
  selectionStart: 0,
  selectionEnd: 0,
  styles: {
    0: {
      0: { fontSize: 16, fill: '#ff0000' },
      1: { fontSize: 16, fill: '#ff0000' }
    }
  },
  set: vi.fn(function (this: any, patch: Record<string, any>) {
    Object.assign(this, patch)
    return this
  }),
  setSelectionStyles: vi.fn(),
  initDimensions: vi.fn(),
  setCoords: vi.fn()
})

describe('estilo efetivo de IText no inspector', () => {
  it('mostra o estilo inline mesmo com apenas o objeto selecionado', () => {
    const obj = createInlineStyledText()
    obj.getSelectionStyles = vi.fn((start: number, end: number) =>
      Array.from({ length: end - start }, () => ({ fontSize: 16, fill: '#ff0000' }))
    )

    const meta = getTextSelectionSnapshotMeta(obj)

    expect(meta.__textSelectionActive).toBe(false)
    expect(meta.__textFontSizeValue).toBe(16)
    expect(meta.__textFontSizeMixed).toBe(false)
    expect(meta.__textFillValue).toBe('#ff0000')
    expect(obj.getSelectionStyles).toHaveBeenCalledWith(0, obj.text.length, true)
  })

  it('aplica uma mudanca sem selecao interna ao texto inteiro e sincroniza o valor-base', () => {
    const obj = createInlineStyledText()
    const safeAddWithUpdate = vi.fn()

    const applied = applySelectionTextStyle({
      obj,
      prop: 'fontSize',
      value: 20,
      getTextSelectionRange,
      safeAddWithUpdate,
      applyWholeTextWhenNoSelection: true
    })

    expect(applied).toBe(true)
    expect(obj.set).toHaveBeenCalledWith({ fontSize: 20 })
    expect(obj.setSelectionStyles).toHaveBeenCalledWith({ fontSize: 20 }, 0, obj.text.length)
    expect(obj.fontSize).toBe(20)
    expect(obj.dirty).toBe(true)
    expect(safeAddWithUpdate).toHaveBeenCalledWith(obj)
  })

  it('preserva o comportamento de uma selecao interna: somente a faixa marcada muda', () => {
    const obj = createInlineStyledText()
    obj.selectionStart = 2
    obj.selectionEnd = 5
    const safeAddWithUpdate = vi.fn()

    const applied = applySelectionTextStyle({
      obj,
      prop: 'fontSize',
      value: 24,
      getTextSelectionRange,
      safeAddWithUpdate,
      applyWholeTextWhenNoSelection: true
    })

    expect(applied).toBe(true)
    expect(obj.set).not.toHaveBeenCalled()
    expect(obj.setSelectionStyles).toHaveBeenCalledWith({ fontSize: 24 }, 2, 5)
  })

  it('deixa textos sem estilos inline seguirem pela atualizacao comum do objeto', () => {
    const obj = createInlineStyledText()
    obj.styles = {}

    const applied = applySelectionTextStyle({
      obj,
      prop: 'fontSize',
      value: 20,
      getTextSelectionRange,
      safeAddWithUpdate: vi.fn(),
      applyWholeTextWhenNoSelection: true
    })

    expect(applied).toBe(false)
    expect(obj.setSelectionStyles).not.toHaveBeenCalled()
  })
})
