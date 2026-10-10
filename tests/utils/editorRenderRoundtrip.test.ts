import { StaticCanvas, Rect } from 'fabric/node'
import { expect, it } from 'vitest'
import { createRenderScheduler } from '../../utils/editorRenderScheduler'

it('desenha imediatamente e preserva edição ao serializar, reabrir e exportar PNG', async () => {
  const canvas = new StaticCanvas(undefined, { width: 64, height: 64, renderOnAddRemove: false })
  const reopened = new StaticCanvas(undefined, { width: 64, height: 64, renderOnAddRemove: false })
  try {
    const rectangle = new Rect({ left: 0, top: 0, width: 64, height: 64, fill: '#ff0000', strokeWidth: 0 })
    canvas.add(rectangle)
    const scheduler = createRenderScheduler({ value: canvas }, { value: false })
    scheduler.renderNow()
    expect([...canvas.getContext().getImageData(20, 20, 1, 1).data]).toEqual([255, 0, 0, 255])
    rectangle.set('fill', '#00ff00')
    scheduler.renderNow()
    expect([...canvas.getContext().getImageData(20, 20, 1, 1).data]).toEqual([0, 255, 0, 255])
    await reopened.loadFromJSON(canvas.toJSON())
    createRenderScheduler({ value: reopened }, { value: false }).renderNow()
    expect(reopened.getObjects()[0]?.fill).toBe('#00ff00')
    expect([...reopened.getContext().getImageData(20, 20, 1, 1).data]).toEqual([0, 255, 0, 255])
    expect(reopened.toDataURL({ format: 'png', multiplier: 1 })).toMatch(/^data:image\/png;base64,iVBOR/)
  } finally {
    await canvas.dispose()
    await reopened.dispose()
  }
})
