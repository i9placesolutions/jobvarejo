import { describe, it, expect } from 'vitest'
import {
  getFrameBounds,
  isFrameLikeObject,
  isObjectCenterInsideFrame,
  isObjectVisuallyInsideFrame,
  isObjectIntersectingFrame,
  isObjectMostlyInsideFrame,
  getFrameSpawnPosition,
  FRAME_SPAWN_GAP,
  getFrameDisplayNameForExport,
  serializeFrameLabelMetric,
  buildFrameLabelViewportSignature,
  buildFrameLabelSelectionSignature,
  normalizeFrameRuntimeProps
} from '~/utils/frameGeometry'

// Mock minimal de fabric.Object — duck-typed.
const obj = (b: { left: number; top: number; width: number; height: number }) => ({
  getBoundingRect: () => b,
  left: b.left,
  top: b.top,
  width: b.width,
  height: b.height
})

describe('getFrameBounds', () => {
  it('null/undefined retorna null', () => {
    expect(getFrameBounds(null)).toBeNull()
    expect(getFrameBounds(undefined)).toBeNull()
  })

  it('frame sem rotacao usa width*scaleX/height*scaleY centrado em getCenterPoint', () => {
    const f = {
      angle: 0,
      width: 200,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      getCenterPoint: () => ({ x: 100, y: 50 })
    }
    expect(getFrameBounds(f)).toEqual({ left: 0, top: 0, width: 200, height: 100 })
  })

  it('frame com scale aplica corretamente', () => {
    const f = {
      angle: 0,
      width: 100,
      height: 100,
      scaleX: 2,
      scaleY: 0.5,
      getCenterPoint: () => ({ x: 100, y: 25 })
    }
    expect(getFrameBounds(f)).toEqual({ left: 0, top: 0, width: 200, height: 50 })
  })

  it('frame rotacionado usa getBoundingRect(true) retornando AABB', () => {
    const f = {
      angle: 45,
      getBoundingRect: () => ({ left: 10, top: 20, width: 100, height: 100 })
    }
    expect(getFrameBounds(f)).toEqual({ left: 10, top: 20, width: 100, height: 100 })
  })

  it('rotacao invalida no getBoundingRect cai no fallback width*scale', () => {
    const f = {
      angle: 45,
      getBoundingRect: () => null,
      width: 100,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      getCenterPoint: () => ({ x: 50, y: 50 })
    }
    expect(getFrameBounds(f)).toEqual({ left: 0, top: 0, width: 100, height: 100 })
  })

  it('width/height invalidos retornam null', () => {
    expect(getFrameBounds({
      angle: 0,
      width: 0,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      getCenterPoint: () => ({ x: 0, y: 0 })
    })).toBeNull()
  })
})

describe('isFrameLikeObject', () => {
  it('null retorna false', () => {
    expect(isFrameLikeObject(null)).toBe(false)
  })

  it('aceita por flag isFrame', () => {
    expect(isFrameLikeObject({ isFrame: true })).toBe(true)
  })

  it('aceita por layerName FRAME/FRAMER (case insensitive)', () => {
    expect(isFrameLikeObject({ layerName: 'FRAMER' })).toBe(true)
    expect(isFrameLikeObject({ layerName: 'frame' })).toBe(true)
    expect(isFrameLikeObject({ layerName: 'FRAME 1' })).toBe(true)
    expect(isFrameLikeObject({ layerName: 'FRAMER 12' })).toBe(true)
  })

  it('aceita por name "FRAME" / "FRAMER" / "FRAME 1"', () => {
    expect(isFrameLikeObject({ name: 'FRAMER' })).toBe(true)
    expect(isFrameLikeObject({ name: 'FRAME 2' })).toBe(true)
  })

  it('aceita rect com isGridCell ou gridGroupId', () => {
    expect(isFrameLikeObject({ type: 'rect', isGridCell: true })).toBe(true)
    expect(isFrameLikeObject({ type: 'rect', gridGroupId: 'g1' })).toBe(true)
  })

  it('rejeita rect simples sem flag', () => {
    expect(isFrameLikeObject({ type: 'rect' })).toBe(false)
  })

  it('rejeita objetos sem sinais', () => {
    expect(isFrameLikeObject({ type: 'image' })).toBe(false)
    expect(isFrameLikeObject({ type: 'group', name: 'whatever' })).toBe(false)
  })
})

