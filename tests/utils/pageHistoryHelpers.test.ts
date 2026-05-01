import { describe, it, expect } from 'vitest'
import {
  getHistoryRestoreKey,
  historyItemIsLatest
} from '~/utils/pageHistoryHelpers'
import type { PageHistoryItem } from '~/utils/pageHistoryHelpers'

const makeItem = (overrides: Partial<PageHistoryItem> = {}): PageHistoryItem => ({
  source: 'version',
  key: 'page-1',
  lastModified: '2026-01-01T00:00:00Z',
  ...overrides
})

describe('getHistoryRestoreKey', () => {
  it('combina source + key + versionId', () => {
    expect(getHistoryRestoreKey(makeItem({
      source: 'version',
      key: 'page-1',
      versionId: 'v123'
    }))).toBe('version:page-1:v123')
  })

  it('versionId ausente vira string vazia', () => {
    expect(getHistoryRestoreKey(makeItem({
      source: 'history',
      key: 'page-2'
    }))).toBe('history:page-2:')
  })

  it('versionId null vira string vazia', () => {
    expect(getHistoryRestoreKey(makeItem({
      source: 'current',
      key: 'page-3',
      versionId: null
    }))).toBe('current:page-3:')
  })

  it('mesma entrada gera mesma chave (estabilidade)', () => {
    const item = makeItem({ source: 'version', key: 'p', versionId: 'v' })
    expect(getHistoryRestoreKey(item)).toBe(getHistoryRestoreKey(item))
  })

  it('items diferentes geram chaves diferentes', () => {
    const a = makeItem({ source: 'version', key: 'p', versionId: 'v1' })
    const b = makeItem({ source: 'version', key: 'p', versionId: 'v2' })
    expect(getHistoryRestoreKey(a)).not.toBe(getHistoryRestoreKey(b))
  })

  it('source diferente: chave diferente mesmo com mesmo key/versionId', () => {
    const a = makeItem({ source: 'version', key: 'p', versionId: 'v' })
    const b = makeItem({ source: 'history', key: 'p', versionId: 'v' })
    expect(getHistoryRestoreKey(a)).not.toBe(getHistoryRestoreKey(b))
  })
})

describe('historyItemIsLatest', () => {
  const a = makeItem({ source: 'version', key: 'a' })
  const b = makeItem({ source: 'history', key: 'b' })
  const c = makeItem({ source: 'current', key: 'c' })

  it('idx > 0 sempre false', () => {
    expect(historyItemIsLatest(1, [a, b])).toBe(false)
    expect(historyItemIsLatest(2, [a, b, c])).toBe(false)
  })

  it('idx 0 com source nao-current → true', () => {
    expect(historyItemIsLatest(0, [a, b])).toBe(true)
    expect(historyItemIsLatest(0, [b])).toBe(true)
  })

  it('idx 0 com source=current → false (ja tem outra badge)', () => {
    expect(historyItemIsLatest(0, [c, a])).toBe(false)
  })

  it('lista vazia → false', () => {
    expect(historyItemIsLatest(0, [])).toBe(false)
  })
})
