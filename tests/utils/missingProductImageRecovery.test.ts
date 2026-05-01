import { describe, it, expect } from 'vitest'
import {
  MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH,
  MISSING_PRODUCT_IMAGE_RECOVERY_MAX_BATCH,
  compareMissingProductImageRecoveryCandidates,
  getMissingProductImageRecoveryBatchLimit,
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
