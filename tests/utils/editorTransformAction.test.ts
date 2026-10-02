import { describe, expect, it } from 'vitest'
import { isExplicitCanvasTransformAction, markBusinessCompositionTransformAsManual } from '../../utils/editorReactivityController'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
import { CANVAS_CUSTOM_PROPS } from '../../utils/canvasCustomProps'

describe('transformação manual de campo dinâmico', () => {
  it('reconhece resizing dos controles laterais do Textbox', () => {
    expect(isExplicitCanvasTransformAction('resizing')).toBe(true)
    expect(isExplicitCanvasTransformAction('resize')).toBe(true)
    expect(isExplicitCanvasTransformAction('scaleX')).toBe(true)
    expect(isExplicitCanvasTransformAction('drag')).toBe(true)
    expect(isExplicitCanvasTransformAction('')).toBe(false)
  })

  it.each(['drag', 'resizing', 'scaleX', 'rotate'])('preserva a faixa social editada após salvar/reabrir (%s)', action => {
    const band = { name: 'header-social-background', footerLayout: 'campaign-social', footerSocialLayout: 'caption-below',
      parentFrameId: 'frame', left: 665.79, top: 9.63, width: 290.42, height: 57.9, visible: true }
    const field = { type: 'textbox', name: 'header-instagram', businessProfileField: 'instagram', parentFrameId: 'frame',
      text: '@loja', left: 718.89, top: 41.24, width: 212.91, height: 21.15, scaleX: .99, scaleY: .99, fontSize: 18.72 }
    const caption = { type: 'textbox', name: 'header-social-caption', parentFrameId: 'frame', text: 'SIGA NOSSO INSTAGRAM!',
      left: 718.61, top: 14.64, width: 223.58, height: 25.45, scaleX: .96, scaleY: .96, fontSize: 22.52 }
    const icon = { type: 'image', name: 'header-icon-instagram', parentFrameId: 'frame',
      left: 687.06, top: 37.62, width: 22.2, height: 22.2, scaleX: 1.22, scaleY: 1.22 }
    for (const object of [field, caption, icon]) {
      expect(markBusinessCompositionTransformAsManual(object, action)).toBe(true)
    }
    expect(CANVAS_CUSTOM_PROPS).toContain('__manualTransform')
    const restored = JSON.parse(JSON.stringify([band, field, caption, icon]))
    const geometry = (objects: any[]) => objects.map(object => [object.left, object.top, object.width, object.height,
      object.scaleX, object.scaleY, object.fontSize, object.text])
    const before = geometry(restored)
    compactBusinessFooter(restored)
    expect(geometry(restored)).toEqual(before)
    compactBusinessFooter(restored)
    expect(geometry(restored)).toEqual(before)
  })

  it('não congela a composição em eventos sem transformação nem em objetos de produto', () => {
    const caption = { name: 'header-social-caption' }
    const product = { name: 'smart_title', type: 'textbox' }
    expect(markBusinessCompositionTransformAsManual(caption, '')).toBe(false)
    expect(markBusinessCompositionTransformAsManual(product, 'drag')).toBe(false)
    expect(caption).not.toHaveProperty('__manualTransform')
    expect(product).not.toHaveProperty('__manualTransform')
  })

  it('mantém o ajuste no roundtrip real do Fabric e permite exportar a página', async () => {
    const { StaticCanvas, Rect, Textbox } = await import('fabric/node')
    const canvas = new StaticCanvas(undefined, { width: 1080, height: 1920 })
    const restored = new StaticCanvas(undefined, { width: 1080, height: 1920 })
    try {
      const band = new Rect({ left: 665, top: 10, width: 290, height: 58, fill: '#00539f' })
      Object.assign(band, { name: 'header-social-background', footerLayout: 'campaign-social',
        footerSocialLayout: 'caption-below', parentFrameId: 'frame' })
      const field = new Textbox('@loja', { left: 718, top: 41, width: 212, fontSize: 18, scaleX: .99, scaleY: .99 })
      Object.assign(field, { name: 'header-instagram', businessProfileField: 'instagram', parentFrameId: 'frame' })
      const caption = new Textbox('SIGA NOSSO INSTAGRAM!', { left: 718, top: 14, width: 223, fontSize: 22, scaleX: .96, scaleY: .96 })
      Object.assign(caption, { name: 'header-social-caption', parentFrameId: 'frame' })
      markBusinessCompositionTransformAsManual(field, 'drag')
      markBusinessCompositionTransformAsManual(caption, 'drag')
      canvas.add(band, field, caption)
      const json = canvas.toObject([...CANVAS_CUSTOM_PROPS])
      await restored.loadFromJSON(json)
      compactBusinessFooter(restored.getObjects())
      const objects = restored.toObject([...CANVAS_CUSTOM_PROPS]).objects
      for (const name of ['header-instagram', 'header-social-caption']) {
        const before = json.objects.find((object: any) => object.name === name)
        const after = objects.find((object: any) => object.name === name)
        expect(after).toMatchObject({ left: before.left, top: before.top, width: before.width,
          height: before.height, scaleX: before.scaleX, scaleY: before.scaleY, __manualTransform: true })
      }
      expect(restored.toDataURL({ format: 'png', multiplier: .1 })).toMatch(/^data:image\/png;base64,/)
    } finally {
      await canvas.dispose()
      await restored.dispose()
    }
  })
})
