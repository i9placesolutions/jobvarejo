import { describe, it, expect } from 'vitest'
import {
  MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH,
  MISSING_PRODUCT_IMAGE_RECOVERY_MAX_BATCH,
  compareMissingProductImageRecoveryCandidates,
  getMissingProductImageRecoveryBatchLimit,
  measureMissingProductImageRecoveryPriority,
  computeMissingProductImageRecoveryViewportRect,
  type MissingProductImageRecoveryCandidate
} from '~/utils/missingProductImageRecovery'

const makeCandidate = (priority: any): MissingProductImageRecoveryCandidate => ({
  card: {},
  imageObj: null,
  hasImageObject: false,
  triedMap: {},
  normalizedCandidates: [],
  needsRemoteLookup: false,
  priority: {
    selected: false,
    inView: false,
    coverage: 0,
    distanceSq: 0,
    culled: false,
    ...priority
  }
})

describe('MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH / MAX_BATCH', () => {
  it('valores padrao', () => {
    expect(MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH).toBe(8)
    expect(MISSING_PRODUCT_IMAGE_RECOVERY_MAX_BATCH).toBe(16)
  })
})

describe('compareMissingProductImageRecoveryCandidates', () => {
  it('selected vence inView', () => {
    const a = makeCandidate({ selected: true, inView: false })
    const b = makeCandidate({ selected: false, inView: true })
    expect(compareMissingProductImageRecoveryCandidates(a, b)).toBe(-1) // a primeiro
    expect(compareMissingProductImageRecoveryCandidates(b, a)).toBe(1)
  })

  it('inView vence non-culled', () => {
    const a = makeCandidate({ inView: true, culled: false })
    const b = makeCandidate({ inView: false, culled: false })
    expect(compareMissingProductImageRecoveryCandidates(a, b)).toBe(-1)
  })

  it('culled cai pra ultimo', () => {
    const a = makeCandidate({ culled: false })
    const b = makeCandidate({ culled: true })
    expect(compareMissingProductImageRecoveryCandidates(a, b)).toBe(-1)
    expect(compareMissingProductImageRecoveryCandidates(b, a)).toBe(1)
  })

  it('coverage decrescente entre empates anteriores', () => {
    const a = makeCandidate({ coverage: 0.8 })
    const b = makeCandidate({ coverage: 0.3 })
    expect(compareMissingProductImageRecoveryCandidates(a, b)).toBeLessThan(0) // a primeiro (maior cov)
  })

  it('coverage com diff < 0.0001 trata como empate, cai em distanceSq', () => {
    const a = makeCandidate({ coverage: 0.50001, distanceSq: 100 })
    const b = makeCandidate({ coverage: 0.50000, distanceSq: 50 })
    // coverage praticamente igual → vai pra distanceSq → b mais perto
    expect(compareMissingProductImageRecoveryCandidates(a, b)).toBeGreaterThan(0)
  })

  it('distanceSq crescente', () => {
    const near = makeCandidate({ distanceSq: 100 })
    const far = makeCandidate({ distanceSq: 10000 })
    expect(compareMissingProductImageRecoveryCandidates(near, far)).toBeLessThan(0)
  })

  it('todos iguais: empate (0)', () => {
    const a = makeCandidate({})
    const b = makeCandidate({})
    expect(compareMissingProductImageRecoveryCandidates(a, b)).toBe(0)
  })

  it('cenario realista: ordena selected → inView → coverage → distancia', () => {
    const candidates = [
      makeCandidate({ selected: false, inView: false, coverage: 0.9 }), // 4
      makeCandidate({ selected: true, inView: false, coverage: 0.1 }),   // 1 (selected)
      makeCandidate({ selected: false, inView: true, coverage: 0.5 }),   // 2 (inView)
      makeCandidate({ selected: false, inView: true, coverage: 0.7 })    // 3 (mais coverage)
    ]
    const sorted = [...candidates].sort(compareMissingProductImageRecoveryCandidates)
    expect(sorted[0].priority.selected).toBe(true)
    expect(sorted[1].priority.coverage).toBe(0.7)  // inView + maior cov
    expect(sorted[2].priority.coverage).toBe(0.5)
    expect(sorted[3].priority.inView).toBe(false)
  })
})