describe('isObjectCenterInsideFrame', () => {
  const frame = obj({ left: 0, top: 0, width: 100, height: 100 })

  it('centro do obj dentro do frame', () => {
    const inside = obj({ left: 40, top: 40, width: 20, height: 20 })
    expect(isObjectCenterInsideFrame(inside, frame)).toBe(true)
  })

  it('centro do obj fora do frame', () => {
    const out = obj({ left: 200, top: 200, width: 20, height: 20 })
    expect(isObjectCenterInsideFrame(out, frame)).toBe(false)
  })

  it('borda inclusiva (centro = vertice do frame)', () => {
    // obj com centro em (100, 100) — exatamente na borda
    const onEdge = obj({ left: 90, top: 90, width: 20, height: 20 })
    expect(isObjectCenterInsideFrame(onEdge, frame)).toBe(true)
  })

  it('null/sem getBoundingRect → false', () => {
    expect(isObjectCenterInsideFrame(null, frame)).toBe(false)
    expect(isObjectCenterInsideFrame({ a: 1 }, frame)).toBe(false)
    expect(isObjectCenterInsideFrame(obj({ left: 0, top: 0, width: 1, height: 1 }), null)).toBe(false)
  })
})

describe('isObjectVisuallyInsideFrame', () => {
  const frame = obj({ left: 0, top: 0, width: 100, height: 100 })

  it('centro dentro → true', () => {
    expect(isObjectVisuallyInsideFrame(obj({ left: 40, top: 40, width: 20, height: 20 }), frame)).toBe(true)
  })

  it('overlap >= 20% sem centro dentro → true', () => {
    // obj 100x100 com left=80 → 20px de overlap horizontal × 100px = 2000 / area=10000 = 20%
    const partial = obj({ left: 80, top: 0, width: 100, height: 100 })
    expect(isObjectVisuallyInsideFrame(partial, frame)).toBe(true)
  })

  it('overlap < 20% e fora → false', () => {
    const small = obj({ left: 95, top: 0, width: 100, height: 100 })
    expect(isObjectVisuallyInsideFrame(small, frame)).toBe(false)
  })

  it('totalmente fora → false', () => {
    expect(isObjectVisuallyInsideFrame(obj({ left: 200, top: 200, width: 20, height: 20 }), frame)).toBe(false)
  })
})

describe('isObjectIntersectingFrame', () => {
  const frame = obj({ left: 0, top: 0, width: 100, height: 100 })

  it('qualquer overlap > 0 → true', () => {
    expect(isObjectIntersectingFrame(obj({ left: 50, top: 50, width: 100, height: 100 }), frame)).toBe(true)
    expect(isObjectIntersectingFrame(obj({ left: 99, top: 99, width: 10, height: 10 }), frame)).toBe(true)
  })

  it('totalmente fora → false', () => {
    expect(isObjectIntersectingFrame(obj({ left: 200, top: 200, width: 50, height: 50 }), frame)).toBe(false)
  })

  it('usa frame.intersectsWithObject quando disponivel', () => {
    const customFrame = {
      ...frame,
      intersectsWithObject: () => true
    }
    expect(isObjectIntersectingFrame(obj({ left: 999, top: 999, width: 1, height: 1 }), customFrame)).toBe(true)
  })

  it('intersectsWithObject que joga erro nao quebra', () => {
    const failingFrame = {
      ...frame,
      intersectsWithObject: () => { throw new Error('boom') }
    }
    // cai em bbox fallback — overlap 0 → false
    expect(isObjectIntersectingFrame(obj({ left: 200, top: 200, width: 10, height: 10 }), failingFrame)).toBe(false)
  })
})

describe('isObjectMostlyInsideFrame', () => {
  const frame = obj({ left: 0, top: 0, width: 100, height: 100 })

  it('centro inside → true mesmo com pouco overlap', () => {
    // obj 200x200 com left=-50,top=-50 → centro=(50,50) DENTRO do frame
    // mas o obj se estende muito alem do frame (overlap pequeno)
    const big = obj({ left: -50, top: -50, width: 200, height: 200 })
    expect(isObjectMostlyInsideFrame(big, frame)).toBe(true)
  })

  it('overlap >= 60% (default) → true sem centro', () => {
    // obj 100x100 inteiramente dentro de frame 100x100 (centro=(50,50) inside)
    expect(isObjectMostlyInsideFrame(obj({ left: 0, top: 0, width: 100, height: 100 }), frame)).toBe(true)
  })

  it('overlap < 60% sem centro → false', () => {
    // obj 200x100 com left=51 → centro=(151,50). frame.right=100 → centro FORA.
    // overlap = (100-51) × 100 = 4900. obj area = 200*100=20000. ratio=0.245 < 0.6 → false
    const partial = obj({ left: 51, top: 0, width: 200, height: 100 })
    expect(isObjectMostlyInsideFrame(partial, frame)).toBe(false)
  })

  it('minOverlapRatio customizavel', () => {
    // obj 200x100 com left=10 → centro=(110,50). frame.right=100 → centro FORA.
    // overlap = (100-10) × 100 = 9000. obj area = 200*100=20000. ratio=0.45
    const partial = obj({ left: 10, top: 0, width: 200, height: 100 })
    expect(isObjectMostlyInsideFrame(partial, frame, 0.4)).toBe(true)  // 0.45 >= 0.4
    expect(isObjectMostlyInsideFrame(partial, frame, 0.5)).toBe(false) // 0.45 < 0.5
  })
})

