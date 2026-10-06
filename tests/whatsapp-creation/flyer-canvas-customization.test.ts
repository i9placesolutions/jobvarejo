import { describe, expect, it } from 'vitest'
import { createDefaultProductCardConfiguration } from '../../utils/product-card-configuration'
import {
  applyFlyerZoneCustomization, customizationLabelIds, customizeFlyerItem, isDecorativeSealImage, objectBox, sanitizeFlyerLabelIds,
  scaleCardLayout, scaleFlyerLogo, scaleFlyerSeal
} from '../../server/utils/whatsapp-creation/flyer-canvas-customization'

const frame = { type: 'Rect', isFrame: true, _customId: 'frame-1', left: 0, top: 0, width: 400, height: 200 }
const logo = (overrides: Record<string, unknown> = {}) => ({
  type: 'Image', quickLogoSlot: true, _customId: 'logo-1', parentFrameId: 'frame-1', originX: 'center', originY: 'center',
  left: 200, top: 100, width: 100, height: 50, scaleX: 1, scaleY: 1, quickLogoMaxWidth: 100, quickLogoMaxHeight: 50,
  quickLogoBackdropId: 'backdrop-1', ...overrides
})
const backdrop = { type: 'Rect', quickLogoBackdrop: true, quickLogoBackdropOwnerId: 'logo-1', _customId: 'backdrop-1', left: 150, top: 75, width: 100, height: 50, scaleX: 1, scaleY: 1 }
type Canvas = { width: number; height: number; objects: Array<Record<string, any>> }
const center = (object: Record<string, any>) => { const box = objectBox(object); return [box.left + box.width / 2, box.top + box.height / 2] }

describe('logo do encarte', () => {
  it('cresce em torno do centro, leva o fundo junto e atualiza os limites da logo', () => {
    const canvas: Canvas = { width: 400, height: 200, objects: [frame, backdrop, logo()] }
    expect(scaleFlyerLogo(canvas, 1.2)).toBeCloseTo(1.2)
    const [image, bg] = [canvas.objects[2]!, canvas.objects[1]!]
    expect(objectBox(image).width).toBeCloseTo(120)
    expect(center(image)).toEqual([200, 100])
    expect(objectBox(bg).width).toBeCloseTo(120)
    expect(center(bg).map(Math.round)).toEqual([200, 100])
    expect(image.quickLogoMaxWidth).toBeCloseTo(120)
    expect(image.quickLogoCenterX).toBeCloseTo(200)
  })

  it('não passa do frame: perto da borda cresce só até caber', () => {
    const canvas = { width: 400, height: 200, objects: [frame, logo({ left: 60, top: 100 })] }
    const applied = scaleFlyerLogo(canvas, 1.8)
    expect(applied).toBeCloseTo(2 * 60 / 100)
    const box = objectBox(canvas.objects[1]!)
    expect(box.left).toBeGreaterThanOrEqual(-1e-6)
    expect(scaleFlyerLogo({ width: 400, height: 200, objects: [frame, logo({ left: 50 })] }, 1.5)).toBe(1)
  })

  it('diminuir não tem teto e sem logo retorna 0', () => {
    const canvas = { width: 400, height: 200, objects: [frame, logo({ left: 50 })] }
    expect(scaleFlyerLogo(canvas, 0.8)).toBeCloseTo(0.8)
    expect(scaleFlyerLogo({ width: 10, height: 10, objects: [] }, 1.2)).toBe(0)
  })
})

describe('selo decorativo do modelo', () => {
  const seal = (overrides: Record<string, unknown> = {}) => ({ type: 'Image', name: 'selo_oferta', originX: 'center', originY: 'center', left: 200, top: 100, width: 80, height: 80, scaleX: 1, scaleY: 1, parentFrameId: 'frame-1', ...overrides })

  it('reconhece só imagens de selo do cabeçalho', () => {
    expect(isDecorativeSealImage(seal())).toBe(true)
    expect(isDecorativeSealImage(seal({ name: 'Seal Premium' }))).toBe(true)
    expect(isDecorativeSealImage(seal({ name: 'selo +18 bebida' }))).toBe(false)
    expect(isDecorativeSealImage(seal({ name: 'alcoholBadge' }))).toBe(false)
    expect(isDecorativeSealImage(seal({ type: 'Rect' }))).toBe(false)
    expect(isDecorativeSealImage(seal({ isProductCard: true }))).toBe(false)
    expect(isDecorativeSealImage(logo())).toBe(false)
  })

  it('mantém o centro e limita ao frame', () => {
    const canvas = { width: 400, height: 200, objects: [frame, seal()] }
    expect(scaleFlyerSeal(canvas, 1.35)).toEqual({ found: 1, applied: 1.35 })
    expect(objectBox(canvas.objects[1]!).width).toBeCloseTo(108)
    expect(center(canvas.objects[1]!)).toEqual([200, 100])
    const edge = { width: 400, height: 200, objects: [frame, seal({ top: 50 })] }
    const result = scaleFlyerSeal(edge, 1.8)
    expect(result.applied).toBeCloseTo(2 * 50 / 80)
    expect(objectBox(edge.objects[1]!).top).toBeGreaterThanOrEqual(-1e-6)
    expect(scaleFlyerSeal({ width: 10, height: 10, objects: [] }, 1.2)).toEqual({ found: 0, applied: 0 })
  })
})

