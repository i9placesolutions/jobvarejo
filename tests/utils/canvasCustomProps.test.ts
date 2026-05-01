import { describe, it, expect } from 'vitest'
import { CANVAS_CUSTOM_PROPS, DUPLICATE_CLONE_PROPS } from '~/utils/canvasCustomProps'

describe('CANVAS_CUSTOM_PROPS', () => {
  it('e um array nao-vazio', () => {
    expect(Array.isArray(CANVAS_CUSTOM_PROPS)).toBe(true)
    expect(CANVAS_CUSTOM_PROPS.length).toBeGreaterThan(50)
  })

  it('contem props de identidade', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('id')
    expect(CANVAS_CUSTOM_PROPS).toContain('_customId')
    expect(CANVAS_CUSTOM_PROPS).toContain('name')
    expect(CANVAS_CUSTOM_PROPS).toContain('layerName')
    expect(CANVAS_CUSTOM_PROPS).toContain('excludeFromExport')
  })

  it('contem props de frame', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('isFrame')
    expect(CANVAS_CUSTOM_PROPS).toContain('clipContent')
    expect(CANVAS_CUSTOM_PROPS).toContain('parentFrameId')
    expect(CANVAS_CUSTOM_PROPS).toContain('_frameClipOwner')
  })

  it('contem props de smart object/card', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('isSmartObject')
    expect(CANVAS_CUSTOM_PROPS).toContain('isProductCard')
    expect(CANVAS_CUSTOM_PROPS).toContain('parentZoneId')
    expect(CANVAS_CUSTOM_PROPS).toContain('_cardWidth')
    expect(CANVAS_CUSTOM_PROPS).toContain('_cardHeight')
    expect(CANVAS_CUSTOM_PROPS).toContain('_productData')
    expect(CANVAS_CUSTOM_PROPS).toContain('imageUrl')
  })

  it('contem props de zona', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('isProductZone')
    expect(CANVAS_CUSTOM_PROPS).toContain('isGridZone')
    expect(CANVAS_CUSTOM_PROPS).toContain('zoneName')
    expect(CANVAS_CUSTOM_PROPS).toContain('_zoneWidth')
    expect(CANVAS_CUSTOM_PROPS).toContain('_zoneHeight')
    expect(CANVAS_CUSTOM_PROPS).toContain('_zonePadding')
    expect(CANVAS_CUSTOM_PROPS).toContain('_zoneGlobalStyles')
  })

  it('contem props de price/pricing', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('price')
    expect(CANVAS_CUSTOM_PROPS).toContain('pricePack')
    expect(CANVAS_CUSTOM_PROPS).toContain('priceUnit')
    expect(CANVAS_CUSTOM_PROPS).toContain('priceSpecial')
    expect(CANVAS_CUSTOM_PROPS).toContain('priceMode')
    expect(CANVAS_CUSTOM_PROPS).toContain('packageLabel')
  })

  it('contem template manual props (with __ prefix)', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('__manualTransform')
    expect(CANVAS_CUSTOM_PROPS).toContain('__lastCardRelayoutSignature')
    expect(CANVAS_CUSTOM_PROPS).toContain('__priceLayoutSnapshot')
    expect(CANVAS_CUSTOM_PROPS).toContain('__manualTemplateBaseW')
    expect(CANVAS_CUSTOM_PROPS).toContain('__manualTemplateBaseH')
  })

  it('contem props de visibility/scale toggle', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('__visibleScaleX')
    expect(CANVAS_CUSTOM_PROPS).toContain('__visibleScaleY')
    expect(CANVAS_CUSTOM_PROPS).toContain('__rawText')
  })

  it('contem props de shape utilities (cornerRadii, fill/stroke backups)', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('cornerRadii')
    expect(CANVAS_CUSTOM_PROPS).toContain('__fillEnabled')
    expect(CANVAS_CUSTOM_PROPS).toContain('__fillBackup')
    expect(CANVAS_CUSTOM_PROPS).toContain('__strokeEnabled')
    expect(CANVAS_CUSTOM_PROPS).toContain('__strokeBackup')
  })

  it('contem props de vector path/pen tool', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('isVectorPath')
    expect(CANVAS_CUSTOM_PROPS).toContain('isClosedPath')
    expect(CANVAS_CUSTOM_PROPS).toContain('penPathData')
  })

  it('contem props de sticker outline', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('__stickerOutlineEnabled')
    expect(CANVAS_CUSTOM_PROPS).toContain('__stickerOutlineMode')
    expect(CANVAS_CUSTOM_PROPS).toContain('__stickerOutlineWidth')
    expect(CANVAS_CUSTOM_PROPS).toContain('__stickerOutlineColor')
  })

  it('contem locks', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('lockMovementX')
    expect(CANVAS_CUSTOM_PROPS).toContain('lockMovementY')
    expect(CANVAS_CUSTOM_PROPS).toContain('lockScalingX')
    expect(CANVAS_CUSTOM_PROPS).toContain('lockScalingY')
    expect(CANVAS_CUSTOM_PROPS).toContain('lockRotation')
  })

  it('contem props de imagem (CORS, caching, originalSrc)', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('crossOrigin')
    expect(CANVAS_CUSTOM_PROPS).toContain('objectCaching')
    expect(CANVAS_CUSTOM_PROPS).toContain('__originalSrc')
  })

  it('contem props de user guides', () => {
    expect(CANVAS_CUSTOM_PROPS).toContain('isUserGuide')
    expect(CANVAS_CUSTOM_PROPS).toContain('guideAxis')
  })

  it('todos os elementos sao strings nao-vazias', () => {
    for (const prop of CANVAS_CUSTOM_PROPS) {
      expect(typeof prop).toBe('string')
      expect(prop.length).toBeGreaterThan(0)
    }
  })

  it('todas as strings sao unicas (sem duplicatas)', () => {
    const set = new Set(CANVAS_CUSTOM_PROPS)
    expect(set.size).toBe(CANVAS_CUSTOM_PROPS.length)
  })
})

