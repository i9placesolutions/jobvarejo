import { describe, it, expect, vi } from 'vitest'
import {
  resolveImportTargetZone,
  resolveZoneForProductImport,
  openProductReviewForZone
} from '~/utils/product-zone-target'

const makeZone = (id: string, frameId?: string) => ({
  _customId: id,
  isProductZone: true,
  parentFrameId: frameId
})

const makeCard = (id: string, parentZoneId?: string) => ({
  _customId: id,
  parentZoneId
})

const makeCanvas = (objects: any[], activeObject: any = null) => ({
  getObjects: () => objects,
  getActiveObject: () => activeObject
})

const isLikelyProductZone = (v: any) => !!v?.isProductZone
const isProductCardContainer = (v: any) => !!v?.isProductCard

describe('resolveImportTargetZone — alvo correto da importacao inteligente', () => {
  it('respeita targetGridZone explicito mesmo com varias zonas no canvas (caso da zona duplicada)', () => {
    const zoneA = makeZone('zone-a', 'frame-1')
    const zoneACopy = makeZone('zone-a-copy', 'frame-1') // duplicata no mesmo frame
    const canvas = makeCanvas([zoneA, zoneACopy])

    const result = resolveImportTargetZone({
      canvas,
      targetGridZone: zoneACopy,
      selectedObjectSnapshot: null,
      isLikelyProductZone,
      resolveZoneForProductImport: () => null
    })
    expect(result).toBe(zoneACopy)
  })

  it('refresca a zona explicita pelo _customId quando o objeto vivo no canvas mudou', () => {
    const zoneFresh = makeZone('zone-1', 'frame-1')
    const zoneStale = { ...zoneFresh } // mesmo id, referencia diferente
    const canvas = makeCanvas([zoneFresh])

    const result = resolveImportTargetZone({
      canvas,
      targetGridZone: zoneStale,
      selectedObjectSnapshot: null,
      isLikelyProductZone,
      resolveZoneForProductImport: () => null
    })
    expect(result).toBe(zoneFresh) // retorna a referencia atual do canvas, nao a stale
  })

  it('cai no activeObject quando nao ha targetGridZone', () => {
    const zoneA = makeZone('zone-a', 'frame-1')
    const canvas = makeCanvas([zoneA], zoneA)
    const resolveZoneForProductImport = vi.fn().mockReturnValue(zoneA)

    const result = resolveImportTargetZone({
      canvas,
      targetGridZone: null,
      selectedObjectSnapshot: null,
      isLikelyProductZone,
      resolveZoneForProductImport
    })
    expect(result).toBe(zoneA)
    expect(resolveZoneForProductImport).toHaveBeenCalledWith(zoneA)
  })

  it('cai no snapshot quando active e targetGrid nao tem zona', () => {
    const zoneA = makeZone('zone-a', 'frame-1')
    const canvas = makeCanvas([zoneA])

    const result = resolveImportTargetZone({
      canvas,
      targetGridZone: null,
      selectedObjectSnapshot: { _customId: 'zone-a' },
      isLikelyProductZone,
      resolveZoneForProductImport: () => null
    })
    expect(result).toBe(zoneA)
  })

  it('com uma unica zona disponivel e sem dicas, escolhe ela', () => {
    const zoneA = makeZone('zone-a', 'frame-1')
    const canvas = makeCanvas([zoneA])

    const result = resolveImportTargetZone({
      canvas,
      targetGridZone: null,
      selectedObjectSnapshot: null,
      isLikelyProductZone,
      resolveZoneForProductImport: () => null
    })
    expect(result).toBe(zoneA)
  })

  it('com multiplas zonas e nenhuma dica, retorna null (evita escolha errada)', () => {
    const zoneA = makeZone('zone-a', 'frame-1')
    const zoneB = makeZone('zone-b', 'frame-2')
    const canvas = makeCanvas([zoneA, zoneB])

    const result = resolveImportTargetZone({
      canvas,
      targetGridZone: null,
      selectedObjectSnapshot: null,
      isLikelyProductZone,
      resolveZoneForProductImport: () => null
    })
    expect(result).toBeNull()
  })

  it('canvas null retorna null (proteger contra dispose)', () => {
    expect(resolveImportTargetZone({
      canvas: null,
      targetGridZone: makeZone('z'),
      selectedObjectSnapshot: null,
      isLikelyProductZone,
      resolveZoneForProductImport: () => null
    })).toBeNull()
  })
})

