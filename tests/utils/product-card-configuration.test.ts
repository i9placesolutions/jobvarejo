import { describe, expect, it } from 'vitest'
import {
  createDefaultProductCardConfiguration,
  isAlcoholicProduct,
  normalizeProductCardConfiguration,
  resolveProductCardConfigurationProfile,
  resolveProductCardConfigurationProfileKey,
  resolveProductCardPriceScale,
  setProductCardElementLayout
} from '~/utils/product-card-configuration'
import { createProductCardConfigurationLayout } from '~/utils/editorProductCardConfiguration'

const makeTransformObject = (props: Record<string, any> = {}) => {
  const object: any = {
    type: 'image',
    name: 'smart_image',
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    left: 0,
    top: 0,
    visible: true,
    angle: 0,
    set(keyOrValues: string | Record<string, any>, value?: any) {
      if (typeof keyOrValues === 'string') object[keyOrValues] = value
      else Object.assign(object, keyOrValues)
      return object
    },
    setCoords() {},
    getScaledWidth() { return Math.abs(Number(object.width || 0) * Number(object.scaleX || 1)) },
    getScaledHeight() { return Math.abs(Number(object.height || 0) * Number(object.scaleY || 1)) },
    ...props
  }
  return object
}

describe('product-card-configuration', () => {
  it('cria uma receita completa para os cinco elementos do card', () => {
    const configuration = createDefaultProductCardConfiguration()

    expect(configuration.enabled).toBe(true)
    expect(configuration.elements.name).toMatchObject({ visible: true, x: 50, y: 11 })
    expect(configuration.elements.image).toMatchObject({ visible: true, x: 50, y: 50 })
    expect(configuration.elements.price).toMatchObject({ visible: true, x: 50, y: 84 })
    expect(configuration.elements.alcoholBadge).toMatchObject({ visible: true })
    expect(configuration.elements.limit).toMatchObject({ visible: true })
    expect(configuration.elements.name.rotation).toBe(0)
    expect(configuration.profiles?.compact.elements).toBeDefined()
    expect(configuration.profiles?.wide.elements).toBeDefined()
    expect(configuration.profiles?.featured.elements).toBeDefined()
  })

  it('normaliza coordenadas, tamanho e texto sem apagar elementos ausentes', () => {
    const configuration = normalizeProductCardConfiguration({
      elements: {
        name: { x: 140, y: -20, width: 2, height: 120 },
        price: { visible: false, x: 35, rotation: 725 }
      } as any,
      alcoholBadgeText: '  18 ANOS  '
    })

    expect(configuration.elements.name).toMatchObject({ x: 100, y: 0, width: 5, height: 100 })
    expect(configuration.elements.price).toMatchObject({ visible: false, x: 35 })
    expect(configuration.elements.price.rotation).toBe(360)
    expect(configuration.elements.image.visible).toBe(true)
    expect(configuration.alcoholBadgeText).toBe('18 ANOS')

    const moved = setProductCardElementLayout(configuration, 'image', { x: 42, y: 58 })
    expect(moved.elements.image).toMatchObject({ x: 42, y: 58 })
    expect(moved.elements.price).toMatchObject({ visible: false })
  })

  it('mantem receitas independentes e resolve o perfil conforme o formato do card', () => {
    const configuration = createDefaultProductCardConfiguration()
    const compact = configuration.profiles!.compact.elements.name
    const standard = configuration.profiles!.standard.elements.name

    compact.x = 18
    expect(standard.x).not.toBe(18)
    expect(resolveProductCardConfigurationProfileKey(120, 150)).toBe('compact')
    expect(resolveProductCardConfigurationProfileKey(620, 280)).toBe('wide')
    // Largo é um formato horizontal; cards altos devem usar o destaque
    // vertical para não aplicar a composição lateral fora dos limites.
    expect(resolveProductCardConfigurationProfileKey(479.5, 757)).toBe('featured')
    expect(resolveProductCardConfigurationProfileKey(520, 520)).toBe('featured')

    expect(resolveProductCardPriceScale(420, 525)).toBe(1)
    expect(resolveProductCardPriceScale(479.5, 757)).toBeGreaterThan(1)
    expect(resolveProductCardPriceScale(180, 260)).toBe(1)
    expect(resolveProductCardPriceScale(2400, 2400)).toBe(1.4)

    const resolved = resolveProductCardConfigurationProfile(configuration, 120, 150)
    expect(resolved.elements.name.x).toBe(configuration.profiles!.compact.elements.name.x)
  })

  it('identifica alcool por flag explicita e por categoria, mas respeita sem alcool', () => {
    expect(isAlcoholicProduct({ name: 'Produto qualquer', isAlcoholic: true })).toBe(true)
    expect(isAlcoholicProduct({ name: 'Cerveja Pilsen 350ml' })).toBe(true)
    expect(isAlcoholicProduct({ category: 'Bebidas', name: 'Refrigerante zero alcool' })).toBe(false)
    expect(isAlcoholicProduct({ name: 'Leite integral' })).toBe(false)
  })

  it('preserva a posicao manual de filhos quando a receita do card e reaplicada', () => {
    const manualImage = makeTransformObject({
      __manualTransform: true,
      left: 74,
      top: -38,
      scaleX: 1.7,
      scaleY: 1.7
    })
    const duplicateImage = makeTransformObject({
      __manualTransform: true,
      left: 74,
      top: -38,
      scaleX: 1.7,
      scaleY: 1.7
    })
    const automaticImage = makeTransformObject({ left: 0, top: 0 })
    const objects = [manualImage, duplicateImage, automaticImage]
    const group: any = {
      type: 'group',
      getObjects: () => objects,
      _objects: objects,
      _productData: {},
      setCoords() {}
    }
    const configuration = createDefaultProductCardConfiguration()
    configuration.alcoholBadgeEnabled = false
    configuration.profiles!.wide.elements.image.x = 20
    const layout = createProductCardConfigurationLayout({
      fabric: () => ({}),
      enableCardElementRotationControl: () => {},
      safeRequestRenderAll: () => {},
      getPriceGroupFromAny: () => null
    })

    layout.applyProductCardConfigurationLayout(group, 500, 300, {
      cardLayout: configuration
    })

    expect(manualImage).toMatchObject({ left: 74, top: -38, scaleX: 1.7, scaleY: 1.7 })
    expect(duplicateImage).toMatchObject({ left: 74, top: -38, scaleX: 1.7, scaleY: 1.7 })
    expect(automaticImage.left).not.toBe(0)
    expect(automaticImage.top).not.toBe(0)
  })

  it('mantem imagem e etiqueta automaticas dentro do card mesmo em receita lateral antiga', () => {
    const image = makeTransformObject({
      width: 348,
      height: 223,
      left: 0,
      top: 0
    })
    const price = makeTransformObject({
      type: 'group',
      name: 'priceGroup',
      width: 469.91,
      height: 180.73,
      left: 0,
      top: 0
    })
    const objects = [image, price]
    const group: any = {
      type: 'group',
      __cardConfigurationProfile: 'wide',
      getObjects: () => objects,
      _objects: objects,
      _productData: {},
      setCoords() {}
    }
    const configuration = createDefaultProductCardConfiguration()
    configuration.alcoholBadgeEnabled = false
    const layout = createProductCardConfigurationLayout({
      fabric: () => ({}),
      enableCardElementRotationControl: () => {},
      safeRequestRenderAll: () => {},
      getPriceGroupFromAny: () => price
    })

    layout.applyProductCardConfigurationLayout(group, 479.5, 757, {
      cardLayout: configuration
    })

    const halfWidth = 479.5 / 2
    for (const object of [image, price]) {
      const halfObjectWidth = object.getScaledWidth() / 2
      expect(object.left - halfObjectWidth).toBeGreaterThanOrEqual(-halfWidth - 0.01)
      expect(object.left + halfObjectWidth).toBeLessThanOrEqual(halfWidth + 0.01)
    }
  })

  it('preserva a ancora movida da etiqueta, mas reaplica o tamanho da receita sem acumular escala', () => {
    const price = makeTransformObject({
      type: 'group',
      name: 'priceGroup',
      width: 824,
      height: 333,
      left: 60,
      top: 35,
      __manualPricePosition: true,
      __manualTransform: true
    })
    const objects = [price]
    const group: any = {
      type: 'group',
      getObjects: () => objects,
      _objects: objects,
      _productData: {},
      setCoords() {}
    }
    const configuration = createDefaultProductCardConfiguration()
    configuration.alcoholBadgeEnabled = false
    const layout = createProductCardConfigurationLayout({
      fabric: () => ({}),
      enableCardElementRotationControl: () => {},
      safeRequestRenderAll: () => {},
      getPriceGroupFromAny: () => price
    })

    layout.applyProductCardConfigurationLayout(group, 500, 300, {
      cardLayout: configuration
    })

    const firstScale = price.scaleX
    const firstWidth = price.getScaledWidth()
    const firstHeight = price.getScaledHeight()
    expect(price.left).toBe(60)
    expect(price.top).toBe(35)
    expect(firstWidth).toBeLessThanOrEqual(500 * 0.58 + 0.01)
    expect(firstHeight).toBeLessThanOrEqual(300 * 0.24 + 0.01)

    layout.applyProductCardConfigurationLayout(group, 500, 300, {
      cardLayout: configuration
    })

    expect(price.left).toBe(60)
    expect(price.top).toBe(35)
    expect(price.scaleX).toBeCloseTo(firstScale, 6)
    expect(price.getScaledWidth()).toBeCloseTo(firstWidth, 6)
    expect(price.getScaledHeight()).toBeCloseTo(firstHeight, 6)
  })
})

it('oferece perfil próprio para card estreito sem substituir receitas existentes', () => {
  const config = normalizeProductCardConfiguration({ profiles: { standard: { elements: { image: { width: 75 } } } } } as any)
  expect(resolveProductCardConfigurationProfileKey(90, 270)).toBe('tall')
  expect(config.profiles?.tall.elements.image.width).toBe(94)
  expect(config.profiles?.tall.elements.image.height).toBe(68)
  expect(config.profiles?.standard.elements.image.width).toBe(75)
})