describe('getMissingProductImageRecoveryBatchLimit', () => {
  it('null/non-array: 0', () => {
    expect(getMissingProductImageRecoveryBatchLimit(null as any)).toBe(0)
    expect(getMissingProductImageRecoveryBatchLimit(undefined as any)).toBe(0)
  })

  it('candidates.length <= MAX_BATCH (16): retorna length', () => {
    const cands = Array(10).fill(0).map(() => makeCandidate({}))
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(10)
  })

  it('candidates.length === MAX_BATCH: retorna 16', () => {
    const cands = Array(16).fill(0).map(() => makeCandidate({}))
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(16)
  })

  it('30 cands com 0 visiveis: MIN_BATCH (8)', () => {
    const cands = Array(30).fill(0).map(() => makeCandidate({ selected: false, inView: false }))
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(8)
  })

  it('30 cands com 6 visiveis: 6 + 4 = 10', () => {
    const cands: MissingProductImageRecoveryCandidate[] = []
    for (let i = 0; i < 30; i++) {
      cands.push(makeCandidate({ inView: i < 6 }))
    }
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(10)
  })

  it('30 cands com 20 visiveis: clampa em MAX_BATCH (16)', () => {
    const cands: MissingProductImageRecoveryCandidate[] = []
    for (let i = 0; i < 30; i++) {
      cands.push(makeCandidate({ inView: i < 20 }))
    }
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(16)
  })

  it('30 cands com 2 visiveis: max(MIN=8, 2+4=6) = 8', () => {
    const cands: MissingProductImageRecoveryCandidate[] = []
    for (let i = 0; i < 30; i++) {
      cands.push(makeCandidate({ inView: i < 2 }))
    }
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(8)
  })

  it('selected conta como visivel', () => {
    const cands: MissingProductImageRecoveryCandidate[] = []
    for (let i = 0; i < 30; i++) {
      cands.push(makeCandidate({ selected: i < 6 }))
    }
    expect(getMissingProductImageRecoveryBatchLimit(cands)).toBe(10)
  })
})