describe('resolveZoneForProductImport — descobre zona dona do alvo', () => {
  const isProductCardContainer = (v: any) => !!v?.isProductCard

  it('alvo já é zona — retorna o proprio', () => {
    const zone = makeZone('zone-a')
    const result = resolveZoneForProductImport({
      canvas: { getObjects: () => [zone] },
      target: zone,
      isLikelyProductZone,
      isProductCardContainer,
      findContainmentZoneById: () => null,
      resolveCardParentZone: () => null,
      findProductCardParentGroup: () => null
    })
    expect(result).toBe(zone)
  })

  it('alvo é card com parentZoneId — resolve via findContainmentZoneById', () => {
    const zone = makeZone('zone-a')
    const card = makeCard('card-1', 'zone-a')
    const findContainmentZoneById = vi.fn((id: string) => id === 'zone-a' ? zone : null)

    const result = resolveZoneForProductImport({
      canvas: { getObjects: () => [zone, card] },
      target: card,
      isLikelyProductZone,
      isProductCardContainer,
      findContainmentZoneById,
      resolveCardParentZone: () => null,
      findProductCardParentGroup: () => null
    })
    expect(result).toBe(zone)
    expect(findContainmentZoneById).toHaveBeenCalledWith('zone-a')
  })

  it('target null/canvas null retorna null', () => {
    expect(resolveZoneForProductImport({
      canvas: null,
      target: null,
      isLikelyProductZone,
      isProductCardContainer,
      findContainmentZoneById: () => null,
      resolveCardParentZone: () => null,
      findProductCardParentGroup: () => null
    })).toBeNull()
  })
})

describe('openProductReviewForZone — orquestrador de abertura do modal', () => {
  it('abre quando recebe uma zona valida', () => {
    const zone = makeZone('z')
    const setTargetZone = vi.fn()
    const setExistingCount = vi.fn()
    const setReviewProducts = vi.fn()
    const setShowReviewModal = vi.fn()

    const result = openProductReviewForZone({
      zone,
      isLikelyProductZone,
      getZoneChildren: () => [{ id: 1 }, { id: 2 }],
      setTargetZone,
      setExistingCount,
      setReviewProducts,
      setShowReviewModal
    })
    expect(result).toBe(true)
    expect(setTargetZone).toHaveBeenCalledWith(zone)
    expect(setExistingCount).toHaveBeenCalledWith(2)
    expect(setReviewProducts).toHaveBeenCalledWith([])
    expect(setShowReviewModal).toHaveBeenCalledWith(true)
  })

  it('rejeita quando zona é null', () => {
    const setShowReviewModal = vi.fn()
    const result = openProductReviewForZone({
      zone: null,
      isLikelyProductZone,
      getZoneChildren: () => [],
      setTargetZone: vi.fn(),
      setExistingCount: vi.fn(),
      setReviewProducts: vi.fn(),
      setShowReviewModal
    })
    expect(result).toBe(false)
    expect(setShowReviewModal).not.toHaveBeenCalled()
  })

  it('tolera erro em getZoneChildren e ainda abre o modal com count=0', () => {
    const zone = makeZone('z')
    const setExistingCount = vi.fn()
    const setShowReviewModal = vi.fn()

    const result = openProductReviewForZone({
      zone,
      isLikelyProductZone,
      getZoneChildren: () => { throw new Error('falha intencional') },
      setTargetZone: vi.fn(),
      setExistingCount,
      setReviewProducts: vi.fn(),
      setShowReviewModal
    })
    expect(result).toBe(true)
    expect(setExistingCount).toHaveBeenCalledWith(0)
    expect(setShowReviewModal).toHaveBeenCalledWith(true)
  })
})
