import { describe, it, expect, vi } from 'vitest'
import { setText, setVisible, assignNewCustomIdsDeep } from '~/utils/fabricObjectOps'

const makeText = (overrides: any = {}) => {
  const calls: Array<{ k: any; v?: any }> = []
  return {
    type: 'i-text',
    text: 'old',
    scaleX: 1,
    scaleY: 1,
    visible: true,
    initCalls: 0,
    set(k: any, v?: any) {
      if (typeof k === 'string') {
        calls.push({ k, v })
        ;(this as any)[k] = v
      } else {
        Object.entries(k).forEach(([key, val]) => {
          calls.push({ k: key, v: val })
          ;(this as any)[key] = val
        })
      }
    },
    initDimensions(this: any) {
      this.initCalls += 1
    },
    _calls: calls,
    ...overrides
  } as any
}

describe('setText', () => {
  it('atualiza texto e chama initDimensions', () => {
    const t = makeText({ text: 'hello' })
    setText(t, 'world')
    expect(t.text).toBe('world')
    expect(t.initCalls).toBe(1)
  })

  it('no-op silencioso quando obj e null', () => {
    expect(() => setText(null, 'x')).not.toThrow()
    expect(() => setText(undefined, 'x')).not.toThrow()
  })

  it('no-op quando obj nao tem .set()', () => {
    const fake = { type: 'rect' }
    expect(() => setText(fake, 'x')).not.toThrow()
  })

  it('aceita objeto sem initDimensions (Fabric antigo)', () => {
    const t = makeText({})
    delete (t as any).initDimensions
    expect(() => setText(t, 'novo')).not.toThrow()
    expect(t.text).toBe('novo')
  })
})

describe('setVisible', () => {
  it('hide: salva escala atual e colapsa para scale=0 + visible=false', () => {
    const t = makeText({ scaleX: 1.5, scaleY: 2 })
    setVisible(t, false)
    expect(t.__visibleScaleX).toBe(1.5)
    expect(t.__visibleScaleY).toBe(2)
    expect(t.scaleX).toBe(0)
    expect(t.scaleY).toBe(0)
    expect(t.visible).toBe(false)
  })

  it('show apos hide: restaura a escala salva', () => {
    const t = makeText({ scaleX: 1.5, scaleY: 1.5 })
    setVisible(t, false)
    setVisible(t, true)
    expect(t.scaleX).toBe(1.5)
    expect(t.scaleY).toBe(1.5)
    expect(t.visible).toBe(true)
  })

  it('show sem hide previo: usa __originalScaleX/Y como fallback', () => {
    const t = makeText({ scaleX: 0, scaleY: 0, __originalScaleX: 0.8, __originalScaleY: 0.8 })
    setVisible(t, true)
    expect(t.scaleX).toBe(0.8)
    expect(t.scaleY).toBe(0.8)
  })

  it('show com escala atual valida usa o valor atual como fallback', () => {
    const t = makeText({ scaleX: 1.2, scaleY: 1.2 })
    // sem __visibleScaleX nem __originalScaleX → fallback é a escala atual
    setVisible(t, true)
    expect(t.scaleX).toBe(1.2)
    expect(t.scaleY).toBe(1.2)
  })

  it('clamp: escala salva absurda é trimmed para [0.08, 3.2]', () => {
    const t = makeText({})
    t.__visibleScaleX = 99 // acima do max
    t.__visibleScaleY = 0.001 // abaixo do min
    setVisible(t, true)
    expect(t.scaleX).toBe(3.2)
    expect(t.scaleY).toBe(0.08)
  })

  it('clamp preserva sinal (flip negativo)', () => {
    const t = makeText({})
    t.__visibleScaleX = -50
    t.__visibleScaleY = -0.0001
    setVisible(t, true)
    expect(t.scaleX).toBe(-3.2)
    expect(t.scaleY).toBe(-0.08)
  })

  it('hide nao salva escalas zero/invalidas (preserva snapshot anterior)', () => {
    const t = makeText({ scaleX: 0, scaleY: 1.7 })
    setVisible(t, false)
    expect(t.__visibleScaleX).toBeUndefined() // nao salvou (era 0)
    expect(t.__visibleScaleY).toBe(1.7)
  })

  it('no-op silencioso quando obj e null', () => {
    expect(() => setVisible(null, true)).not.toThrow()
    expect(() => setVisible(undefined, false)).not.toThrow()
  })

  it('roundtrip hide→show preserva escala original mesmo apos colapso', () => {
    const t = makeText({ scaleX: 1.3, scaleY: 0.9 })
    setVisible(t, false) // colapsa
    expect(t.scaleX).toBe(0)
    setVisible(t, true)  // restaura
    expect(t.scaleX).toBe(1.3)
    expect(t.scaleY).toBe(0.9)
  })
})

describe('assignNewCustomIdsDeep', () => {
  const group = (overrides: any = {}, children: any[] = []) => ({
    type: 'group',
    _customId: 'orig-' + Math.random(),
    getObjects: () => children,
    ...overrides
  })

  it('null/undefined nao quebra', () => {
    expect(() => assignNewCustomIdsDeep(null)).not.toThrow()
    expect(() => assignNewCustomIdsDeep(undefined)).not.toThrow()
  })

  it('atribui novo _customId e preserva o anterior em __duplicateSourceCustomId', () => {
    const obj: any = { _customId: 'old-id' }
    assignNewCustomIdsDeep(obj)
    expect(obj.__duplicateSourceCustomId).toBe('old-id')
    expect(obj._customId).not.toBe('old-id')
    expect(typeof obj._customId).toBe('string')
    expect(obj._customId.length).toBeGreaterThan(0)
  })

  it('desce recursivamente em getObjects()', () => {
    const leaf = { _customId: 'leaf-old' }
    const inner = group({ _customId: 'inner-old' }, [leaf])
    const root = group({ _customId: 'root-old' }, [inner])
    assignNewCustomIdsDeep(root)
    expect(root._customId).not.toBe('root-old')
    expect(inner._customId).not.toBe('inner-old')
    expect(leaf._customId).not.toBe('leaf-old')
    expect(root.__duplicateSourceCustomId).toBe('root-old')
    expect(inner.__duplicateSourceCustomId).toBe('inner-old')
    expect(leaf.__duplicateSourceCustomId).toBe('leaf-old')
  })

  it('IDs gerados sao unicos entre chamadas', () => {
    const a: any = {}
    const b: any = {}
    const c: any = {}
    assignNewCustomIdsDeep(a)
    assignNewCustomIdsDeep(b)
    assignNewCustomIdsDeep(c)
    expect(a._customId).not.toBe(b._customId)
    expect(b._customId).not.toBe(c._customId)
    expect(a._customId).not.toBe(c._customId)
  })

  it('REGRESSAO: nao desce em objetos sem getObjects (Fabric leafs)', () => {
    // Um text/rect nao deve causar erro mesmo sem getObjects
    const leaf: any = { type: 'rect', _customId: 'rect-1' }
    expect(() => assignNewCustomIdsDeep(leaf)).not.toThrow()
    expect(leaf._customId).not.toBe('rect-1')
  })

  it('lida com getObjects que retorna null', () => {
    const g: any = { getObjects: () => null, _customId: 'g1' }
    expect(() => assignNewCustomIdsDeep(g)).not.toThrow()
  })

  it('preserva campos nao relacionados', () => {
    const obj: any = { _customId: 'old', text: 'hello', other: 42 }
    assignNewCustomIdsDeep(obj)
    expect(obj.text).toBe('hello')
    expect(obj.other).toBe(42)
  })
})