describe('zonas de produto', () => {
  const zone = (extra: Record<string, unknown> = {}) => ({
    type: 'Group', isProductZone: true, _customId: 'zone-1',
    _zoneGlobalStyles: { prodNameScale: 1.2, splashTemplateId: 'old', productPalette: { cardColor: '#fff' } },
    _zoneStateSnapshot: { globalStyles: { prodNameScale: 1.2 }, zone: { contentStatus: 'empty' } }, ...extra
  })

  it('multiplica o tamanho do nome respeitando 0.5–2.5 e espelha no snapshot', () => {
    const canvas = { objects: [zone()] }
    applyFlyerZoneCustomization(canvas, { nameScale: 1.35 })
    expect((canvas.objects[0] as any)._zoneGlobalStyles.prodNameScale).toBe(1.62)
    expect((canvas.objects[0] as any)._zoneStateSnapshot.globalStyles.prodNameScale).toBe(1.62)
    const big = { objects: [zone({ _zoneGlobalStyles: { prodNameScale: 2.4 } })] }
    applyFlyerZoneCustomization(big, { nameScale: 1.8 })
    expect((big.objects[0] as any)._zoneGlobalStyles.prodNameScale).toBe(2.5)
  })

  it('cor do destaque usa modo automático e cor de todos os cards usa modo manual com contraste', () => {
    const canvas = { objects: [zone()] }
    applyFlyerZoneCustomization(canvas, { palette: { highlightCardColor: '#dc2626', highlightProdNameColor: '#ffffff' } })
    const styles = (canvas.objects[0] as any)._zoneGlobalStyles
    expect(styles.productPalette).toMatchObject({ cardColor: '#fff', highlightCardColor: '#dc2626', highlightProdNameColor: '#ffffff' })
    expect(styles).toMatchObject({ cardColorMode: 'auto', highlightCardColor: '#dc2626' })
    applyFlyerZoneCustomization(canvas, { palette: { cardColor: '#ffd400', prodNameColor: '#111111' } })
    const manual = (canvas.objects[0] as any)._zoneGlobalStyles
    expect(manual).toMatchObject({ cardColorMode: 'manual', cardColor: '#ffd400' })
    expect(manual.productPalette).toMatchObject({ prodNameColor: '#111111', highlightProdNameColor: '#111111' })
  })

  it('etiqueta escolhida vira a da zona com o grupo da biblioteca nos três lugares do snapshot', () => {
    const group = { type: 'group', objects: [{ name: 'price_text' }] }
    const canvas = { __labelTemplates: [{ id: 'label-x', name: 'X', group }], objects: [zone()] }
    applyFlyerZoneCustomization(canvas, { labelTemplateId: 'label-x' })
    const target = canvas.objects[0] as any
    expect(target._zoneGlobalStyles.splashTemplateId).toBe('label-x')
    expect(target._zoneTemplateSnapshotId).toBe('label-x')
    expect(target._zoneTemplateSnapshot).toEqual(group)
    expect(target._zoneTemplateSnapshot).not.toBe(group)
    expect(target._zoneStateSnapshot.labelTemplate).toMatchObject({ id: 'label-x' })
  })

  it('descarta IDs de etiqueta desconhecidos e lista os pedidos para carregar do banco', () => {
    const custom = { labelTemplateId: 'sumiu', itemLabelTemplateIds: { a: 'ok', b: 'sumiu2' } }
    expect(customizationLabelIds(custom).sort()).toEqual(['ok', 'sumiu', 'sumiu2'])
    const { customization, dropped } = sanitizeFlyerLabelIds({ __labelTemplates: [{ id: 'ok' }] }, custom)
    expect(customization).toEqual({ itemLabelTemplateIds: { a: 'ok' } })
    expect(dropped.sort()).toEqual(['sumiu', 'sumiu2'])
  })
})

describe('receita do card e itens', () => {
  it('escala a caixa da etiqueta e do selo +18 em todos os perfis sem tocar na receita original', () => {
    const base = createDefaultProductCardConfiguration()
    const before = JSON.stringify(base)
    const scaled = scaleCardLayout(base, { labelScale: 1.2, badgeScale: 0.8 })
    expect(JSON.stringify(base)).toBe(before)
    expect(scaled.elements.price.width).toBeGreaterThan(0)
    expect(scaled.elements.price.width).toBeLessThanOrEqual(100)
    const grown = scaled.elements.price.width / base.elements.price.width
    expect(grown).toBeGreaterThan(1)
    expect(grown).toBeLessThanOrEqual(1.2 + 1e-6)
    expect(scaled.elements.alcoholBadge.width).toBeLessThan(base.elements.alcoholBadge.width)
    expect(scaled.elements.price.x).toBe(base.elements.price.x)
    expect(scaled.profiles?.compact.elements.price.width).not.toBe(base.profiles?.compact.elements.price.width)
    expect(scaleCardLayout(base, undefined)).toBe(base)
    expect(scaleCardLayout(base, { logoScale: 1.2 })).toBe(base)
  })

  it('a caixa nunca passa dos limites do card', () => {
    const base = createDefaultProductCardConfiguration()
    base.elements.price = { ...base.elements.price, x: 90, width: 20 }
    const scaled = scaleCardLayout(base, { labelScale: 1.6 })
    expect(scaled.elements.price.width).toBeLessThanOrEqual(20)
  })

  it('itens levam etiqueta própria, quantidade e direção de fotos', () => {
    const custom = { labelTemplateId: 'todos', itemLabelTemplateIds: { a: 'so-a' }, imageFill: { count: 2 }, itemImageFill: { b: { count: 3, direction: 'vertical' as const } } }
    expect(customizeFlyerItem({ id: 'a' }, custom)).toEqual({ id: 'a', labelTemplateId: 'so-a', imageFillCount: 2 })
    expect(customizeFlyerItem({ id: 'b' }, custom)).toEqual({ id: 'b', imageFillCount: 3, imageFillDirection: 'vertical' })
    const plain = { id: 'c' }
    expect(customizeFlyerItem(plain, undefined)).toBe(plain)
  })
})
