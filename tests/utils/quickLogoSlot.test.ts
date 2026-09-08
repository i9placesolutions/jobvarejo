import { describe, expect, it } from 'vitest'
import { isQuickLogoPlaceholder } from '~/utils/quickLogoSlot'

describe('isQuickLogoPlaceholder', () => {
  it('identifica a reserva editavel da logo', () => {
    expect(isQuickLogoPlaceholder({
      type: 'rect',
      businessProfileField: 'logo',
      quickLogoSlot: true
    })).toBe(true)
  })

  it('nao confunde a imagem vinculada da logo com a reserva', () => {
    expect(isQuickLogoPlaceholder({
      type: 'image',
      businessProfileField: 'logo',
      quickLogoSlot: true
    })).toBe(false)
  })

  it('nao classifica objetos comuns como reserva de logo', () => {
    expect(isQuickLogoPlaceholder({ type: 'rect', layerName: 'Fundo' })).toBe(false)
    expect(isQuickLogoPlaceholder(null)).toBe(false)
  })
})
