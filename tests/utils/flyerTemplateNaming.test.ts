import { describe, expect, it } from 'vitest'
import {
  hasSingleFlyerTemplateModel,
  renameFlyerTemplateModelInPlace
} from '~/utils/flyerTemplateNaming'

describe('flyerTemplateNaming', () => {
  it('reconhece um modelo mesmo quando ele possui vários formatos', () => {
    expect(hasSingleFlyerTemplateModel([
      { templateModelId: 'model-1', templateModelName: 'Quarta verde', name: 'Quarta verde · Feed 4:5' },
      { templateModelId: 'model-1', templateModelName: 'Quarta verde', name: 'Quarta verde · Story 9:16' }
    ])).toBe(true)

    expect(hasSingleFlyerTemplateModel([
      { templateModelId: 'model-1', templateModelName: 'Quarta verde', name: 'Quarta verde · Feed 4:5' },
      { templateModelId: 'model-2', templateModelName: 'Quarta azul', name: 'Quarta azul · Feed 4:5' }
    ])).toBe(false)
  })

  it('renomeia todas as páginas, modelos e blueprints da mesma variação', () => {
    const pages = [
      {
        id: 'feed',
        name: 'Terça e quarta verde · Feed 4:5',
        templateModelId: 'model-green',
        templateModelName: 'Terça e quarta verde',
        templateFormatLabel: 'Feed 4:5'
      },
      {
        id: 'story',
        name: 'Terça e quarta verde · Story 9:16',
        templateModelId: 'model-green',
        templateModelName: 'Terça e quarta verde',
        templateFormatLabel: 'Story 9:16'
      },
      {
        id: 'other',
        name: 'Fim de semana azul · Feed 4:5',
        templateModelId: 'model-blue',
        templateModelName: 'Fim de semana azul',
        templateFormatLabel: 'Feed 4:5'
      }
    ]
    const config = {
      models: [
        { id: 'model-green', name: 'Terça e quarta verde' },
        { id: 'model-blue', name: 'Fim de semana azul' }
      ],
      pageBlueprints: pages.map(page => ({ ...page, sourcePageId: page.id }))
    }

    expect(renameFlyerTemplateModelInPlace(pages, pages[0], 'Quinta vermelha · Feed 4:5', config)).toBe(true)

    expect(pages.slice(0, 2)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        templateModelName: 'Quinta vermelha',
        name: 'Quinta vermelha · Feed 4:5'
      }),
      expect.objectContaining({
        templateModelName: 'Quinta vermelha',
        name: 'Quinta vermelha · Story 9:16'
      })
    ]))
    expect(pages[2]).toMatchObject({
      templateModelName: 'Fim de semana azul',
      name: 'Fim de semana azul · Feed 4:5'
    })
    expect(config.models).toEqual([
      { id: 'model-green', name: 'Quinta vermelha' },
      { id: 'model-blue', name: 'Fim de semana azul' }
    ])
    expect(config.pageBlueprints[0]).toMatchObject({
      templateModelName: 'Quinta vermelha',
      name: 'Quinta vermelha · Feed 4:5'
    })
    expect(config.pageBlueprints[2]).toMatchObject({
      templateModelName: 'Fim de semana azul',
      name: 'Fim de semana azul · Feed 4:5'
    })
  })
})
