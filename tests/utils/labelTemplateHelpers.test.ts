import { describe, it, expect } from 'vitest'
import {
  getLabelTemplateTimestamp,
  shouldUseIncomingTemplateSnapshot
} from '~/utils/labelTemplateHelpers'

describe('getLabelTemplateTimestamp', () => {
  it('parse updatedAt como prioridade', () => {
    expect(getLabelTemplateTimestamp({
      updatedAt: '2026-04-30T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    })).toBe(Date.parse('2026-04-30T10:00:00Z'))
  })

  it('cai para createdAt quando nao ha updatedAt', () => {
    expect(getLabelTemplateTimestamp({
      createdAt: '2026-01-01T00:00:00Z'
    })).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('NaN para template sem timestamps', () => {
    expect(Number.isNaN(getLabelTemplateTimestamp({}))).toBe(true)
    expect(Number.isNaN(getLabelTemplateTimestamp(null))).toBe(true)
    expect(Number.isNaN(getLabelTemplateTimestamp(undefined))).toBe(true)
  })

  it('NaN para data invalida', () => {
    expect(Number.isNaN(getLabelTemplateTimestamp({ updatedAt: 'not-a-date' }))).toBe(true)
  })
})

describe('shouldUseIncomingTemplateSnapshot', () => {
  it('local override no incoming sempre vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2030-01-01' }, // prev mais novo, sem override
      { updatedAt: '2020-01-01', __localOverride: true }
    )).toBe(true)
  })

  it('local override no prev mantem prev', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2020-01-01', __localOverride: true },
      { updatedAt: '2030-01-01' }
    )).toBe(false)
  })

  it('mesmo nivel (ambos sem override): mais novo vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2026-01-01' },
      { updatedAt: '2026-04-30' }
    )).toBe(true)
  })

  it('mesmo nivel (ambos local-override): mais novo vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2026-04-30', __localOverride: true },
      { updatedAt: '2026-01-01', __localOverride: true }
    )).toBe(false)
  })

  it('empate de timestamp: incoming wins (>=)', () => {
    const ts = '2026-04-30T10:00:00Z'
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: ts },
      { updatedAt: ts }
    )).toBe(true)
  })

  it('apenas incoming tem timestamp: incoming vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      {},
      { updatedAt: '2026-01-01' }
    )).toBe(true)
  })

  it('apenas prev tem timestamp: prev vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2026-01-01' },
      {}
    )).toBe(false)
  })

  it('nenhum dos dois tem timestamp: incoming vence (legacy hydration)', () => {
    expect(shouldUseIncomingTemplateSnapshot({}, {})).toBe(true)
    expect(shouldUseIncomingTemplateSnapshot(null, null)).toBe(true)
  })
})
