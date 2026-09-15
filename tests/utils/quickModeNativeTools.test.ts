import { describe, expect, it } from 'vitest'
import {
  collectQuickEditableColorTargets,
  collectQuickNativeColorTargets,
  collectQuickNativeObjects,
  isQuickNativeExcludedObject
} from '~/utils/quickModeNativeTools'

const group = (children: any[], overrides: Record<string, any> = {}) => ({
  type: 'group',
  getObjects: () => children,
  ...overrides
})

describe('quickModeNativeTools', () => {
  it('mantém textos e formas nativas e ignora imagem/fundo estrutural', () => {
    const text = { type: 'textbox', fill: '#172033' }
    const shape = { type: 'rect', fill: '#ffffff' }
    const image = { type: 'image', src: 'background.webp' }
    const frame = { type: 'rect', isFrame: true, fill: '#fff7ed' }

    expect(collectQuickNativeObjects([text, shape, image, frame])).toEqual([text, shape])
    expect(isQuickNativeExcludedObject(image)).toBe(true)
    expect(isQuickNativeExcludedObject(frame)).toBe(true)
  })

  it('bloqueia toda a árvore de um card de produto', () => {
    const productText = { type: 'text', fill: '#111111' }
    const productImage = { type: 'image', src: 'product.webp' }
    const card = group([productText, productImage], { isProductCard: true })

    expect(collectQuickNativeObjects([card])).toEqual([])
    expect(collectQuickNativeColorTargets([card])).toEqual([])
  })

  it('separa a propriedade de cor sem transformar imagem em alvo', () => {
    const text = { type: 'text', fill: '#111111' }
    const line = { type: 'line', fill: 'transparent', stroke: '#222222' }
    const image = { type: 'image', fill: '#fff' }

    expect(collectQuickNativeColorTargets([text, line, image])).toEqual([
      { object: text, property: 'fill' },
      { object: line, property: 'stroke' }
    ])
  })

  it('expõe fundo do card e formas da etiqueta como alvos separados', () => {
    const cardBackground = { type: 'rect', name: 'offerBackground', fill: '#ffffff', opacity: 1 }
    const labelBackground = { type: 'rect', name: 'price_bg', fill: '#000000', opacity: 1 }
    const labelText = { type: 'text', name: 'price_integer_text', fill: '#ffffff' }
    const productImage = { type: 'image', name: 'productImage' }
    const card = group([cardBackground, productImage, group([labelBackground, labelText], { name: 'priceGroup' })], {
      name: 'product-card',
      isProductCard: true
    })

    const targets = collectQuickEditableColorTargets([card])

    expect(new Set(targets.map(target => target.id)).size).toBe(2)
    expect(collectQuickEditableColorTargets([card]).map(target => target.id)).toEqual(targets.map(target => target.id))
    expect(targets[0]?.objects).toEqual([{ object: cardBackground, property: 'fill' }])
    expect(targets[1]?.objects).toEqual([{ object: labelBackground, property: 'fill' }])
    expect(targets[1]?.objects.some(item => item.object === labelText)).toBe(false)
  })

  it('mantém alvos de cor como estado da página e permite fundo sem cor', () => {
    const cardBackground = { type: 'rect', name: 'offerBackground', fill: 'transparent', opacity: 0.72 }
    const card = group([cardBackground], { name: 'product-card', isSmartObject: true })
    const target = collectQuickEditableColorTargets([card])[0]

    expect(target?.canClear).toBe(true)
    expect(target?.color).toBe(null)
    expect(target?.opacity).toBe(0.72)
  })
})

it('expõe o quadro bloqueado sem misturar cards, moldura ou fundo da arte', () => {
  const panel = { type: 'rect', name: 'product-area-background', _customId: 'panel', fill: '#fffbee', stroke: '#ffd600', selectable: false, isQuickGenerated: true }
  const frame = { type: 'rect', isFrame: true, fill: '#ffffff' }
  const card = { type: 'rect', name: 'offerBackground', fill: '#ffffff' }
  const targets = collectQuickEditableColorTargets([panel, frame, group([card], { isProductCard: true })])
  const target = targets.find(t => t.kind === 'product-area')!
  expect(target.label).toBe('Fundo da área de produtos')
  expect(target.objects).toEqual([{ object: panel, property: 'fill' }])
  expect(targets.filter(t => t.objects.some(x => x.object === panel))).toHaveLength(1)
  target.objects[0]!.object.fill = '#123456'
  const restored = JSON.parse(JSON.stringify(panel))
  expect(collectQuickEditableColorTargets([restored])[0]?.color).toBe('#123456')
  expect(restored.stroke).toBe('#ffd600')
  expect(card.fill).toBe('#ffffff')
  expect(frame.fill).toBe('#ffffff')
})

it('permite recolorir quadros transparentes agrupados sem alterar sua borda', () => {
  const panel = { type: 'rect', name: 'product-area-background', fill: 'transparent', stroke: '#ffd600' }
  const targets = collectQuickEditableColorTargets([group([panel])])
  expect(targets).toHaveLength(1)
  expect(targets[0]?.kind).toBe('product-area')
  expect(targets[0]?.objects[0]?.property).toBe('fill')
})
