import { describe, expect, it } from 'vitest'
import {
  applyRichPriceTextValue,
  createRichPriceTextDefinition,
  getRichPriceSegmentOffset,
  getRichPriceSegmentFontSize,
  isRichPriceTextObject,
  installRichPriceTextRenderer,
  migratePriceGroupToRichText,
  positionRichPriceUnit,
  setRichPriceSegmentOffset,
  setRichPriceSegmentStyle
} from '~/utils/priceRichText'

class FakeRichText {
  type = 'i-text'
  text = ''
  width = 0
  height = 0
  fontSize = 20
  fontFamily = 'Inter'
  fontStyle = 'normal'
  fontWeight: string | number = '400'
  scaleX = 1
  scaleY = 1
  group: any = null

  constructor(text: string, options: Record<string, any> = {}) {
    this.text = text
    Object.assign(this, options)
    this.initDimensions()
  }

  set(property: string | Record<string, any>, value?: any) {
    if (typeof property === 'string') (this as any)[property] = value
    else Object.assign(this, property)
    return this
  }

  initDimensions() {
    this.width = Math.max(1, String(this.text || '').length * Number(this.fontSize || 20) * 0.5)
    this.height = Math.max(1, Number(this.fontSize || 20))
  }

  getScaledWidth() {
    return this.width * Math.abs(Number(this.scaleX || 1))
  }

  getScaledHeight() {
    return this.height * Math.abs(Number(this.scaleY || 1))
  }

  setCoords() {}
}

const createSplitParent = () => {
  const integer = new FakeRichText('12', {
    name: 'price_integer_text',
    fontSize: 20,
    left: 10,
    top: 20,
    originX: 'left',
    originY: 'center',
    fill: '#fff'
  })
  const decimal = new FakeRichText(',99', {
    name: 'price_decimal_text',
    fontSize: 12,
    left: 34,
    top: 18,
    originX: 'left',
    originY: 'center',
    fill: '#ff0'
  })
  const parent: any = {
    _objects: [integer, decimal],
    getObjects() {
      return this._objects
    },
    remove(...objects: any[]) {
      this._objects = this._objects.filter((object: any) => !objects.includes(object))
      return objects
    },
    insertAt(index: number, object: any) {
      this._objects.splice(index, 0, object)
      object.group = this
    },
    triggerLayout() {},
    setCoords() {}
  }
  integer.group = parent
  decimal.group = parent
  return { parent, integer, decimal }
}

