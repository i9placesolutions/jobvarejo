import { describe, it, expect, vi } from 'vitest'
import {
  setText,
  setVisible,
  assignNewCustomIdsDeep,
  resetDuplicatedObjectRuntime,
  clearInvalidClipPath,
  applyObjectVisibility,
  safeAddWithUpdate,
  ensureObjectPersistentId,
  ensurePersistentContentFlags,
  isObjectMaskCandidate,
  stripPersistentIdsRecursive,
  findNearestMaskSourceBelowTarget
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

describe('safeAddWithUpdate', () => {
  const makeGroup = (overrides: any = {}) => {
    const g: any = {
      _customId: 'g1',
      addWithUpdateCount: 0,
      triggerLayoutCount: 0,
      setCoordsCount: 0,
      ...overrides
    }
    if (!overrides.addWithUpdate && overrides.addWithUpdate !== false) {
      g.addWithUpdate = (obj?: any) => {
        g.addWithUpdateCount += 1
        if (obj) g.lastAdded = obj
      }
    }
    g.add = (obj: any) => { g.addedObj = obj }
    g.triggerLayout = () => { g.triggerLayoutCount += 1 }
    g.setCoords = () => { g.setCoordsCount += 1 }
    return g
  }

  const makeObj = (overrides: any = {}) => ({
    setCoords: () => {},
    ...overrides
  })

  it('null group nao quebra', () => {
    expect(() => safeAddWithUpdate(null)).not.toThrow()
    expect(() => safeAddWithUpdate(undefined, makeObj())).not.toThrow()
  })

  it('Fabric v6: usa addWithUpdate quando disponivel', () => {
    const g = makeGroup()
    const o = makeObj()
    safeAddWithUpdate(g, o)
    expect(g.addWithUpdateCount).toBe(1)
    expect(g.lastAdded).toBe(o)
  })

  it('addWithUpdate sem object: chama recalculo do group', () => {
    const g = makeGroup()
    safeAddWithUpdate(g)
    expect(g.addWithUpdateCount).toBe(1)
    expect(g.lastAdded).toBeUndefined()
  })

  it('Fabric v7+: usa add + triggerLayout', () => {
    const g: any = {
      _customId: 'g1',
      add: () => { g.addCount = (g.addCount || 0) + 1 },
      triggerLayout: () => { g.triggerLayoutCount = (g.triggerLayoutCount || 0) + 1 },
      setCoords: () => { g.setCoordsCount = (g.setCoordsCount || 0) + 1 }
    }
    safeAddWithUpdate(g, makeObj())
    expect(g.addCount).toBe(1)
    expect(g.triggerLayoutCount).toBe(1)
    expect(g.setCoordsCount).toBe(1)
    expect(g.dirty).toBe(true)
  })

  it('fallback _calcBounds quando triggerLayout nao disponivel', () => {
    const g: any = {
      _customId: 'g1',
      add: () => { g.addCount = (g.addCount || 0) + 1 },
      _calcBounds: () => { g.boundsCount = (g.boundsCount || 0) + 1 },
      _updateObjectsCoords: () => { g.coordsCount = (g.coordsCount || 0) + 1 },
      setCoords: () => {}
    }
    safeAddWithUpdate(g, makeObj())
    expect(g.boundsCount).toBe(1)
    expect(g.coordsCount).toBe(1)
  })

  it('REGRESSAO: bloqueia objeto sem setCoords (impossivel adicionar)', () => {
    const g = makeGroup()
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    safeAddWithUpdate(g, { type: 'broken' })
    expect(g.addWithUpdateCount).toBe(0) // bloqueado
    expect(consoleErr).toHaveBeenCalled()
    consoleErr.mockRestore()
  })

  it('REGRESSAO: bloqueia primitivos como object', () => {
    const g = makeGroup()
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    safeAddWithUpdate(g, 'str' as any)
    safeAddWithUpdate(g, 42 as any)
    expect(g.addWithUpdateCount).toBe(0)
    consoleErr.mockRestore()
  })
})

describe('ensureObjectPersistentId', () => {
  it('null/undefined nao quebra', () => {
    expect(() => ensureObjectPersistentId(null)).not.toThrow()
    expect(() => ensureObjectPersistentId(undefined)).not.toThrow()
  })

  it('atribui _customId quando faltando', () => {
    const obj: any = { type: 'rect' }
    ensureObjectPersistentId(obj)
    expect(typeof obj._customId).toBe('string')
    expect(obj._customId.length).toBeGreaterThan(0)
  })

  it('NO-OP quando _customId ja existe', () => {
    const obj: any = { _customId: 'existing-id' }
    ensureObjectPersistentId(obj)
    expect(obj._customId).toBe('existing-id')
  })

  it('NO-OP em control-like (path_node)', () => {
    const obj: any = { name: 'path_node' }
    ensureObjectPersistentId(obj)
    expect(obj._customId).toBeUndefined()
  })

  it('NO-OP em user guides (id guide-user-*)', () => {
    const obj: any = { id: 'guide-user-1' }
    ensureObjectPersistentId(obj)
    expect(obj._customId).toBeUndefined()
  })

  it('NO-OP em user guides (isUserGuide=true)', () => {
    const obj: any = { isUserGuide: true }
    ensureObjectPersistentId(obj)
    expect(obj._customId).toBeUndefined()
  })
})

describe('ensurePersistentContentFlags', () => {
  it('null/undefined nao quebra', () => {
    expect(() => ensurePersistentContentFlags(null)).not.toThrow()
  })

  it('atribui _customId via ensureObjectPersistentId', () => {
    const obj: any = { type: 'group', isFrame: true }
    ensurePersistentContentFlags(obj)
    expect(typeof obj._customId).toBe('string')
  })

  it('REGRESSAO: content persistente com excludeFromExport tem flag removida', () => {
    const obj: any = { type: 'group', isFrame: true, excludeFromExport: true }
    ensurePersistentContentFlags(obj)
    expect(obj.excludeFromExport).toBe(false)
  })

  it('content nao-persistente: nao mexe em excludeFromExport', () => {
    const obj: any = { type: 'rect', excludeFromExport: true }
    ensurePersistentContentFlags(obj)
    expect(obj.excludeFromExport).toBe(true)
  })

  it('aceita por isProductZone/parentZoneId', () => {
    const z: any = { type: 'group', isProductZone: true, excludeFromExport: true }
    ensurePersistentContentFlags(z)
    expect(z.excludeFromExport).toBe(false)

    const c: any = { type: 'group', parentZoneId: 'z1', excludeFromExport: true }
    ensurePersistentContentFlags(c)
    expect(c.excludeFromExport).toBe(false)
  })

  it('aceita por name (gridZone/productZoneContainer/product-card-*)', () => {
    const a: any = { name: 'gridZone', excludeFromExport: true }
    ensurePersistentContentFlags(a)
    expect(a.excludeFromExport).toBe(false)

    const b: any = { name: 'product-card-42', excludeFromExport: true }
    ensurePersistentContentFlags(b)
    expect(b.excludeFromExport).toBe(false)
  })
})

describe('isObjectMaskCandidate', () => {
  it('null/undefined/non-object → false', () => {
    expect(isObjectMaskCandidate(null)).toBe(false)
    expect(isObjectMaskCandidate(undefined)).toBe(false)
    expect(isObjectMaskCandidate('string' as any)).toBe(false)
  })

  it('artboard-bg → false', () => {
    expect(isObjectMaskCandidate({ id: 'artboard-bg', type: 'rect' })).toBe(false)
  })

  it('frame → false', () => {
    expect(isObjectMaskCandidate({ isFrame: true, type: 'group' })).toBe(false)
  })

  it('product zone → false', () => {
    expect(isObjectMaskCandidate({ type: 'group', isGridZone: true })).toBe(false)
  })

  it('product card container → false', () => {
    expect(isObjectMaskCandidate({ type: 'group', isProductCard: true })).toBe(false)
  })

  it('objeto livre (sem parent group) → true', () => {
    expect(isObjectMaskCandidate({ type: 'rect', width: 100, height: 100 })).toBe(true)
    expect(isObjectMaskCandidate({ type: 'image' })).toBe(true)
  })

  it('objeto dentro de group regular → false', () => {
    expect(isObjectMaskCandidate({ type: 'rect', group: { type: 'group' } })).toBe(false)
  })

  it('objeto dentro de activeselection → true (efêmero)', () => {
    expect(isObjectMaskCandidate({ type: 'rect', group: { type: 'activeselection' } })).toBe(true)
    expect(isObjectMaskCandidate({ type: 'rect', group: { type: 'ActiveSelection' } })).toBe(true)
  })
})

describe('stripPersistentIdsRecursive', () => {
  it('null/undefined/non-object: no-op silencioso', () => {
    expect(() => stripPersistentIdsRecursive(null)).not.toThrow()
    expect(() => stripPersistentIdsRecursive(undefined)).not.toThrow()
    expect(() => stripPersistentIdsRecursive('string' as any)).not.toThrow()
  })

  it('remove _customId e id do nodo raiz', () => {
    const node: any = { _customId: 'abc', id: '123', name: 'foo' }
    stripPersistentIdsRecursive(node)
    expect(node._customId).toBeUndefined()
    expect(node.id).toBeUndefined()
    expect(node.name).toBe('foo')
  })

  it('desce recursivamente em getObjects()', () => {
    const child: any = { _customId: 'c1', id: 'i1' }
    const grandchild: any = { _customId: 'gc1', id: 'gi1' }
    child.getObjects = () => [grandchild]
    const root: any = {
      _customId: 'r1', id: 'ri1',
      getObjects: () => [child]
    }
    stripPersistentIdsRecursive(root)
    expect(root._customId).toBeUndefined()
    expect(child._customId).toBeUndefined()
    expect(grandchild._customId).toBeUndefined()
  })

  it('desce em _objects quando getObjects ausente', () => {
    const child: any = { _customId: 'c1' }
    const root: any = {
      _customId: 'r1',
      _objects: [child]
    }
    stripPersistentIdsRecursive(root)
    expect(root._customId).toBeUndefined()
    expect(child._customId).toBeUndefined()
  })

  it('desce em clipPath aninhado', () => {
    const clip: any = { _customId: 'clip1', id: 'ci1' }
    const root: any = { _customId: 'r1', clipPath: clip }
    stripPersistentIdsRecursive(root)
    expect(root._customId).toBeUndefined()
    expect(clip._customId).toBeUndefined()
    expect(clip.id).toBeUndefined()
  })

  it('clipPath nested.clipPath: tambem desce', () => {
    const innerClip: any = { _customId: 'inner' }
    const outerClip: any = { _customId: 'outer', clipPath: innerClip }
    const root: any = { _customId: 'r', clipPath: outerClip }
    stripPersistentIdsRecursive(root)
    expect(innerClip._customId).toBeUndefined()
    expect(outerClip._customId).toBeUndefined()
  })

  it('captura erro de delete em props readonly silenciosamente', () => {
    const node: any = {}
    Object.defineProperty(node, '_customId', {
      value: 'frozen',
      writable: false,
      configurable: false
    })
    expect(() => stripPersistentIdsRecursive(node)).not.toThrow()
    expect(node._customId).toBe('frozen')
  })

  it('ignora children sem getObjects nem _objects', () => {
    const root: any = { _customId: 'r1' }
    expect(() => stripPersistentIdsRecursive(root)).not.toThrow()
    expect(root._customId).toBeUndefined()
  })
})

describe('findNearestMaskSourceBelowTarget', () => {
  const isCandidate = (obj: any) => !!obj?.maskOk

  it('null/undefined target → null', () => {
    expect(findNearestMaskSourceBelowTarget([], null, isCandidate)).toBeNull()
    expect(findNearestMaskSourceBelowTarget(null as any, {}, isCandidate)).toBeNull()
  })

  it('target nao no array → null', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    expect(findNearestMaskSourceBelowTarget([a, b], { id: 'c' }, isCandidate)).toBeNull()
  })

  it('target no topo (idx 0): null', () => {
    const target = { id: 'top', maskOk: true }
    expect(findNearestMaskSourceBelowTarget([target], target, isCandidate)).toBeNull()
  })

  it('encontra o candidato imediatamente abaixo', () => {
    const a = { id: 'a', maskOk: true }
    const b = { id: 'b', maskOk: true }
    const target = { id: 'target' }
    expect(findNearestMaskSourceBelowTarget([a, b, target], target, isCandidate))
      .toBe(b)
  })

  it('pula objetos que nao sao candidatos', () => {
    const a = { id: 'a', maskOk: true }
    const b = { id: 'b', maskOk: false }
    const target = { id: 'target' }
    expect(findNearestMaskSourceBelowTarget([a, b, target], target, isCandidate))
      .toBe(a)
  })

  it('soh aceita candidatos do mesmo parentFrameId', () => {
    const a = { id: 'a', maskOk: true, parentFrameId: 'F1' }
    const b = { id: 'b', maskOk: true, parentFrameId: 'F2' }
    const target = { id: 'target', parentFrameId: 'F1' }
    expect(findNearestMaskSourceBelowTarget([a, b, target], target, isCandidate))
      .toBe(a)  // pulou b (frame diferente)
  })

  it('target sem parentFrameId compara com "" (free)', () => {
    const a = { id: 'a', maskOk: true } // sem parentFrameId
    const b = { id: 'b', maskOk: true, parentFrameId: 'F1' }
    const target = { id: 'target' }
    expect(findNearestMaskSourceBelowTarget([a, b, target], target, isCandidate))
      .toBe(a)
  })

  it('nenhum candidato no mesmo frame: null', () => {
    const a = { id: 'a', maskOk: true, parentFrameId: 'F2' }
    const target = { id: 'target', parentFrameId: 'F1' }
    expect(findNearestMaskSourceBelowTarget([a, target], target, isCandidate))
      .toBeNull()
  })

  it('ignora target dentro do array (continua varrendo)', () => {
    const a = { id: 'a', maskOk: true }
    const target = { id: 'target' }
    const dup = target  // mesma ref
    expect(findNearestMaskSourceBelowTarget([a, dup, target], target, isCandidate))
      .toBe(a)
  })
})
