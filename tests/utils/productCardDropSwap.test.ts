import { describe, expect, it } from 'vitest'
import { resolveProductCardDropSwapTarget } from '~/utils/productCardDropSwap'

const card = (id: string, order: number, left: number, top: number, width = 100, height = 100) => ({
  id,
  parentZoneId: 'zone-1',
  _zoneOrder: order,
  _zoneSlot: { zoneId: 'zone-1', left, top, width, height }
})

describe('resolveProductCardDropSwapTarget', () => {
  it('encontra o card do slot em que o card arrastado foi solto', () => {
    const first = card('first', 0, 0, 0)
    const second = card('second', 1, 110, 0)
    const result = resolveProductCardDropSwapTarget({
      draggedCard: first,
      cards: [first, second],
      zoneId: 'zone-1',
      getBounds: (entry) => entry === first
        ? { left: 112, top: 3, width: 96, height: 96 }
        : null
    })

    expect(result).toBe(second)
  })

  it('nao troca ao soltar o card dentro do proprio slot', () => {
    const first = card('first', 0, 0, 0)
    const second = card('second', 1, 110, 0)
    const result = resolveProductCardDropSwapTarget({
      draggedCard: first,
      cards: [first, second],
      zoneId: 'zone-1',
      getBounds: () => ({ left: 2, top: 2, width: 96, height: 96 })
    })

    expect(result).toBeNull()
  })

  it('aceita sobreposicao relevante mesmo se o centro ainda nao entrou no slot', () => {
    const first = card('first', 0, 0, 0)
    const second = card('second', 1, 110, 0)
    const result = resolveProductCardDropSwapTarget({
      draggedCard: first,
      cards: [first, second],
      zoneId: 'zone-1',
      getBounds: () => ({ left: 50, top: 0, width: 100, height: 100 })
    })

    expect(result).toBe(second)
  })

  it('ignora cards de outra zona e slots invalidos', () => {
    const first = card('first', 0, 0, 0)
    const foreign = { ...card('foreign', 1, 110, 0), parentZoneId: 'zone-2', _zoneSlot: { zoneId: 'zone-2', left: 110, top: 0, width: 100, height: 100 } }
    const malformed = { ...card('malformed', 2, 220, 0), _zoneSlot: { zoneId: 'zone-1', left: 220, top: 0, width: 0, height: 100 } }
    const result = resolveProductCardDropSwapTarget({
      draggedCard: first,
      cards: [first, foreign, malformed],
      zoneId: 'zone-1',
      getBounds: () => ({ left: 112, top: 2, width: 96, height: 96 })
    })

    expect(result).toBeNull()
  })
})