describe('getFrameSpawnPosition', () => {
  it('FRAME_SPAWN_GAP e' + ' 48 (default)', () => {
    expect(FRAME_SPAWN_GAP).toBe(48)
  })

  it('sem referencia: cai no centro do nextFrame', () => {
    expect(getFrameSpawnPosition(null, 200, 100)).toEqual({ left: 100, top: 50 })
    expect(getFrameSpawnPosition(undefined, 50, 80)).toEqual({ left: 25, top: 40 })
  })

  it('com referencia: posiciona a direita do frame de referencia', () => {
    const reference = {
      angle: 0,
      width: 100,
      height: 80,
      scaleX: 1,
      scaleY: 1,
      getCenterPoint: () => ({ x: 50, y: 40 })
    }
    // bounds: left=0, top=0, w=100, h=80
    // newFrame: 200x100 → spawn at left=100+48+100=248, top=40
    expect(getFrameSpawnPosition(reference, 200, 100)).toEqual({ left: 248, top: 40 })
  })

  it('referencia com bounds invalidos cai no fallback', () => {
    const broken = {
      angle: 0,
      width: 0, // invalido
      height: 100,
      scaleX: 1,
      scaleY: 1,
      getCenterPoint: () => ({ x: 0, y: 0 })
    }
    expect(getFrameSpawnPosition(broken, 100, 100)).toEqual({ left: 50, top: 50 })
  })
})

describe('getFrameDisplayNameForExport', () => {
  it('layerName especifico vence', () => {
    expect(getFrameDisplayNameForExport({ layerName: 'Capa', name: 'foo' }, 0)).toBe('Capa')
  })

  it('layerName generico ("FRAMER N") cai para runtime name', () => {
    expect(getFrameDisplayNameForExport({ layerName: 'FRAMER 1', name: 'Capa' }, 0)).toBe('Capa')
    expect(getFrameDisplayNameForExport({ layerName: 'FRAME', name: 'Verso' }, 0)).toBe('Verso')
  })

  it('sem layerName e sem name: cai para "Frame N+1"', () => {
    expect(getFrameDisplayNameForExport({}, 0)).toBe('Frame 1')
    expect(getFrameDisplayNameForExport(null, 4)).toBe('Frame 5')
  })

  it('layerName generico mas runtimeName vazio: usa layerName', () => {
    expect(getFrameDisplayNameForExport({ layerName: 'FRAMER 2' }, 0)).toBe('FRAMER 2')
  })
})

describe('serializeFrameLabelMetric', () => {
  it('formata com 3 casas decimais', () => {
    expect(serializeFrameLabelMetric(1)).toBe('1.000')
    // toFixed(3) em JS usa banker's rounding: 1.2345 → 1.234
    expect(serializeFrameLabelMetric(1.2345)).toBe('1.234')
    expect(serializeFrameLabelMetric(0)).toBe('0.000')
    expect(serializeFrameLabelMetric(-1.5)).toBe('-1.500')
  })

  it('NaN/Infinity retornam "0"', () => {
    expect(serializeFrameLabelMetric(NaN)).toBe('0')
    expect(serializeFrameLabelMetric(Infinity)).toBe('0')
    expect(serializeFrameLabelMetric(-Infinity)).toBe('0')
  })

  it('null/undefined: Number() coerce para 0 (finito), retorna "0.000"', () => {
    // Number(null) === 0; Number(undefined) === NaN
    expect(serializeFrameLabelMetric(null)).toBe('0.000')
    expect(serializeFrameLabelMetric(undefined)).toBe('0')
  })

  it('strings parseaveis sao convertidas', () => {
    expect(serializeFrameLabelMetric('1.5')).toBe('1.500')
  })

  it('strings nao-numericas viram "0"', () => {
    expect(serializeFrameLabelMetric('abc')).toBe('0')
  })

  it('mesma entrada gera mesma saida (estabilidade)', () => {
    expect(serializeFrameLabelMetric(0.1 + 0.2)).toBe(serializeFrameLabelMetric(0.3))
  })
})

