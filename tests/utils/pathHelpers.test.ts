import { describe, it, expect } from 'vitest'
import { buildPathStringFromPenData } from '~/utils/pathHelpers'

describe('buildPathStringFromPenData', () => {
  it('array vazio/null retorna string vazia', () => {
    expect(buildPathStringFromPenData([])).toBe('')
    expect(buildPathStringFromPenData(null as any)).toBe('')
    expect(buildPathStringFromPenData(undefined as any)).toBe('')
  })

  it('um ponto: apenas Move', () => {
    expect(buildPathStringFromPenData([{ x: 10, y: 20 }])).toBe('M 10 20')
  })

  it('dois pontos sem handles: M + L', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ])).toBe('M 0 0 L 100 100')
  })

  it('curva Bezier quando ha handles.in no ponto atual', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0, handles: { out: { x: 10, y: 0 } } },
      { x: 100, y: 100, handles: { in: { x: 90, y: 100 } } }
    ])).toBe('M 0 0 C 10 0, 90 100, 100 100')
  })

  it('handles.out ausente no anterior: cp1 = ponto anterior', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0 },
      { x: 100, y: 100, handles: { in: { x: 90, y: 100 } } }
    ])).toBe('M 0 0 C 0 0, 90 100, 100 100')
  })

  it('mistura de Bezier e linha', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0 },
      { x: 50, y: 50, handles: { in: { x: 25, y: 50 } } },
      { x: 100, y: 0 }
    ])).toBe('M 0 0 C 0 0, 25 50, 50 50 L 100 0')
  })

  it('closed=true com 3+ pontos: Z no final', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 }
    ], true)).toBe('M 0 0 L 100 0 L 50 100 Z')
  })

  it('closed=true com so 2 pontos: NAO adiciona Z (nao e poligono)', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ], true)).toBe('M 0 0 L 100 100')
  })

  it('closed=false: nunca adiciona Z', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 }
    ], false)).toBe('M 0 0 L 100 0 L 50 100')
  })

  it('REGRESSAO: handles vazios nao quebram', () => {
    expect(buildPathStringFromPenData([
      { x: 0, y: 0, handles: {} },
      { x: 100, y: 100, handles: {} }
    ])).toBe('M 0 0 L 100 100')
  })
})
