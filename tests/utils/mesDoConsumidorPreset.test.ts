import { describe, expect, it } from 'vitest'
import {
  FLYER_TEMPLATE_PRESETS,
  MES_DO_CONSUMIDOR_ASSETS,
  REFERENCE_FLYER_ASSETS,
  getMesDoConsumidorAssetUrl,
  getReferenceFlyerAssetUrl,
  getReferenceFlyerLayout,
  isReferenceFlyerPresetId,
  getMesDoConsumidorLayout,
  isFlyerTemplatePresetId
} from '../../utils/mesDoConsumidorPreset'

describe('modelo Mês do Consumidor', () => {
  it('mantém uma receita própria para todos os formatos suportados', () => {
    for (const format of ['feed', 'square', 'stories', 'print', 'tv']) {
      const layout = getMesDoConsumidorLayout(format)
      expect(layout.productZone.width).toBeGreaterThan(0)
      expect(layout.productZone.height).toBeGreaterThan(0)
      expect(layout.footer.height).toBeGreaterThan(0)
    }
  })

  it('referencia somente assets de biblioteca reutilizáveis', () => {
    expect(MES_DO_CONSUMIDOR_ASSETS.seal.key).toMatch(/^imagens\/biblioteca\/selos\//)
    expect(MES_DO_CONSUMIDOR_ASSETS.discountCoin.key).toMatch(/^imagens\/biblioteca\/elementos\//)
    expect(getMesDoConsumidorAssetUrl(MES_DO_CONSUMIDOR_ASSETS.gloss.key)).toContain(encodeURIComponent(MES_DO_CONSUMIDOR_ASSETS.gloss.key))
  })

  it('reconhece somente o preset publicado', () => {
    expect(isFlyerTemplatePresetId(FLYER_TEMPLATE_PRESETS[0].id)).toBe(true)
    expect(isFlyerTemplatePresetId('outro-modelo')).toBe(false)
  })

  it('publica os três modelos de referência com assets separados por categoria', () => {
    const presets = ['terca-quarta-verde', 'segunda-da-limpeza', 'semana-de-ofertas'] as const
    for (const preset of presets) {
      expect(isReferenceFlyerPresetId(preset)).toBe(true)
      const key = REFERENCE_FLYER_ASSETS[preset].hero.key
      expect(key).toMatch(/^imagens\/biblioteca\/(elementos|selos)\//)
      expect(getReferenceFlyerAssetUrl(key)).toContain(encodeURIComponent(key))
      if (preset === 'segunda-da-limpeza') {
        expect(REFERENCE_FLYER_ASSETS[preset].person.key).toMatch(/^imagens\/biblioteca\/pessoas\//)
      }
      for (const format of ['feed', 'square', 'stories', 'print', 'tv']) {
        const layout = getReferenceFlyerLayout(preset, format)
        expect(layout.productZone.width).toBeGreaterThan(0)
        expect(layout.productZone.height).toBeGreaterThan(0)
      }
    }
  })
})
