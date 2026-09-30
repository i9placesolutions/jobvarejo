import { afterEach, expect, it, vi } from 'vitest'
import { generateThumbnailFromCanvasJson } from '../../utils/editorThumbnail'

afterEach(() => vi.unstubAllGlobals())

it('limita chamadas de histórico e materialização a um canvas offscreen simultâneo', async () => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0 }) })
  let active = 0
  let peak = 0
  const finishes: Array<() => void> = []
  class StaticCanvas {
    async loadFromJSON() {
      active++
      peak = Math.max(peak, active)
      await new Promise<void>(resolve => finishes.push(resolve))
      active--
    }
    getObjects() { return [] }
    setZoom() {}
    setDimensions() {}
    set() {}
    renderAll() {}
    toDataURL() { return 'data:image/webp,thumbnail' }
    dispose() {}
  }
  const opts = { sourceJson: { objects: [] }, staticCanvasCtor: StaticCanvas }
  const first = generateThumbnailFromCanvasJson(opts)
  const second = generateThumbnailFromCanvasJson(opts)
  const third = generateThumbnailFromCanvasJson(opts)
  await vi.waitFor(() => expect(finishes).toHaveLength(1))
  expect(active).toBe(1)
  finishes[0]!()
  expect(await first).toBe('data:image/webp,thumbnail')
  await vi.waitFor(() => expect(finishes).toHaveLength(2))
  finishes[1]!()
  await second
  await vi.waitFor(() => expect(finishes).toHaveLength(3))
  finishes[2]!()
  await third
  expect(peak).toBe(1)
  expect(active).toBe(0)
})
