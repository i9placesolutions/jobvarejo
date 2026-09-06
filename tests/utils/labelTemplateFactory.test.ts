import { describe, expect, it } from 'vitest'
import { createEditableLabelTemplateGroup } from '~/utils/labelTemplateFactory'
import { isRichPriceTextObject } from '~/utils/priceRichText'

const getObjects = (template: any) => template?.objects || []

describe('createEditableLabelTemplateGroup', () => {
  it('cria uma etiqueta manual com os anchors que o editor usa', () => {
    const template = createEditableLabelTemplateGroup()
    const objects = getObjects(template)
    const names = objects.map((object: any) => object.name)

    expect(template.type).toBe('group')
    expect(template.__preserveManualLayout).toBe(true)
    expect(template.__isCustomTemplate).toBe(true)
    expect(template.__manualTemplateBaseW).toBe(320)
    expect(template.__manualTemplateBaseH).toBe(180)
    expect(names).toEqual([
      'price_bg',
      'price_currency_text',
      'price_value_text',
      'price_unit_text'
    ])
    expect(isRichPriceTextObject(objects[2])).toBe(true)
  })

  it('inclui imagem de fundo e conserva o preço editável', () => {
    const template = createEditableLabelTemplateGroup({
      imageSrc: 'https://cdn.example.com/label.png',
      imageWidth: 1600,
      imageHeight: 900
    })
    const objects = getObjects(template)
    const background = objects.find((object: any) => object.name === 'price_bg')
    const image = objects.find((object: any) => object.name === 'price_bg_image')
    const price = objects.find((object: any) => object.name === 'price_value_text')

    expect(template.__manualTemplateBaseW).toBeLessThanOrEqual(320)
    expect(template.__manualTemplateBaseH).toBeLessThanOrEqual(260)
    expect(background.fill).toBe('transparent')
    expect(image.src).toBe('https://cdn.example.com/label.png')
    expect(image.selectable).toBe(false)
    expect(price.text).toBe('22,99')
    expect(isRichPriceTextObject(price)).toBe(true)
  })

  it('limita dimensoes invalidas ou extremas sem perder a estrutura', () => {
    const template = createEditableLabelTemplateGroup({
      imageSrc: 'data:image/png;base64,abc',
      imageWidth: Number.POSITIVE_INFINITY,
      imageHeight: -10
    })

    expect(template.__manualTemplateBaseW).toBeLessThanOrEqual(320)
    expect(template.__manualTemplateBaseH).toBeLessThanOrEqual(260)
    expect(getObjects(template).some((object: any) => object.name === 'price_value_text')).toBe(true)
  })
})
