import { afterEach, expect, it, vi } from 'vitest'
import { createRenderScheduler } from '../../utils/editorRenderScheduler'

function harness() {
  let id = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => callbacks.delete(key))
  const canvas = {
    contextContainer: { clearRect: vi.fn() },
    renderAll: vi.fn(),
    requestRenderAll: vi.fn(() => requestAnimationFrame(() => canvas.renderAll())),
  }
  const destroyed = { value: false }
  const scheduler = createRenderScheduler({ value: canvas }, destroyed)
  const frame = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(16)) }
  return { canvas, scheduler, destroyed, callbacks, frame }
}
afterEach(() => vi.unstubAllGlobals())
it('agrupa 100 alterações e desenha no primeiro frame, sem um segundo RAF do Fabric', () => {
  const h = harness()
  for (let i = 0; i < 100; i++) h.scheduler.scheduleRender()
  expect(h.callbacks.size).toBe(1)
  h.frame()
  expect(h.canvas.renderAll).toHaveBeenCalledOnce()
  expect(h.callbacks.size).toBe(0)
})
it('renderNow desenha sincronamente e cancela o frame pendente', () => {
  const h = harness()
  h.scheduler.scheduleRender(); h.scheduler.renderNow()
  expect(h.canvas.renderAll).toHaveBeenCalledOnce()
  expect(h.callbacks.size).toBe(0)
})
it('não renderiza canvas destruído e cancela ao desmontar', () => {
  const h = harness()
  h.scheduler.scheduleRender(); h.destroyed.value = true; h.frame()
  expect(h.canvas.renderAll).not.toHaveBeenCalled()
  h.destroyed.value = false; h.scheduler.scheduleRender(); h.scheduler.dispose(); h.frame()
  expect(h.canvas.renderAll).not.toHaveBeenCalled()
})
