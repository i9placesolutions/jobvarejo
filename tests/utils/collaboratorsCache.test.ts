import { describe, it, expect } from 'vitest'
import { COLLABORATORS_CACHE_MS, isCollaboratorsCacheValid } from '~/utils/collaboratorsCache'

describe('COLLABORATORS_CACHE_MS', () => {
  it('= 15s (balanco frescor-vs-custo)', () => {
    expect(COLLABORATORS_CACHE_MS).toBe(15_000)
    expect(COLLABORATORS_CACHE_MS).toBeGreaterThan(0)
  })
})

describe('isCollaboratorsCacheValid', () => {
  const baseInput = {
    force: false,
    cacheLength: 3,
    cachedUserId: 'u-1',
    currentUserId: 'u-1',
    loadedAt: 1000,
    now: 1000 + 5000
  }

  it('cache valido dentro do TTL', () => {
    expect(isCollaboratorsCacheValid(baseInput)).toBe(true)
  })

  it('force=true sempre invalida', () => {
    expect(isCollaboratorsCacheValid({ ...baseInput, force: true })).toBe(false)
  })

  it('cacheLength 0 invalida', () => {
    expect(isCollaboratorsCacheValid({ ...baseInput, cacheLength: 0 })).toBe(false)
  })

  it('userId divergente invalida (mudou de conta)', () => {
    expect(isCollaboratorsCacheValid({
      ...baseInput,
      cachedUserId: 'u-1',
      currentUserId: 'u-2'
    })).toBe(false)
  })

  it('null currentUserId vs cached u-1: invalida', () => {
    expect(isCollaboratorsCacheValid({
      ...baseInput,
      cachedUserId: 'u-1',
      currentUserId: null
    })).toBe(false)
  })

  it('ambos null userId: valido (logged-out reuse)', () => {
    expect(isCollaboratorsCacheValid({
      ...baseInput,
      cachedUserId: null,
      currentUserId: null
    })).toBe(true)
  })

  it('TTL expirado invalida', () => {
    expect(isCollaboratorsCacheValid({
      ...baseInput,
      loadedAt: 0,
      now: COLLABORATORS_CACHE_MS + 100
    })).toBe(false)
  })

  it('TTL exato no limite: invalida (>= cutoff e' + ' fresh)', () => {
    expect(isCollaboratorsCacheValid({
      ...baseInput,
      loadedAt: 0,
      now: COLLABORATORS_CACHE_MS
    })).toBe(false) // strict < (igual nao passa)
  })

  it('now omitido usa Date.now() (sanity check: chamada nao quebra)', () => {
    expect(typeof isCollaboratorsCacheValid({
      force: false,
      cacheLength: 1,
      cachedUserId: 'u-1',
      currentUserId: 'u-1',
      loadedAt: Date.now()
    })).toBe('boolean')
  })
})
