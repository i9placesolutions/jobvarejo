import { describe, it, expect, vi } from 'vitest'
import {
  setText,
  setVisible,
  assignNewCustomIdsDeep,
  resetDuplicatedObjectRuntime,
  clearInvalidClipPath,
  applyObjectVisibility
} from '~/utils/fabricObjectOps'

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

describe('resetDuplicatedObjectRuntime', () => {
  const makeNode = (overrides: any = {}, children?: any[]) => {
    const calls: Array<{ k: any; v?: any }> = []
    const o: any = {
      type: 'i-text',
      _activeObjects: ['stale1'],
      _activeObject: { id: 'stale' },
      __corner: 'tr',
      isEditing: true,
      exitEditingCount: 0,
      setCoordsCount: 0,
      initDimensionsCount: 0,
      ...overrides
    }
    o.set = (k: any, v?: any) => {
      if (typeof k === 'string') {
        calls.push({ k, v })
        ;(o as any)[k] = v
      } else {
        Object.entries(k).forEach(([key, val]) => {
          calls.push({ k: key, v: val })
          ;(o as any)[key] = val
        })
      }
    }
    o.exitEditing = () => { o.exitEditingCount += 1; o.isEditing = false }
    o.setCoords = () => { o.setCoordsCount += 1 }
    o.initDimensions = () => { o.initDimensionsCount += 1 }
    if (children) {
      o.getObjects = () => children
    }
    o._calls = calls
    return o
  }

  it('null/undefined nao quebra', () => {
    expect(() => resetDuplicatedObjectRuntime(null)).not.toThrow()
    expect(() => resetDuplicatedObjectRuntime(undefined)).not.toThrow()
  })

  it('limpa _activeObjects, _activeObject e __corner', () => {
    const o = makeNode()
    resetDuplicatedObjectRuntime(o)
    expect(o._activeObjects).toEqual([])
    expect(o._activeObject).toBeUndefined()
    expect(o.__corner).toBeUndefined()
  })

  it('chama exitEditing quando isEditing=true', () => {
    const o = makeNode({ isEditing: true })
    resetDuplicatedObjectRuntime(o)
    expect(o.exitEditingCount).toBe(1)
  })

  it('aplica selectable/evented/hasControls/hasBorders no root', () => {
    const o = makeNode()
    resetDuplicatedObjectRuntime(o)
    expect(o.selectable).toBe(true)
    expect(o.evented).toBe(true)
    expect(o.hasControls).toBe(true)
    expect(o.hasBorders).toBe(true)
    expect(o.objectCaching).toBe(false)
    expect(o.noScaleCache).toBe(false)
    expect(o.statefullCache).toBe(false)
    expect(o.dirty).toBe(true)
  })

  it('NAO marca selectable/evented em filhos (so root)', () => {
    const child = makeNode({ type: 'rect' })
    delete (child as any).selectable
    delete (child as any).evented
    const root = makeNode({}, [child])
    resetDuplicatedObjectRuntime(root)
    expect(root.selectable).toBe(true)
    // child recebeu objectCaching=false mas nao selectable
    expect(child.objectCaching).toBe(false)
    expect(child.selectable).toBeUndefined()
  })

  it('chama initDimensions em texto', () => {
    const o = makeNode({ type: 'i-text' })
    resetDuplicatedObjectRuntime(o)
    expect(o.initDimensionsCount).toBe(1)
  })

  it('chama setCoords em todos os nodes', () => {
    const child = makeNode({ type: 'rect' })
    const root = makeNode({}, [child])
    resetDuplicatedObjectRuntime(root)
    expect(root.setCoordsCount).toBeGreaterThan(0)
    expect(child.setCoordsCount).toBeGreaterThan(0)
  })

  it('product card: aplica subTargetCheck e desabilita selecao em offerBackground', () => {
    const bg = makeNode({ type: 'rect', name: 'offerBackground' })
    const text = makeNode({ type: 'i-text', name: 'smart_title' })
    const card = makeNode({
      type: 'group',
      isProductCard: true
    }, [bg, text])
    resetDuplicatedObjectRuntime(card)
    expect(card.subTargetCheck).toBe(true)
    expect(card.interactive).toBe(true)
    expect(bg.selectable).toBe(false) // background NAO selecionavel
    expect(text.selectable).toBe(true) // texto pode selecionar
  })

  it('REGRESSAO: exitEditing que joga erro nao quebra', () => {
    const o = makeNode({ isEditing: true })
    o.exitEditing = () => { throw new Error('boom') }
    expect(() => resetDuplicatedObjectRuntime(o)).not.toThrow()
  })
})

