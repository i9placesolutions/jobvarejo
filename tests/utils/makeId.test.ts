import { describe, it, expect } from 'vitest'
import { makeId } from '~/utils/makeId'

describe('makeId — gerador de IDs do editor', () => {
  it('retorna string com exatamente 12 chars', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = makeId()
      expect(id.length).toBe(12)
    }
  })

  it('alfanumerico (sem traco / espaco)', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(makeId()).toMatch(/^[a-z0-9]{12}$/i)
    }
  })

  it('produz ids unicos em volume razoavel (sem colisao em 5000 chamadas)', () => {
    const set = new Set<string>()
    for (let i = 0; i < 5000; i += 1) {
      set.add(makeId())
    }
    expect(set.size).toBe(5000)
  })
})
