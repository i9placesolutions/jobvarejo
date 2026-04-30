import { describe, it, expect, vi } from 'vitest'
import { setText, setVisible } from '~/utils/fabricObjectOps'

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
