import { describe, expect, it } from 'vitest'
import { pickDrawnFxClip, drawnFxFiles } from '../../shared/video-studio/drawn-fx-pick.mjs'
import { drawnFxPlacement, drawnFxCover, type DrawnFxClip } from '../../shared/video-studio/drawn-fx'
import { drawnFxForTheme, DRAWN_FX_FOR_MOMENT } from '../../shared/video-studio/drawn-fx-catalog'
import { MOTION_PRESETS, identifyMotionPreset } from '../../shared/video-studio/effect-catalog'

const clip = (id: number, category: DrawnFxClip['category'], coverage = .2): DrawnFxClip => ({
  id, category, coverage, file: `drawn-fx/${id}.webm`, frames: 60, width: 1280, height: 720, box: { x0: .4, y0: .3, x1: .6, y1: .7 },
})
const clips = [clip(1, 'explosao'), clip(2, 'explosao'), clip(3, 'explosao'), clip(4, 'explosao', .8), clip(5, 'transicao', .9), clip(6, 'linhas', .7)]

describe('efeitos desenhados', () => {
  it('sorteia de forma determinística e varia entre ofertas', () => {
    const a = [0, 1, 2].map(i => pickDrawnFxClip('explosao', 7, i, 'price', clips)?.id)
    expect(a).toEqual([0, 1, 2].map(i => pickDrawnFxClip('explosao', 7, i, 'price', clips)?.id))
    expect(new Set(a).size).toBe(3)
    // Preço prefere efeitos compactos: o clipe de tela cheia (4) fica de fora quando há opções.
    expect(a).not.toContain(4)
    expect(pickDrawnFxClip('none', 7, 0, 'price', clips)).toBeNull()
    expect(pickDrawnFxClip(undefined, 7, 0, 'price', clips)).toBeNull()
  })

  it('encaixa o conteúdo desenhado (não o quadro) centralizado no alvo', () => {
    const target = { left: 100, top: 200, width: 300, height: 100 }
    const box = drawnFxPlacement(clip(9, 'explosao'), target, 1)
    const c = clip(9, 'explosao').box
    const contentLeft = box.left + box.width * c.x0, contentRight = box.left + box.width * c.x1
    const contentTop = box.top + box.height * c.y0, contentBottom = box.top + box.height * c.y1
    expect((contentLeft + contentRight) / 2).toBeCloseTo(250)
    expect((contentTop + contentBottom) / 2).toBeCloseTo(250)
    expect(contentRight - contentLeft).toBeLessThanOrEqual(300.001)
    expect(contentBottom - contentTop).toBeLessThanOrEqual(100.001)
    const cover = drawnFxCover(clip(5, 'transicao'), 1080, 1920)
    expect(cover.width).toBeGreaterThanOrEqual(1080)
    expect(cover.height).toBeGreaterThanOrEqual(1920)
  })

  it('lista só os arquivos que a composição vai usar (worker)', () => {
    const doc = { variationSeed: 3, offers: [{}, {}], motion: { drawnFx: { price: 'explosao', transition: 'transicao', ambient: 'linhas' } } }
    const files = drawnFxFiles(doc, clips, 4)
    expect(files).toContain('drawn-fx/5.webm')
    expect(files).toContain('drawn-fx/6.webm')
    expect(files.every(f => f.startsWith('drawn-fx/'))).toBe(true)
    expect(drawnFxFiles({ motion: {} }, clips, 4)).toEqual([])
  })

  it('modelos prontos ganham efeitos pelo tema e todos os valores são válidos no momento', () => {
    expect(drawnFxForTheme('Festival de Churrasco').ambient).toBe('fogo')
    expect(drawnFxForTheme('Oferta Relâmpago').price).toBe('eletricidade')
    for (const text of ['Festival de Churrasco', 'Oferta Relâmpago', 'Festa das Crianças', 'Quarta do Hortifruti', 'Mega Oferta']) {
      for (const [moment, category] of Object.entries(drawnFxForTheme(text, 2))) expect(DRAWN_FX_FOR_MOMENT[moment as keyof typeof DRAWN_FX_FOR_MOMENT]).toContain(category)
    }
  })

  it('combinações com efeitos desenhados são reconhecidas e não confundem as antigas', () => {
    const cartoon = MOTION_PRESETS.find(p => p.id === 'cartoon-boom')!
    expect(identifyMotionPreset(structuredClone(cartoon.motion), cartoon.transition)).toBe('cartoon-boom')
    const pressure = MOTION_PRESETS.find(p => p.id === 'pressure')!
    expect(identifyMotionPreset({ ...pressure.motion, drawnFx: { price: 'explosao' } }, pressure.transition)).toBeUndefined()
    expect(identifyMotionPreset({ ...pressure.motion, drawnFx: { price: 'none' } }, pressure.transition)).toBe('pressure')
  })
})
