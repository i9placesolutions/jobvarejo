import { describe, expect, it } from 'vitest'
import { QUICK_MODE_COLOR_SWATCHES, normalizeQuickModePaletteColor } from '../../utils/quickModeColorPalette'

describe('paleta compartilhada do modo rápido', () => {
  it('mantém opções únicas em hexadecimal de seis dígitos', () => {
    expect(new Set(QUICK_MODE_COLOR_SWATCHES).size).toBe(QUICK_MODE_COLOR_SWATCHES.length)
    expect(QUICK_MODE_COLOR_SWATCHES.every(color => /^#[0-9a-f]{6}$/i.test(color))).toBe(true)
  })

  it('normaliza cores curtas para destacar a cor selecionada', () => {
    expect(normalizeQuickModePaletteColor('#FFF')).toBe('#ffffff')
    expect(normalizeQuickModePaletteColor('#3B82F6')).toBe('#3b82f6')
    expect(normalizeQuickModePaletteColor('transparent')).toBeNull()
  })
})
