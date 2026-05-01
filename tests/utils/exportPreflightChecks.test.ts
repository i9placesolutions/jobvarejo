import { describe, it, expect } from 'vitest'
import {
  computeExportPreflightCounts,
  buildExportPreflightWarnings
} from '~/utils/exportPreflightChecks'

const isProdZone = (obj: any) => !!obj?.isProductZone

describe('computeExportPreflightCounts', () => {
  it('input vazio: counts zerados', () => {
    expect(computeExportPreflightCounts({
      objects: [], isLikelyProductZone: isProdZone
    })).toEqual({ brokenImages: 0, emptyProductCards: 0, emptyZones: 0 })
  })

  it('input null/undefined: defaults seguros', () => {
    const r = computeExportPreflightCounts({} as any)
    expect(r).toEqual({ brokenImages: 0, emptyProductCards: 0, emptyZones: 0 })
  })

  it('image sem src: conta como broken', () => {
    expect(computeExportPreflightCounts({
      objects: [{ type: 'image' }],
      isLikelyProductZone: isProdZone
    }).brokenImages).toBe(1)
  })

  it('image com src valido: nao conta', () => {
    expect(computeExportPreflightCounts({
      objects: [{ type: 'image', src: 'https://example.com/foo.png' }],
      isLikelyProductZone: isProdZone
    }).brokenImages).toBe(0)
  })

  it('image com naturalWidth=0: broken', () => {
    expect(computeExportPreflightCounts({
      objects: [{ type: 'image', src: 'foo.png', _element: { src: 'foo.png', naturalWidth: 0 } }],
      isLikelyProductZone: isProdZone
    }).brokenImages).toBe(1)
  })

  it('image com __loadFailed=true: broken', () => {
    expect(computeExportPreflightCounts({
      objects: [{ type: 'image', src: 'foo.png', __loadFailed: true }],
      isLikelyProductZone: isProdZone
    }).brokenImages).toBe(1)
  })

  it('zona sem cards (parentZoneId nao bate): conta como empty', () => {
    expect(computeExportPreflightCounts({
      objects: [{ isProductZone: true, _customId: 'z1' }],
      isLikelyProductZone: isProdZone
    }).emptyZones).toBe(1)
  })

  it('zona com cards: nao conta', () => {
    expect(computeExportPreflightCounts({
      objects: [
        { isProductZone: true, _customId: 'z1' },
        { isProductCard: true, parentZoneId: 'z1', productName: 'X', productPrice: '5' }
      ],
      isLikelyProductZone: isProdZone
    }).emptyZones).toBe(0)
  })

  it('card sem name e sem price: empty', () => {
    expect(computeExportPreflightCounts({
      objects: [{ isProductCard: true }],
      isLikelyProductZone: isProdZone
    }).emptyProductCards).toBe(1)
  })

  it('card com name OU price: nao empty', () => {
    expect(computeExportPreflightCounts({
      objects: [
        { isProductCard: true, productName: 'X' },
        { isProductCard: true, productPrice: '5' }
      ],
      isLikelyProductZone: isProdZone
    }).emptyProductCards).toBe(0)
  })

  it('desce em groups aninhados (recursao via getObjects)', () => {
    const innerImage = { type: 'image' } // broken
    const innerCard = { isProductCard: true } // empty
    const group = { type: 'group', getObjects: () => [innerImage, innerCard] }
    const r = computeExportPreflightCounts({
      objects: [group],
      isLikelyProductZone: isProdZone
    })
    expect(r.brokenImages).toBe(1)
    expect(r.emptyProductCards).toBe(1)
  })

  it('error em walk e capturado silenciosamente', () => {
    const explosiveGroup = {
      type: 'group',
      getObjects: () => { throw new Error('boom') }
    }
    expect(() => computeExportPreflightCounts({
      objects: [explosiveGroup],
      isLikelyProductZone: isProdZone
    })).not.toThrow()
  })
})

describe('buildExportPreflightWarnings', () => {
  it('counts zerados: array vazio', () => {
    expect(buildExportPreflightWarnings({
      brokenImages: 0, emptyProductCards: 0, emptyZones: 0
    })).toEqual([])
  })

  it('formata mensagem com brokenImages', () => {
    const warnings = buildExportPreflightWarnings({
      brokenImages: 3, emptyProductCards: 0, emptyZones: 0
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('3 imagem(ns)')
  })

  it('formata mensagem com emptyZones', () => {
    const warnings = buildExportPreflightWarnings({
      brokenImages: 0, emptyProductCards: 0, emptyZones: 2
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('2 zona(s)')
  })

  it('formata mensagem com emptyProductCards', () => {
    const warnings = buildExportPreflightWarnings({
      brokenImages: 0, emptyProductCards: 5, emptyZones: 0
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('5 card(s)')
  })

  it('todos os 3 contadores: 3 mensagens', () => {
    expect(buildExportPreflightWarnings({
      brokenImages: 1, emptyProductCards: 1, emptyZones: 1
    })).toHaveLength(3)
  })
})
