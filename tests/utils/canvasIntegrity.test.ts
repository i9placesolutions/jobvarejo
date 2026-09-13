import { describe, expect, it } from 'vitest'
import { isValidityOnlyCanvas } from '../../utils/canvasIntegrity'

describe('integridade do canvas de encarte', () => {
  it('reconhece o shell parcial criado somente com a validade', () => {
    expect(isValidityOnlyCanvas({
      objects: [
        { quickDataField: 'validity' },
        { name: 'validity-backdrop' }
      ]
    })).toBe(true)
  })

  it('preserva páginas reais mesmo quando elas possuem validade', () => {
    expect(isValidityOnlyCanvas({
      objects: [
        { type: 'image', isFrame: true },
        { quickDataField: 'validity' }
      ]
    })).toBe(false)
    expect(isValidityOnlyCanvas({ objects: [] })).toBe(false)
    expect(isValidityOnlyCanvas(null)).toBe(false)
  })
})
