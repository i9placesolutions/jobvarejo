import { describe, expect, it } from 'vitest'
import {
  buildFlyerTemplateConfigFromPages,
  buildFlyerTemplatePageBlueprints,
  FLYER_TEMPLATE_FORMATS,
  getFlyerTemplateFormat,
  orderFlyerTemplatePages
} from '~/utils/flyerTemplateApi'

describe('FLYER_TEMPLATE_FORMATS', () => {
  it('tem os formatos usados na biblioteca de modelos', () => {
    expect(FLYER_TEMPLATE_FORMATS.map(item => item.id)).toEqual([
      'feed',
      'square',
      'stories',
      'print',
      'tv'
    ])
  })

  it('mantem dimensoes positivas', () => {
    for (const format of FLYER_TEMPLATE_FORMATS) {
      expect(format.width).toBeGreaterThan(0)
      expect(format.height).toBeGreaterThan(0)
    }
  })
})

describe('getFlyerTemplateFormat', () => {
  it('resolve formato conhecido', () => {
    expect(getFlyerTemplateFormat('stories')).toMatchObject({
      id: 'stories',
      width: 1080,
      height: 1920
    })
  })

  it('cai no feed quando o id e invalido', () => {
    expect(getFlyerTemplateFormat('')).toMatchObject({ id: 'feed', width: 1080, height: 1350 })
    expect(getFlyerTemplateFormat('nao-existe')).toMatchObject({ id: 'feed' })
  })
})

describe('buildFlyerTemplatePageBlueprints', () => {
  it('guarda somente metadados e preserva a referência do canvas por formato', () => {
    const [blueprint] = buildFlyerTemplatePageBlueprints([{
      id: 'page-feed',
      name: 'Modelo 1 · Feed 4:5',
      width: 1080,
      height: 1350,
      type: 'RETAIL_OFFER',
      canvasDataPath: 'projects/user/template/pages/page-feed/canvas.json.gz',
      templateModelId: 'model-1',
      templateModelName: 'Modelo 1',
      templateFormatId: 'feed',
      templateFormatLabel: 'Feed 4:5',
      canvasData: { objects: [{ type: 'image' }] }
    }])

    expect(blueprint).toMatchObject({
      sourcePageId: 'page-feed',
      templateModelId: 'model-1',
      templateFormatId: 'feed',
      canvasDataPath: 'projects/user/template/pages/page-feed/canvas.json.gz'
    })
    expect(blueprint).not.toHaveProperty('canvasData')
  })

  it('infere o formato quando um modelo antigo só tem dimensões', () => {
    expect(buildFlyerTemplatePageBlueprints([{
      id: 'page-story',
      width: 1080,
      height: 1920,
      templateModelId: 'model-1',
      templateModelName: 'Modelo 1'
    }])[0]).toMatchObject({
      templateFormatId: 'stories',
      templateFormatLabel: 'Story 9:16'
    })
  })

  it('corrige id antigo quando as dimensões já são de outro formato', () => {
    expect(buildFlyerTemplatePageBlueprints([{
      id: 'page-square',
      width: 1080,
      height: 1080,
      templateModelId: 'model-1',
      templateModelName: 'Modelo 1',
      templateFormatId: 'feed',
      templateFormatLabel: 'Feed 4:5'
    }])[0]).toMatchObject({
      templateFormatId: 'square',
      templateFormatLabel: 'Post 1:1'
    })
  })
})

describe('buildFlyerTemplateConfigFromPages', () => {
  it('preserva a categoria normalizada ao reconstruir a biblioteca de páginas', () => {
    const config = buildFlyerTemplateConfigFromPages({
      category: '  Limpeza  ',
      subcategory: '  Ofertas relâmpago ',
      formatIds: ['feed'],
      models: [{ id: 'model-1', name: 'Modelo 1' }]
    }, [{
      id: 'page-feed',
      width: 1080,
      height: 1350,
      templateModelId: 'model-1',
      templateModelName: 'Modelo 1',
      templateFormatId: 'feed'
    }])

    expect(config.category).toBe('Limpeza')
    expect(config.subcategory).toBe('Ofertas relâmpago')
    expect(config.pageBlueprints).toHaveLength(1)
  })
})

describe('orderFlyerTemplatePages', () => {
  it('agrupa por modelo e mantém a ordem padrão dos formatos', () => {
    const pages = orderFlyerTemplatePages([
      { id: 'm2-story', templateModelId: 'model-2', templateFormatId: 'stories' },
      { id: 'm1-square', templateModelId: 'model-1', templateFormatId: 'square' },
      { id: 'm2-feed', templateModelId: 'model-2', templateFormatId: 'feed' },
      { id: 'm1-feed', templateModelId: 'model-1', templateFormatId: 'feed' }
    ], {
      models: [
        { id: 'model-1', name: 'Modelo 1' },
        { id: 'model-2', name: 'Modelo 2' }
      ]
    })

    expect(pages.map(page => page.id)).toEqual([
      'm1-feed',
      'm1-square',
      'm2-feed',
      'm2-story'
    ])
  })
})