describe('DUPLICATE_CLONE_PROPS', () => {
  it('inclui todas as CANVAS_CUSTOM_PROPS', () => {
    for (const prop of CANVAS_CUSTOM_PROPS) {
      expect(DUPLICATE_CLONE_PROPS).toContain(prop)
    }
  })

  it('inclui transform/visual base props', () => {
    expect(DUPLICATE_CLONE_PROPS).toContain('opacity')
    expect(DUPLICATE_CLONE_PROPS).toContain('flipX')
    expect(DUPLICATE_CLONE_PROPS).toContain('flipY')
    expect(DUPLICATE_CLONE_PROPS).toContain('filters')
    expect(DUPLICATE_CLONE_PROPS).toContain('clipPath')
    expect(DUPLICATE_CLONE_PROPS).toContain('src')
    expect(DUPLICATE_CLONE_PROPS).toContain('originX')
    expect(DUPLICATE_CLONE_PROPS).toContain('originY')
    expect(DUPLICATE_CLONE_PROPS).toContain('angle')
    expect(DUPLICATE_CLONE_PROPS).toContain('scaleX')
    expect(DUPLICATE_CLONE_PROPS).toContain('scaleY')
    expect(DUPLICATE_CLONE_PROPS).toContain('data')
  })

  it('todos os elementos sao unicos (Array.from(Set))', () => {
    const set = new Set(DUPLICATE_CLONE_PROPS)
    expect(set.size).toBe(DUPLICATE_CLONE_PROPS.length)
  })

  it('e maior que CANVAS_CUSTOM_PROPS (tem props extras de transform)', () => {
    expect(DUPLICATE_CLONE_PROPS.length).toBeGreaterThanOrEqual(CANVAS_CUSTOM_PROPS.length)
  })
})
