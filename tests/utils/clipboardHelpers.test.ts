import { describe, it, expect } from 'vitest'
import {
  LEGACY_CROSS_TAB_CLIPBOARD_STORAGE_KEY,
  CLIPBOARD_CLONE_PROPS,
  isEditorClipboardPasteShortcut,
  resolveEditorPasteSource
} from '~/utils/clipboardHelpers'
import { CANVAS_CUSTOM_PROPS } from '~/utils/canvasCustomProps'

describe('clipboard legado', () => {
  it('mantém a chave apenas para limpar instalações antigas', () => {
    expect(LEGACY_CROSS_TAB_CLIPBOARD_STORAGE_KEY).toBe('jobvarejo:editor:fabric-clipboard:v2')
  })
})

describe('CLIPBOARD_CLONE_PROPS', () => {
  it('inclui todas as CANVAS_CUSTOM_PROPS', () => {
    for (const prop of CANVAS_CUSTOM_PROPS) {
      expect(CLIPBOARD_CLONE_PROPS).toContain(prop)
    }
  })

  it('inclui transforms básicos', () => {
    expect(CLIPBOARD_CLONE_PROPS).toContain('opacity')
    expect(CLIPBOARD_CLONE_PROPS).toContain('flipX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('flipY')
    expect(CLIPBOARD_CLONE_PROPS).toContain('clipPath')
    expect(CLIPBOARD_CLONE_PROPS).toContain('filters')
    expect(CLIPBOARD_CLONE_PROPS).toContain('originX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('originY')
    expect(CLIPBOARD_CLONE_PROPS).toContain('angle')
    expect(CLIPBOARD_CLONE_PROPS).toContain('scaleX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('scaleY')
    expect(CLIPBOARD_CLONE_PROPS).toContain('skewX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('skewY')
  })

  it('mantém as props únicas', () => {
    expect(new Set(CLIPBOARD_CLONE_PROPS).size).toBe(CLIPBOARD_CLONE_PROPS.length)
  })
})

describe('resolveEditorPasteSource', () => {
  it('prioriza o clipboard atual do sistema por padrão', () => {
    expect(resolveEditorPasteSource()).toBe('system')
    expect(resolveEditorPasteSource(false)).toBe('system')
  })

  it('usa o clipboard Fabric apenas para uma ação explícita do editor', () => {
    expect(resolveEditorPasteSource(true)).toBe('editor')
  })
})

describe('isEditorClipboardPasteShortcut', () => {
  it('reconhece Ctrl/Cmd+Shift+V como colagem explícita do editor', () => {
    expect(isEditorClipboardPasteShortcut({ key: 'v', ctrlKey: true, shiftKey: true })).toBe(true)
    expect(isEditorClipboardPasteShortcut({ key: 'V', metaKey: true, shiftKey: true })).toBe(true)
  })

  it('mantém Ctrl/Cmd+V normal para o clipboard do sistema', () => {
    expect(isEditorClipboardPasteShortcut({ key: 'v', ctrlKey: true })).toBe(false)
    expect(isEditorClipboardPasteShortcut({ key: 'v', metaKey: true })).toBe(false)
    expect(isEditorClipboardPasteShortcut({ key: 'v', ctrlKey: true, shiftKey: false })).toBe(false)
  })
})
