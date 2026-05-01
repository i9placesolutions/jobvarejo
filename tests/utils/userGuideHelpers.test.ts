import { describe, it, expect } from 'vitest'
import { isUserGuideObject, getUserGuideAxisAndPos } from '~/utils/userGuideHelpers'

describe('isUserGuideObject', () => {
  it('aceita por flag isUserGuide', () => {
    expect(isUserGuideObject({ isUserGuide: true })).toBe(true)
  })

  it('aceita por guideAxis x ou y', () => {
    expect(isUserGuideObject({ guideAxis: 'x' })).toBe(true)
    expect(isUserGuideObject({ guideAxis: 'y' })).toBe(true)
  })

  it('aceita por id com prefixo guide-user-', () => {
    expect(isUserGuideObject({ id: 'guide-user-1' })).toBe(true)
    expect(isUserGuideObject({ id: 'guide-user-abc' })).toBe(true)
  })

  it('rejeita objeto sem nenhum sinal', () => {
    expect(isUserGuideObject({ id: 'frame-1' })).toBe(false)
    expect(isUserGuideObject({})).toBe(false)
  })

  it('rejeita null/undefined', () => {
    expect(isUserGuideObject(null)).toBe(false)
    expect(isUserGuideObject(undefined)).toBe(false)
  })

  it('guideAxis com valor invalido nao basta', () => {
    expect(isUserGuideObject({ guideAxis: 'z' })).toBe(false)
  })
})

describe('getUserGuideAxisAndPos', () => {
  it('null retorna null', () => {
    expect(getUserGuideAxisAndPos(null)).toBeNull()
  })

  it('usa guideAxis explicito quando definido', () => {
    expect(getUserGuideAxisAndPos({ guideAxis: 'x', x1: 100 }))
      .toEqual({ axis: 'x', pos: 100 })
    expect(getUserGuideAxisAndPos({ guideAxis: 'y', y1: 50 }))
      .toEqual({ axis: 'y', pos: 50 })
  })

  it('infere eixo "x" quando x1 == x2 (linha vertical)', () => {
    expect(getUserGuideAxisAndPos({ x1: 100, x2: 100, y1: 0, y2: 999 }))
      .toEqual({ axis: 'x', pos: 100 })
  })

  it('infere eixo "y" quando x1 != x2 (linha horizontal)', () => {
    expect(getUserGuideAxisAndPos({ x1: 0, x2: 999, y1: 50, y2: 50 }))
      .toEqual({ axis: 'y', pos: 50 })
  })

  it('fallback left/top quando x1/y1 ausentes', () => {
    expect(getUserGuideAxisAndPos({ guideAxis: 'x', left: 200 }))
      .toEqual({ axis: 'x', pos: 200 })
    expect(getUserGuideAxisAndPos({ guideAxis: 'y', top: 80 }))
      .toEqual({ axis: 'y', pos: 80 })
  })

  it('pos NaN retorna null', () => {
    expect(getUserGuideAxisAndPos({ guideAxis: 'x', x1: 'abc', left: 'def' })).toBeNull()
  })
})
