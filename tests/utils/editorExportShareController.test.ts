import { describe, expect, it, vi } from 'vitest'
import { withProductZonesHiddenForOutput } from '~/utils/editorExportShareController'

const fabricObject = (overrides: Record<string, any> = {}) => {
  const object: any = {
    visible: true,
    excludeFromExport: false,
    set(key: string, value: any) {
      object[key] = value
    },
    setCoords: vi.fn(),
    ...overrides
  }
  return object
}

describe('withProductZonesHiddenForOutput', () => {
  it('oculta a reserva da logo apenas durante a saída e restaura o canvas', async () => {
    const logoSlot = fabricObject({
      type: 'rect',
      businessProfileField: 'logo',
      quickLogoSlot: true
    })
    const canvas = { getObjects: () => [logoSlot] }
    const safeRequestRenderAll = vi.fn()
    const context: any = {
      canvas: { value: canvas },
      isLikelyProductZone: () => false,
      safeRequestRenderAll
    }

    await withProductZonesHiddenForOutput(context, () => {
      expect(logoSlot.visible).toBe(false)
      expect(logoSlot.excludeFromExport).toBe(true)
    })

    expect(logoSlot.visible).toBe(true)
    expect(logoSlot.excludeFromExport).toBe(false)
    expect(safeRequestRenderAll).toHaveBeenCalledTimes(2)
  })

  it('mantem a imagem dinamica da logo visivel na saída', async () => {
    const logoImage = fabricObject({
      type: 'image',
      businessProfileField: 'logo',
      quickLogoSlot: true
    })
    const context: any = {
      canvas: { value: { getObjects: () => [logoImage] } },
      isLikelyProductZone: () => false,
      safeRequestRenderAll: vi.fn()
    }

    await withProductZonesHiddenForOutput(context, () => {
      expect(logoImage.visible).toBe(true)
      expect(logoImage.excludeFromExport).toBe(false)
    })
  })
})
