import { describe, it, expect, vi } from 'vitest'
import { sampleCanvasColor } from '../../utils/canvasColorSampler'

function fixture(pixel = [18, 52, 86, 255]) {
  const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(pixel) }))
  const canvas = {
    width: 1200, height: 800,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 600, height: 400 }),
    getContext: () => ({ getImageData })
  } as unknown as HTMLCanvasElement
  return { canvas, getImageData }
}
describe('canvas color sampling', () => {
  it('maps CSS coordinates to retina bitmap pixels without reapplying zoom or pan', () => {
    const { canvas, getImageData } = fixture()
    expect(sampleCanvasColor(canvas, 250, 150)).toBe('#123456')
    expect(getImageData).toHaveBeenCalledWith(300, 200, 1, 1)
  })
  it('does not read outside the rendered canvas', () => {
    const { canvas, getImageData } = fixture()
    expect(sampleCanvasColor(canvas, 700, 50)).toBeNull()
    expect(sampleCanvasColor(canvas, 99, 50)).toBeNull()
    expect(getImageData).not.toHaveBeenCalled()
  })
  it('does not turn empty transparent pixels into black', () => {
    expect(sampleCanvasColor(fixture([0, 0, 0, 0]).canvas, 200, 100)).toBeNull()
  })
  it('propagates security errors so the picker can explain the failure', () => {
    const { canvas, getImageData } = fixture()
    getImageData.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    expect(() => sampleCanvasColor(canvas, 200, 100)).toThrow('Blocked')
  })
})
