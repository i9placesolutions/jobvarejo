import { describe, expect, it } from 'vitest'
import {
  clonePageCanvasDataWithFreshIds,
  createUniqueDuplicatedPageId
} from '~/utils/projectCanvasDuplication'

const sequentialIds = () => {
  let count = 0
  return () => `fresh-${++count}`
}

describe('clonePageCanvasDataWithFreshIds', () => {
  it('cria uma página visualmente igual sem compartilhar identidades de frame, zona ou produto', () => {
    const original = {
      objects: [
        { type: 'rect', id: 'frame-node', _customId: 'frame-a', isFrame: true },
        { type: 'image', id: 'logo-node', _customId: 'logo-a', parentFrameId: 'frame-a' },
        { type: 'group', id: 'zone-node', _customId: 'zone-a', isGridZone: true, parentFrameId: 'frame-a' },
        {
          type: 'group',
          id: 'card-node',
          _customId: 'card-a',
          isSmartObject: true,
          isProductCard: true,
          parentFrameId: 'frame-a',
          parentZoneId: 'zone-a',
          _zoneSlot: { zoneId: 'zone-a' },
          _productData: {
            id: 'product-instance-a',
            productId: 'catalog-42',
            productInstanceId: 'product-instance-a',
            zoneInstanceId: 'zone-a'
          }
        }
      ]
    }

    const clone = clonePageCanvasDataWithFreshIds(original, { makeId: sequentialIds() })
    const [frame, logo, zone, card] = clone.objects

    expect(clone).not.toBe(original)
    expect(frame._customId).not.toBe('frame-a')
    expect(logo._customId).not.toBe('logo-a')
    expect(zone._customId).not.toBe('zone-a')
    expect(card._customId).not.toBe('card-a')
    expect(logo.parentFrameId).toBe(frame._customId)
    expect(zone.parentFrameId).toBe(frame._customId)
    expect(card.parentFrameId).toBe(frame._customId)
    expect(card.parentZoneId).toBe(zone._customId)
    expect(card._zoneSlot.zoneId).toBe(zone._customId)
    expect(card._productData.productId).toBe('catalog-42')
    expect(card._productData.productInstanceId).not.toBe('product-instance-a')
    expect(card._productData.zoneInstanceId).toBe(zone._customId)
    expect(original.objects[1]?.parentFrameId).toBe('frame-a')
  })

  it('mantém a mesma referência nova nos metadados de zona sem remapear duas vezes', () => {
    const clone = clonePageCanvasDataWithFreshIds({
      objects: [
        { type: 'rect', _customId: 'frame-a', isFrame: true },
        { type: 'group', _customId: 'zone-a', isGridZone: true, parentFrameId: 'frame-a' },
        {
          type: 'group',
          _customId: 'card-a',
          parentZoneId: 'zone-a',
          parentFrameId: 'frame-a',
          _zoneSlot: { zoneId: 'zone-a' },
          zone: { id: 'zone-a', parentFrameId: 'frame-a' },
          groupId: 'grid-a'
        },
        { type: 'rect', _customId: 'label-a', groupId: 'grid-a' }
      ]
    }, { makeId: sequentialIds() })

    const [frame, zone, card, label] = clone.objects
    expect(card._zoneSlot.zoneId).toBe(zone._customId)
    expect(card.zone.id).toBe(zone._customId)
    expect(card.zone.parentFrameId).toBe(frame._customId)
    expect(card.groupId).toBe(label.groupId)
  })
})

describe('createUniqueDuplicatedPageId', () => {
  it('não aceita um ID de página já usado na cópia', () => {
    const used = new Set(['fresh-1'])
    expect(createUniqueDuplicatedPageId(used, sequentialIds())).toBe('fresh-2')
    expect(used.has('fresh-2')).toBe(true)
  })
})
