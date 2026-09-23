import { describe, expect, it } from 'vitest'
import { isExplicitCanvasTransformAction } from '../../utils/editorReactivityController'

describe('transformação manual de campo dinâmico', () => {
  it('reconhece resizing dos controles laterais do Textbox', () => {
    expect(isExplicitCanvasTransformAction('resizing')).toBe(true)
    expect(isExplicitCanvasTransformAction('resize')).toBe(true)
    expect(isExplicitCanvasTransformAction('scaleX')).toBe(true)
    expect(isExplicitCanvasTransformAction('drag')).toBe(true)
    expect(isExplicitCanvasTransformAction('')).toBe(false)
  })
})