describe('measureMissingProductImageRecoveryPriority', () => {
  const viewport = {
    left: 0, top: 0, right: 800, bottom: 600,
    centerX: 400, centerY: 300
  }

  const makeCard = (bounds: any, overrides: any = {}) => ({
    visible: true,
    getBoundingRect: () => bounds,
    ...overrides
  })

  it('viewportRect null + selected=true: inView=true, distanceSq=0', () => {
    const card = makeCard(null)
    const r = measureMissingProductImageRecoveryPriority(card, null, card)
    expect(r.selected).toBe(true)
    expect(r.inView).toBe(true)
    expect(r.distanceSq).toBe(0)
  })

  it('viewportRect null + nao selected: inView=false, distanceSq=MAX', () => {
    const card = makeCard(null)
    const r = measureMissingProductImageRecoveryPriority(card, null, null)
    expect(r.selected).toBe(false)
    expect(r.inView).toBe(false)
    expect(r.distanceSq).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('card sem getBoundingRect: defaults', () => {
    const r = measureMissingProductImageRecoveryPriority({ visible: true }, viewport, null)
    expect(r.coverage).toBe(0)
  })

  it('card totalmente dentro do viewport: coverage=1', () => {
    const card = makeCard({ left: 100, top: 100, width: 200, height: 200 })
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.coverage).toBe(1)
    expect(r.inView).toBe(true)
  })

  it('card parcialmente fora: coverage proporcional', () => {
    // card 100x100 com left=750 (50px overlap horizontal × 100 = 5000 / 10000 = 0.5)
    const card = makeCard({ left: 750, top: 100, width: 100, height: 100 })
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.coverage).toBe(0.5)
  })

  it('card totalmente fora: coverage=0, inView=false', () => {
    const card = makeCard({ left: 1000, top: 1000, width: 100, height: 100 })
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.coverage).toBe(0)
    expect(r.inView).toBe(false)
  })

  it('distanceSq calcula distancia ao centro do viewport', () => {
    // card centro em (50, 50), viewport centro (400, 300)
    // dx=-350, dy=-250 → dist²=122500+62500=185000
    const card = makeCard({ left: 0, top: 0, width: 100, height: 100 })
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.distanceSq).toBe(185000)
  })

  it('card invisivel (visible=false): culled=true', () => {
    const card = makeCard({ left: 0, top: 0, width: 100, height: 100 }, { visible: false })
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.culled).toBe(true)
    expect(r.inView).toBe(false)
  })

  it('card com __viewportCulled: culled=true mesmo se visible=true', () => {
    const card = makeCard(
      { left: 0, top: 0, width: 100, height: 100 },
      { visible: true, __viewportCulled: true }
    )
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.culled).toBe(true)
  })

  it('selected=true: prioridade marcada', () => {
    const card = makeCard({ left: 0, top: 0, width: 100, height: 100 })
    const r = measureMissingProductImageRecoveryPriority(card, viewport, card)
    expect(r.selected).toBe(true)
  })

  it('error em getBoundingRect: cai em defaults seguros', () => {
    const card = {
      visible: true,
      getBoundingRect: () => { throw new Error('boom') }
    }
    const r = measureMissingProductImageRecoveryPriority(card, viewport, null)
    expect(r.selected).toBe(false)
    expect(r.distanceSq).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('computeMissingProductImageRecoveryViewportRect', () => {
  it('canvas dimensoes zero: null', () => {
    expect(computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 0, 0], 0, 600, 1))
      .toBeNull()
    expect(computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 0, 0], 800, 0, 1))
      .toBeNull()
  })

  it('vpt identidade + zoom 1: bounds = [0, 0, w, h]', () => {
    const r = computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 0, 0], 800, 600, 1)
    expect(r?.left === 0 || Object.is(r?.left, -0)).toBe(true)
    expect(r?.top === 0 || Object.is(r?.top, -0)).toBe(true)
    expect(r?.right).toBe(800)
    expect(r?.bottom).toBe(600)
    expect(r?.centerX).toBe(400)
    expect(r?.centerY).toBe(300)
  })

  it('zoom 2x: viewport ve metade do mundo', () => {
    const r = computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 0, 0], 800, 600, 2)
    expect(r?.right).toBe(400)
    expect(r?.bottom).toBe(300)
    expect(r?.centerX).toBe(200)
    expect(r?.centerY).toBe(150)
  })

  it('translate positivo no vpt: usuario panou pra esquerda no mundo', () => {
    // vpt[4]=200 → left_world = -200/1 = -200
    const r = computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 200, 100], 800, 600, 1)
    expect(r?.left).toBe(-200)
    expect(r?.top).toBe(-100)
    expect(r?.right).toBe(600)
    expect(r?.bottom).toBe(500)
  })

  it('zoom 0: cai em 1 via Number(0)||1, NAO clampa em 0.0001', () => {
    // Documentado: Number(0) || 1 vira 1, depois Math.max(0.0001, 1) = 1
    const r = computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 0, 0], 800, 600, 0)
    expect(r?.right).toBe(800)
  })

  it('zoom 0.00001: clampado em 0.0001 (evita div/0)', () => {
    // 0.00001 e' truthy mas menor que 0.0001 → Math.max clampa
    const r = computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1, 0, 0], 800, 600, 0.00001)
    // width = 800 / 0.0001 = 8_000_000
    expect(r?.right).toBe(8_000_000)
  })

  it('vpt invalido (null) usa identidade', () => {
    const r = computeMissingProductImageRecoveryViewportRect(null, 800, 600, 1)
    expect(r?.right).toBe(800)
    expect(r?.bottom).toBe(600)
  })

  it('vpt array short usa identidade', () => {
    const r = computeMissingProductImageRecoveryViewportRect([1, 0, 0, 1] as any, 800, 600, 1)
    expect(r?.right).toBe(800)
  })
})