describe('priceRichText — inteiro e centavos em um único texto', () => {
  it('cria estilos independentes por faixa de caracteres', () => {
    const definition = createRichPriceTextDefinition({
      text: '10,99',
      fontSize: 80,
      integerStyle: { fontSize: 80, fill: '#fff' },
      decimalStyle: { fontSize: 42, fill: '#ff0' }
    })

    expect(definition.type).toBe('i-text')
    expect(definition.name).toBe('price_value_text')
    expect(definition.__priceRichText).toBe(true)
    expect(definition.text).toBe('10,99')
    expect(definition.styles[0][0].fontSize).toBe(80)
    expect(definition.styles[0][1].fontSize).toBe(80)
    expect(definition.styles[0][2].fontSize).toBe(42)
    expect(definition.styles[0][3].fontSize).toBe(42)
    expect(definition.styles[0][4].fontSize).toBe(42)
  })

  it('atualiza o valor sem perder o tamanho de cada trecho', () => {
    const object: any = {
      ...createRichPriceTextDefinition({ text: '10,99', fontSize: 80 }),
      initDimensions: () => undefined,
      setCoords: () => undefined
    }

    applyRichPriceTextValue(object, '1.299,99')

    expect(object.text).toBe('1299,99')
    expect(getRichPriceSegmentFontSize(object, 'integer', 0)).toBe(80)
    expect(getRichPriceSegmentFontSize(object, 'decimal', 0)).toBe(44)
    expect(Object.keys(object.styles[0])).toEqual(['0', '1', '2', '3', '4', '5', '6'])
  })

  it('permite alterar apenas o tamanho dos centavos', () => {
    const object: any = {
      ...createRichPriceTextDefinition({ text: '10,99', fontSize: 80 }),
      initDimensions: () => undefined,
      setCoords: () => undefined
    }

    setRichPriceSegmentStyle(object, 'decimal', { fontSize: 28 })

    expect(getRichPriceSegmentFontSize(object, 'integer', 0)).toBe(80)
    expect(getRichPriceSegmentFontSize(object, 'decimal', 0)).toBe(28)
    expect(object.styles[0][0].fontSize).toBe(80)
    expect(object.styles[0][2].fontSize).toBe(28)
  })

  it('persiste offsets X/Y independentes por segmento', () => {
    const object: any = {
      ...createRichPriceTextDefinition({ text: '10,99', fontSize: 80 }),
      initDimensions: () => undefined,
      setCoords: () => undefined
    }

    expect(setRichPriceSegmentOffset(object, 'decimal', 'x', 7.5)).toBe(true)
    expect(setRichPriceSegmentOffset(object, 'decimal', 'y', -4)).toBe(true)
    expect(getRichPriceSegmentOffset(object, 'decimal', 'x')).toBe(7.5)
    expect(getRichPriceSegmentOffset(object, 'decimal', 'y')).toBe(-4)
    expect(object.styles[0][2].__priceRichOffsetX).toBe(7.5)
    expect(object.styles[0][2].__priceRichOffsetY).toBe(-4)
  })

  it('migra inteiro e centavos legados para um único objeto mantendo a posição relativa', () => {
    const { parent, integer, decimal } = createSplitParent()
    integer.fontFamily = 'Arial'
    integer.fontStyle = 'italic'
    integer.fontWeight = 700
    decimal.fontFamily = 'Arial'
    decimal.fontStyle = 'normal'
    decimal.fontWeight = 400
    const result = migratePriceGroupToRichText(parent, { IText: FakeRichText })
    const rich = parent.getObjects()[0]

    expect(result.changed).toBe(true)
    expect(result.richObjects).toContain(rich)
    expect(rich.name).toBe('price_value_text')
    expect(isRichPriceTextObject(rich)).toBe(true)
    expect(rich.text).toBe('12,99')
    expect(getRichPriceSegmentOffset(rich, 'decimal', 'x')).toBeCloseTo(4)
    expect(getRichPriceSegmentOffset(rich, 'decimal', 'y')).toBeCloseTo(-2)
    expect(rich.__priceRichIntegerStyle.fontFamily).toBe('Arial')
    expect(rich.__priceRichIntegerStyle.fontStyle).toBe('italic')
    expect(rich.styles[0][0].fontFamily).toBe('Arial')
    expect(rich.styles[0][2].fontStyle).toBe('normal')
    expect(parent.getObjects()).not.toContain(integer)
    expect(parent.getObjects()).not.toContain(decimal)
  })

  it('aplica offsets no ponto de renderização de cada caractere', () => {
    class RenderText {
      _getStyleDeclaration() {
        return { __priceRichOffsetX: 6, __priceRichOffsetY: -3 }
      }

      _renderChar(...args: any[]) {
        return args
      }
    }

    installRichPriceTextRenderer({ Text: RenderText })
    const object: any = new (RenderText as any)()
    object.__priceRichText = true
    const result = object._renderChar('fillText', {}, 0, 2, 'x', 10, 20)

    expect(result[5]).toBe(16)
    expect(result[6]).toBe(17)
  })

  it('não classifica o preço legado como texto rico só porque o Fabric criou styles', () => {
    expect(isRichPriceTextObject({
      name: 'price_value_text',
      text: '10,99',
      styles: {}
    })).toBe(false)
  })

  it('mantém UN sob os centavos quando o preço rico muda de largura', () => {
    const makeRich = (text: string, charBounds: any[]) => ({
      __priceRichText: true,
      name: 'price_value_text',
      text,
      left: 10,
      top: 0,
      width: charBounds.reduce((total, item) => total + Number(item.width || 0), 0),
      scaleX: 1,
      scaleY: 1,
      originX: 'left',
      originY: 'center',
      styles: { 0: {} },
      __charBounds: [charBounds],
      initDimensions: () => undefined,
      getScaledWidth() {
        return this.width
      }
    })
    const unit: any = {
      text: 'UN',
      width: 20,
      scaleX: 1,
      scaleY: 1,
      visible: true,
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      set(property: string | Record<string, any>, value?: any) {
        if (typeof property === 'string') this[property] = value
        else Object.assign(this, property)
      },
      getScaledWidth() {
        return this.width * this.scaleX
      },
      initDimensions: () => undefined,
      setCoords: () => undefined
    }

    const oneDigit = makeRich('9,99', [
      { left: 0, width: 40 },
      { left: 40, width: 10 },
      { left: 50, width: 20 },
      { left: 70, width: 20 }
    ])
    expect(positionRichPriceUnit(oneDigit, unit, 80)).toBe(true)
    expect(unit.left).toBe(75)
    expect(unit.top).toBe(80)
    expect(unit.originX).toBe('center')

    const twoDigits = makeRich('99,99', [
      { left: 0, width: 40 },
      { left: 40, width: 40 },
      { left: 80, width: 10 },
      { left: 90, width: 20 },
      { left: 110, width: 20 }
    ])
    expect(positionRichPriceUnit(twoDigits, unit, 80)).toBe(true)
    expect(unit.left).toBe(115)
  })
})
