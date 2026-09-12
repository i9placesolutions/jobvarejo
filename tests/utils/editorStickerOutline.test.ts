import { beforeEach, describe, expect, it, vi } from 'vitest'
const generate = vi.hoisted(() => vi.fn())
vi.mock('~/utils/stickerOutline', () => ({ generateStickerOutlineCanvas: generate }))
import { createStickerOutlineRuntime, restoreCanvasStickerOutlines } from '~/utils/editorStickerOutline'

const image = () => ({
  type: 'Image', width: 100, height: 60, left: 40, top: 30,
  scaleX: 0.5, scaleY: 0.5, __stickerOutlineEnabled: true,
  __stickerOutlineWidth: 4, __stickerOutlineColor: '#FFFFFF',
  _element: { tagName: 'IMG', complete: true, naturalWidth: 100, naturalHeight: 60 },
  drawObject: vi.fn(), objectCaching: true
})

describe('restauracao de contorno', () => {
  beforeEach(() => generate.mockReset().mockImplementation(() => ({ width: 112, height: 72 })))
  it('reconstroi o efeito imediatamente em cada pagina sem deslocar a logo', () => {
    for (let page = 0; page < 4; page++) {
      const logo: any = image()
      const geometry = [logo.left, logo.top, logo.scaleX, logo.scaleY]
      restoreCanvasStickerOutlines({ getObjects: () => [logo] })
      expect(logo.__stickerOutlineCache).toBeTruthy()
      expect([logo.left, logo.top, logo.scaleX, logo.scaleY]).toEqual(geometry)
      const ctx = { drawImage: vi.fn() }
      logo.drawObject(ctx, false)
      expect(ctx.drawImage).toHaveBeenCalledOnce()
      expect(logo.__origDrawObjectSticker).toHaveBeenCalledOnce()
    }
  })
  it('invalida o cache do grupo para mostrar o efeito em logos agrupadas', () => {
    const logo: any = image()
    const group = { dirty: false, getObjects: () => [logo] }
    logo.group = group
    restoreCanvasStickerOutlines({ getObjects: () => [group] })
    expect(group.dirty).toBe(true)
    expect(logo.__stickerOutlineCache).toBeTruthy()
  })
  it('regera a silhueta quando a imagem muda mantendo as mesmas dimensoes', () => {
    const logo: any = image()
    const runtime = createStickerOutlineRuntime({ getCanvas: () => null, renderNow: vi.fn() })
    runtime.applyStickerOutlinePatch(logo)
    const first = logo.__stickerOutlineCache
    logo._element = { ...logo._element }
    runtime.applyStickerOutlinePatch(logo)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(logo.__stickerOutlineCache).not.toBe(first)
  })
  it('preserva imagens sem contorno e nao desenha efeitos no clipping', () => {
    const logo: any = image()
    const plain = { ...image(), __stickerOutlineEnabled: false }
    restoreCanvasStickerOutlines({ getObjects: () => [logo, plain] })
    expect(generate).toHaveBeenCalledOnce()
    const ctx = { drawImage: vi.fn() }
    logo.drawObject(ctx, true)
    expect(ctx.drawImage).not.toHaveBeenCalled()
    expect(plain.objectCaching).toBe(true)
  })
})
