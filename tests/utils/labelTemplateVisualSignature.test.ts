import { describe, expect, it } from 'vitest'
import {
  buildLabelTemplateVisualSignature,
  labelTemplateVisualSignaturesEqual
} from '~/utils/labelTemplateVisualSignature'

describe('labelTemplateVisualSignature', () => {
  const template = {
    type: 'Group',
    name: 'priceGroup',
    objects: [
      { type: 'Rect', name: 'price_bg', fill: '#000000', stroke: 'rgba(0,0,0,0)', strokeWidth: 0 },
      { type: 'Text', name: 'price_currency_text', fill: '#FFD600', fontFamily: 'Barlow', fontWeight: '900', text: 'R$' },
      { type: 'IText', name: 'price_integer_text', fill: '#ffffff', fontFamily: 'Barlow', fontWeight: '900', text: '18' }
    ]
  }

  it('ignora preço, posição e escala, mas detecta cor visual divergente', () => {
    const inherited = {
      ...template,
      left: 72,
      top: 40,
      scaleX: 0.7,
      scaleY: 0.8,
      objects: template.objects.map((object, index) => ({
        ...object,
        left: index * 10,
        top: index * 5,
        text: index === 1 ? 'R$' : '49,90'
      }))
    }
    expect(labelTemplateVisualSignaturesEqual(inherited, template)).toBe(true)

    const stale = {
      ...inherited,
      objects: inherited.objects.map((object) => object.name === 'price_bg'
        ? { ...object, fill: '#e11d48', stroke: '#e11d48' }
        : object)
    }
    expect(labelTemplateVisualSignaturesEqual(stale, template)).toBe(false)
  })

  it('aceita objetos Fabric-like com getObjects()', () => {
    const fabricLike = {
      type: 'group',
      getObjects: () => template.objects.map(object => ({ ...object, type: object.type.toLowerCase() }))
    }
    expect(buildLabelTemplateVisualSignature(fabricLike)).toContain('price_bg')
  })

  it('trata preço dividido e rich text como a mesma aparência', () => {
    const splitTemplate = {
      ...template,
      objects: [
        ...template.objects,
        { type: 'IText', name: 'price_decimal_text', fill: '#ffffff', fontFamily: 'Barlow', fontWeight: '900', text: ',99' }
      ]
    }
    const rich = {
      ...splitTemplate,
      objects: splitTemplate.objects.map((object) => object.name === 'price_integer_text'
        ? {
            ...object,
            name: 'price_value_text',
            __priceRichText: true,
            __priceRichIntegerStyle: { fill: '#ffffff', fontFamily: 'Barlow', fontWeight: '900' },
            __priceRichDecimalStyle: { fill: '#ffffff', fontFamily: 'Barlow', fontWeight: '900' },
            text: '18,99'
          }
        : object.name === 'price_currency_text' || object.name === 'price_bg'
          ? object
          : null
      ).filter(Boolean)
    }

    expect(labelTemplateVisualSignaturesEqual(rich, splitTemplate)).toBe(true)
  })
})
