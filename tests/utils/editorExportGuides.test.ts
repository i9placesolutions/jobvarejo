import { describe, it, expect } from 'vitest'
import { withProductZonesHiddenForOutput } from '../../utils/editorExportShareController'
import sharp from 'sharp'

const object = (name: string, children?: any[]) => ({
  name, type: children ? 'group' : 'rect', visible: true,
  getObjects: children ? () => children : undefined,
  set(key: string, value: any) { (this as any)[key] = value },
  setCoords() {}
})

describe('Exportação sem perda e sem guias', () => {
  it('oculta a guia aninhada sem remover produtos e restaura após uma falha', async () => {
    const guide = object('zoneRect')
    const product = object('productCard', [object('background')])
    const zone = object('productZoneContainer', [guide, product])
    const ctx: any = {
      canvas: { value: { getObjects: () => [zone] } },
      isLikelyProductZone: (o: any) => o === zone,
      safeRequestRenderAll() {}
    }
    await expect(withProductZonesHiddenForOutput(ctx, () => {
      expect(guide.visible).toBe(false)
      expect(zone.visible).toBe(true)
      expect(product.visible).toBe(true)
      throw new Error('render falhou')
    })).rejects.toThrow('render falhou')
    expect(guide.visible).toBe(true)
    expect(product.visible).toBe(true)
  })

  it('recompressão preserva cada canal RGBA, inclusive semitransparência', async () => {
    const raw = Buffer.alloc(128 * 128 * 4)
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 17 + Math.floor(i / 128)) % 256
    const input = await sharp(raw, { raw: { width: 128, height: 128, channels: 4 } }).png().toBuffer()
    const result = await sharp(input).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer()
    expect(await sharp(result).raw().toBuffer()).toEqual(await sharp(input).raw().toBuffer())
  })
})
