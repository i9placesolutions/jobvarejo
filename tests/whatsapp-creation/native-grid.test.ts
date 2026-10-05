import { describe, it, expect } from 'vitest'
import { calculateManualProductSlots } from '../../workers/whatsapp-creation/native-grid'
const bounds = { left: 20, top: 300, width: 1000, height: 1200 }
const zone = { _customId: 'zone', _zonePadding: 10, gapHorizontal: 10, gapVertical: 10, columns: 2, rows: 0 }
describe('grade do worker pelo controlador manual', () => {
  it('preenche a última linha incompleta no preset manual', () => {
    const slots = calculateManualProductSlots({ ...zone, quickGridPreset: '2' }, 3, 'story', bounds)
    expect(slots).toHaveLength(3)
    expect(slots[2].width).toBe(980)
    expect(slots[2].left).toBe(30)
    expect(slots[0].width).toBe(485)
  })
  it('desconta a margem mínima quando o modelo salva padding zero', () => {
    const [slot] = calculateManualProductSlots({ ...zone, _zonePadding: 0 }, 1, 'story', bounds)
    expect(slot.left + slot.width).toBeLessThanOrEqual(bounds.left + bounds.width)
    expect(slot.top + slot.height).toBeLessThanOrEqual(bounds.top + bounds.height)
  })
  it('mantém todos os encaixes dentro da zona em contagens de 1 a 24', () => {
    for (let count = 1; count <= 24; count++) {
      const slots = calculateManualProductSlots(zone, count, 'story', bounds)
      expect(slots).toHaveLength(count)
      for (const slot of slots) {
        expect(slot.left).toBeGreaterThanOrEqual(bounds.left)
        expect(slot.top).toBeGreaterThanOrEqual(bounds.top)
        expect(slot.left + slot.width).toBeLessThanOrEqual(bounds.left + bounds.width + 1)
        expect(slot.top + slot.height).toBeLessThanOrEqual(bounds.top + bounds.height + 1)
      }
    }
  })
})