describe('clearInvalidClipPath', () => {
  const makeObj = (overrides: any = {}) => {
    const o: any = {
      type: 'rect',
      ...overrides
    }
    o.set = (k: string, v: any) => { (o as any)[k] = v }
    return o
  }

  it('null nao quebra', () => {
    expect(() => clearInvalidClipPath(null)).not.toThrow()
    expect(() => clearInvalidClipPath(undefined)).not.toThrow()
  })

  it('objeto sem clipPath e sem _objects: no-op', () => {
    const o = makeObj()
    clearInvalidClipPath(o)
    expect(o.clipPath).toBeUndefined()
  })

  it('clipPath valido permanece intacto', () => {
    const validClip = {
      type: 'rect',
      _objects: [],
      render: () => {}
    }
    const o = makeObj({ clipPath: validClip })
    clearInvalidClipPath(o)
    expect(o.clipPath).toBe(validClip)
  })

  it('clipPath com _objects undefined ganha array vazio (fix-up)', () => {
    const clip = { type: 'rect', render: () => {} }
    const o = makeObj({ clipPath: clip })
    clearInvalidClipPath(o)
    expect(clip._objects).toEqual([])
  })

  it('clipPath com _objects nao-array e removido + limpa _frameClipOwner', () => {
    const o = makeObj({
      clipPath: { type: 'rect', _objects: 'invalido' },
      _frameClipOwner: { id: 'frame-1' }
    })
    clearInvalidClipPath(o)
    expect(o.clipPath).toBeNull()
    expect(o._frameClipOwner).toBeUndefined()
  })

  it('clipPath nested invalido tambem dispara remocao', () => {
    const o = makeObj({
      clipPath: {
        type: 'rect',
        _objects: [],
        clipPath: { _objects: 'invalido' }
      }
    })
    clearInvalidClipPath(o)
    expect(o.clipPath).toBeNull()
  })

  it('clipPath que falha em isValidClipPath e removido', () => {
    // sem render -> isValidClipPath retorna false
    const o = makeObj({
      clipPath: { type: 'rect', _objects: [] }
    })
    clearInvalidClipPath(o)
    expect(o.clipPath).toBeNull()
  })

  it('_objects nao-array no proprio objeto vira array vazio', () => {
    const o = makeObj({ _objects: 'foo' })
    clearInvalidClipPath(o)
    expect(o._objects).toEqual([])
  })

  it('recursive=true desce em _objects array', () => {
    const child: any = makeObj({
      _objects: 'invalido' // sera consertado
    })
    const root = makeObj({
      _objects: [child]
    })
    clearInvalidClipPath(root, true)
    expect(child._objects).toEqual([])
  })

  it('recursive=true desce em getObjects()', () => {
    const child: any = makeObj({
      clipPath: { type: 'rect', _objects: 'invalido' }
    })
    const root: any = makeObj({
      type: 'group',
      getObjects: () => [child]
    })
    clearInvalidClipPath(root, true)
    expect(child.clipPath).toBeNull()
  })

  it('recursive=false NAO desce em filhos', () => {
    const child: any = makeObj({
      _objects: 'invalido'
    })
    const root: any = makeObj({
      _objects: [child]
    })
    clearInvalidClipPath(root, false)
    expect(child._objects).toBe('invalido') // nao tocado
  })

  it('REGRESSAO: erro silencioso quando obj.set falha', () => {
    const o: any = {
      type: 'rect',
      clipPath: { type: 'rect', _objects: 'bad' },
      set: () => { throw new Error('boom') }
    }
    expect(() => clearInvalidClipPath(o)).not.toThrow()
  })
})

describe('applyObjectVisibility', () => {
  const makeEntry = (overrides: any = {}) => {
    const o: any = {
      visible: true,
      evented: true,
      selectable: true,
      ...overrides
    }
    o.set = (k: any, v: any) => {
      if (typeof k === 'string') (o as any)[k] = v
      else Object.assign(o, k)
    }
    o.setCoords = () => { o.setCoordsCount = (o.setCoordsCount || 0) + 1 }
    return o
  }

  it('null/undefined nao quebra', () => {
    expect(() => applyObjectVisibility(null, false)).not.toThrow()
    expect(() => applyObjectVisibility(undefined, true)).not.toThrow()
  })

  it('hide: salva evented/selectable em backups e zera', () => {
    const o = makeEntry({ evented: true, selectable: true })
    applyObjectVisibility(o, false)
    expect(o.visible).toBe(false)
    expect(o.evented).toBe(false)
    expect(o.selectable).toBe(false)
    expect(o.__prevEventedBeforeEyeToggle).toBe(true)
    expect(o.__prevSelectableBeforeEyeToggle).toBe(true)
  })

  it('show apos hide: restaura backups', () => {
    const o = makeEntry({ evented: false, selectable: false })
    applyObjectVisibility(o, false) // primeiro hide grava backup
    applyObjectVisibility(o, true)  // depois show restaura
    expect(o.visible).toBe(true)
    expect(o.evented).toBe(false) // backup tinha false
    expect(o.selectable).toBe(false)
    expect(o.__prevEventedBeforeEyeToggle).toBeUndefined()
  })

  it('show sem backup: defaults true', () => {
    const o = makeEntry({ visible: false, evented: false, selectable: false })
    applyObjectVisibility(o, true)
    expect(o.visible).toBe(true)
    expect(o.evented).toBe(true)
    expect(o.selectable).toBe(true)
  })

  it('hide multiplo nao sobrescreve backup', () => {
    const o = makeEntry({ evented: true, selectable: true })
    applyObjectVisibility(o, false)
    o.evented = false // simulando que algo mexeu
    applyObjectVisibility(o, false) // hide de novo
    expect(o.__prevEventedBeforeEyeToggle).toBe(true) // backup original preservado
  })

  it('roundtrip preserva valores originais', () => {
    const o = makeEntry({ evented: true, selectable: false })
    applyObjectVisibility(o, false)
    applyObjectVisibility(o, true)
    expect(o.evented).toBe(true)
    expect(o.selectable).toBe(false)
  })

  it('marca dirty=true e chama setCoords', () => {
    const o = makeEntry()
    applyObjectVisibility(o, false)
    expect(o.dirty).toBe(true)
    expect(o.setCoordsCount).toBe(1)
  })
})
