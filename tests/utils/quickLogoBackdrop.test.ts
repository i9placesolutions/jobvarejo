import { describe, expect, it } from 'vitest'
import { normalizeQuickLogoBackdropMode } from '~/utils/quickLogoBackdrop'

describe('normalizeQuickLogoBackdropMode', () => {
  it('usa sem fundo como padrão para uma logo dinâmica nova ou legada sem escolha', () => {
    expect(normalizeQuickLogoBackdropMode(undefined)).toBe('none')
    expect(normalizeQuickLogoBackdropMode(null)).toBe('none')
    expect(normalizeQuickLogoBackdropMode('')).toBe('none')
  })

  it('mantém as escolhas explícitas de fundo do cliente', () => {
    expect(normalizeQuickLogoBackdropMode('square')).toBe('square')
    expect(normalizeQuickLogoBackdropMode('redondo')).toBe('round')
    expect(normalizeQuickLogoBackdropMode('oval')).toBe('oval')
    expect(normalizeQuickLogoBackdropMode('sem fundo')).toBe('none')
  })
})