describe('buildFrameLabelViewportSignature', () => {
  it('combina vpt[0..5] + zoom + width + height', () => {
    const sig = buildFrameLabelViewportSignature({
      viewportTransform: [1, 0, 0, 1, 100, 50],
      width: 800,
      height: 600,
      zoom: 1.5
    })
    expect(sig).toContain('100')
    expect(sig).toContain('50')
    expect(sig).toContain('1.500')
    expect(sig).toContain('800')
    expect(sig).toContain('600')
  })

  it('mesma entrada → mesma assinatura', () => {
    const input = {
      viewportTransform: [1, 0, 0, 1, 100, 50],
      width: 800,
      height: 600,
      zoom: 1
    }
    expect(buildFrameLabelViewportSignature(input))
      .toBe(buildFrameLabelViewportSignature(input))
  })

  it('viewportTransform null cai para identidade', () => {
    const sig = buildFrameLabelViewportSignature({
      viewportTransform: null as any,
      width: 100,
      height: 100,
      zoom: 1
    })
    // identity = [1,0,0,1,0,0]
    expect(sig).toContain('1.000')
  })

  it('mudanca em vpt detectada', () => {
    const a = buildFrameLabelViewportSignature({
      viewportTransform: [1, 0, 0, 1, 0, 0],
      width: 800, height: 600, zoom: 1
    })
    const b = buildFrameLabelViewportSignature({
      viewportTransform: [1, 0, 0, 1, 100, 0],
      width: 800, height: 600, zoom: 1
    })
    expect(a).not.toBe(b)
  })
})

describe('buildFrameLabelSelectionSignature', () => {
  it('null/undefined → "selection:none"', () => {
    expect(buildFrameLabelSelectionSignature(null)).toBe('selection:none')
    expect(buildFrameLabelSelectionSignature(undefined)).toBe('selection:none')
  })

  it('activeSelection com ids → "selection:multi:<ids ordenados>"', () => {
    const sig = buildFrameLabelSelectionSignature({
      type: 'activeSelection',
      getObjects: () => [
        { _customId: 'b' },
        { _customId: 'a' },
        { _customId: 'c' }
      ]
    })
    expect(sig).toBe('selection:multi:a,b,c')
  })

  it('activeSelection vazia → "selection:multi:none"', () => {
    expect(buildFrameLabelSelectionSignature({
      type: 'activeSelection',
      getObjects: () => []
    })).toBe('selection:multi:none')
  })

  it('objeto unico → "selection:<type>:<id>:object"', () => {
    expect(buildFrameLabelSelectionSignature({
      type: 'rect',
      _customId: 'r1'
    })).toBe('selection:rect:r1:object')
  })

  it('objeto unico com isFrame → :frame', () => {
    expect(buildFrameLabelSelectionSignature({
      type: 'rect',
      _customId: 'r1',
      isFrame: true
    })).toBe('selection:rect:r1:frame')
  })

  it('fallback id from .id quando _customId ausente', () => {
    expect(buildFrameLabelSelectionSignature({
      type: 'i-text',
      id: 'text-1'
    })).toBe('selection:i-text:text-1:object')
  })
})

describe('normalizeFrameRuntimeProps', () => {
  it('null/non-frame: retorna null sem mutar', () => {
    expect(normalizeFrameRuntimeProps(null)).toBeNull()
    expect(normalizeFrameRuntimeProps({ type: 'rect' })).toBeNull()
  })

  it('frame normalizado: gera _customId, isFrame=true, clipContent=true, layerName=FRAMER', () => {
    const f: any = { isFrame: true }
    const result = normalizeFrameRuntimeProps(f)
    expect(result).toBe(f)
    expect(typeof f._customId).toBe('string')
    expect(f._customId.length).toBeGreaterThan(0)
    expect(f.isFrame).toBe(true)
    expect(f.clipContent).toBe(true)
    expect(f.layerName).toBe('FRAMER')
  })

  it('preserva _customId pre-existente', () => {
    const f: any = { isFrame: true, _customId: 'preset-id' }
    normalizeFrameRuntimeProps(f)
    expect(f._customId).toBe('preset-id')
  })

  it('preserva clipContent=false explicito', () => {
    const f: any = { isFrame: true, clipContent: false }
    normalizeFrameRuntimeProps(f)
    expect(f.clipContent).toBe(false)
  })

  it('preserva layerName customizado', () => {
    const f: any = { isFrame: true, layerName: 'My Frame' }
    normalizeFrameRuntimeProps(f)
    expect(f.layerName).toBe('My Frame')
  })

  it('rect com isGridCell e tratado como frame e normalizado', () => {
    const f: any = { type: 'rect', isGridCell: true }
    const result = normalizeFrameRuntimeProps(f)
    expect(result).toBe(f)
    expect(f.isFrame).toBe(true)
    expect(f._customId).toBeDefined()
  })
})
