import { describe, it, expect } from 'vitest'
import { layoutManualTemplateGroup } from '~/utils/priceManualTemplateLayout'

const makeObj = (init: any = {}) => ({
  type: init.type ?? 'rect',
  name: init.name ?? '',
  left: init.left ?? 0,
  top: init.top ?? 0,
  width: init.width ?? 100,
  height: init.height ?? 40,
  scaleX: init.scaleX ?? 1,
  scaleY: init.scaleY ?? 1,
  originX: init.originX ?? 'center',
  originY: init.originY ?? 'center',
  visible: init.visible ?? true,
  set(values: any) {
    Object.assign(this, values)
  },
  setCoords() {},
  getScaledWidth() {
    return Math.abs(Number(this.width || 0) * Number(this.scaleX || 1))
  },
  getScaledHeight() {
    return Math.abs(Number(this.height || 0) * Number(this.scaleY || 1))
  }
})

const makeGroup = (children: any[], init: any = {}) => ({
  type: 'group',
  name: 'priceGroup',
  left: init.left ?? 0,
  top: init.top ?? 0,
  width: init.width ?? 100,
  height: init.height ?? 40,
  scaleX: init.scaleX ?? 1,
  scaleY: init.scaleY ?? 1,
  originX: init.originX ?? 'center',
  originY: init.originY ?? 'center',
  __manualTemplateBaseW: init.__manualTemplateBaseW,
  __manualTemplateBaseH: init.__manualTemplateBaseH,
  _objects: children,
  getObjects() {
    return this._objects
  },
  set(values: any) {
    Object.assign(this, values)
  },
  setCoords() {},
  getScaledWidth() {
    return Math.abs(Number(this.width || 0) * Number(this.scaleX || 1))
  },
  getScaledHeight() {
    return Math.abs(Number(this.height || 0) * Number(this.scaleY || 1))
  }
})

const deps = {
  collectObjectsDeep: (obj: any) => [obj, ...(obj.getObjects?.() || [])],
  findByName: (objects: any[], name: string) => objects.find((o) => o?.name === name),
  isTextLikeObject: (obj: any) => ['text', 'i-text', 'textbox'].includes(String(obj?.type || '').toLowerCase()),
  isRedBurstPriceGroup: () => false,
  tuneRedBurstPriceGroupLayout: () => {}
}

describe('layoutManualTemplateGroup', () => {
  it('preserva base persistida mesmo quando bounds/texto dinamico ficam maiores', () => {
    const priceBg = makeObj({ name: 'price_bg', width: 300, height: 120 })
    const longInteger = makeObj({
      type: 'text',
      name: 'price_integer_text',
      left: 0,
      width: 520,
      height: 70,
      originX: 'left'
    })
    const decimal = makeObj({
      type: 'text',
      name: 'price_decimal_text',
      left: 525,
      width: 80,
      height: 40,
      originX: 'left'
    })
    const group = makeGroup([priceBg, longInteger, decimal], {
      width: 640,
      height: 160,
      __manualTemplateBaseW: 300,
      __manualTemplateBaseH: 120
    })

    const result = layoutManualTemplateGroup(group, 400, 300, deps)

    expect(result).not.toBeNull()
    expect(group.__manualTemplateBaseW).toBe(300)
    expect(group.__manualTemplateBaseH).toBe(120)
    expect(group.width).toBe(300)
    expect(group.height).toBe(120)
  })

  it('migra base ausente usando dimensoes inferidas uma unica vez', () => {
    const priceBg = makeObj({ name: 'price_bg', width: 280, height: 100 })
    const group = makeGroup([priceBg], { width: 280, height: 100 })

    layoutManualTemplateGroup(group, 400, 300, deps)

    expect(group.__manualTemplateBaseW).toBe(280)
    expect(group.__manualTemplateBaseH).toBe(100)
  })
})
