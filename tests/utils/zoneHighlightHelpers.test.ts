import { describe, it, expect } from 'vitest'
import {
  stableHash32,
  getZoneHighlightPredicate
} from '~/utils/zoneHighlightHelpers'

describe('stableHash32', () => {
  it('determinismo: mesma entrada → mesmo hash', () => {
    expect(stableHash32('foo')).toBe(stableHash32('foo'))
    expect(stableHash32('hello world')).toBe(stableHash32('hello world'))
  })

  it('entradas diferentes → hashes (geralmente) diferentes', () => {
    expect(stableHash32('a')).not.toBe(stableHash32('b'))
    expect(stableHash32('foo')).not.toBe(stableHash32('foo2'))
  })

  it('string vazia retorna hash bem definido', () => {
    expect(stableHash32('')).toBe(0x811c9dc5) // FNV offset basis
  })

  it('hash sempre uint32 (>=0, <2^32)', () => {
    const hashes = ['', 'a', 'foo', 'hello world', 'abc'.repeat(100)]
      .map(stableHash32)
    hashes.forEach(h => {
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(2 ** 32)
      expect(Number.isInteger(h)).toBe(true)
    })
  })
})

describe('getZoneHighlightPredicate', () => {
  const card = (id: string) => ({ _customId: id })

  it('zone sem highlightCount → predicate trivial sempre-false', () => {
    const cards = [card('a'), card('b'), card('c')]
    const result = getZoneHighlightPredicate({}, cards)
    expect(result.count).toBe(0)
    expect(result.mult).toBe(1)
    expect(result.isHighlighted(cards[0], 0)).toBe(false)
  })

  it('mult <= 1 → predicate trivial', () => {
    const result = getZoneHighlightPredicate({ highlightCount: 2, highlightHeight: 1 }, [card('a'), card('b')])
    expect(result.count).toBe(0)
    expect(result.isHighlighted(null, 0)).toBe(false)
  })

  it('first/top: destaca os primeiros N', () => {
    const cards = [card('a'), card('b'), card('c'), card('d')]
    const result = getZoneHighlightPredicate({ highlightCount: 2, highlightHeight: 2 }, cards)
    expect(result.count).toBe(2)
    expect(result.mult).toBe(2)
    expect(result.isHighlighted(cards[0], 0)).toBe(true)
    expect(result.isHighlighted(cards[1], 1)).toBe(true)
    expect(result.isHighlighted(cards[2], 2)).toBe(false)
  })

  it('default pos = first quando ausente', () => {
    const cards = [card('a'), card('b'), card('c')]
    const result = getZoneHighlightPredicate({ highlightCount: 1, highlightHeight: 2 }, cards)
    expect(result.isHighlighted(cards[0], 0)).toBe(true)
    expect(result.isHighlighted(cards[1], 1)).toBe(false)
  })

  it('last/bottom: destaca os ultimos N', () => {
    const cards = [card('a'), card('b'), card('c'), card('d')]
    const result = getZoneHighlightPredicate(
      { highlightCount: 2, highlightHeight: 2, highlightPos: 'last' },
      cards
    )
    expect(result.isHighlighted(cards[2], 2)).toBe(true)
    expect(result.isHighlighted(cards[3], 3)).toBe(true)
    expect(result.isHighlighted(cards[0], 0)).toBe(false)
  })

  it('center: destaca os do meio', () => {
    const cards = [card('a'), card('b'), card('c'), card('d'), card('e')]
    const result = getZoneHighlightPredicate(
      { highlightCount: 3, highlightHeight: 2, highlightPos: 'center' },
      cards
    )
    expect(result.isHighlighted(cards[1], 1)).toBe(true)
    expect(result.isHighlighted(cards[2], 2)).toBe(true)
    expect(result.isHighlighted(cards[3], 3)).toBe(true)
    expect(result.isHighlighted(cards[0], 0)).toBe(false)
    expect(result.isHighlighted(cards[4], 4)).toBe(false)
  })

  it('random: deterministico via stableHash32', () => {
    const cards = [card('a'), card('b'), card('c'), card('d'), card('e')]
    const zone = { _customId: 'z1', highlightCount: 2, highlightHeight: 2, highlightPos: 'random' }
    const r1 = getZoneHighlightPredicate(zone, cards)
    const r2 = getZoneHighlightPredicate(zone, cards)
    // Mesma zona + mesmos cards → mesma selecao
    cards.forEach((c, i) => {
      expect(r1.isHighlighted(c, i)).toBe(r2.isHighlighted(c, i))
    })
    // Total destacados = highlightCount
    const highlighted = cards.filter((c, i) => r1.isHighlighted(c, i))
    expect(highlighted).toHaveLength(2)
  })

  it('zoneId diferente → selecao random diferente (geralmente)', () => {
    const cards = [card('a'), card('b'), card('c'), card('d'), card('e')]
    const r1 = getZoneHighlightPredicate(
      { _customId: 'z1', highlightCount: 2, highlightHeight: 2, highlightPos: 'random' },
      cards
    )
    const r2 = getZoneHighlightPredicate(
      { _customId: 'z99', highlightCount: 2, highlightHeight: 2, highlightPos: 'random' },
      cards
    )
    // Pelo menos um card terá decisao diferente entre as duas zonas
    const someDifference = cards.some((c, i) => r1.isHighlighted(c, i) !== r2.isHighlighted(c, i))
    expect(someDifference).toBe(true)
  })

  it('count clampado em [0, cards.length]', () => {
    const cards = [card('a'), card('b')]
    const r1 = getZoneHighlightPredicate({ highlightCount: 999, highlightHeight: 2 }, cards)
    expect(r1.count).toBe(2)
    const r2 = getZoneHighlightPredicate({ highlightCount: -5, highlightHeight: 2 }, cards)
    expect(r2.count).toBe(0)
  })

  it('mult clampado em [1, 4]', () => {
    const cards = [card('a'), card('b')]
    const r1 = getZoneHighlightPredicate({ highlightCount: 1, highlightHeight: 99 }, cards)
    expect(r1.mult).toBe(4)
    const r2 = getZoneHighlightPredicate({ highlightCount: 1, highlightHeight: 0.5 }, cards)
    expect(r2.mult).toBe(1) // mult<=1 → trivial
  })

  it('cards array vazio → trivial', () => {
    const result = getZoneHighlightPredicate({ highlightCount: 5, highlightHeight: 2 }, [])
    expect(result.count).toBe(0)
  })

  it('NaN values caem em defaults seguros', () => {
    const cards = [card('a')]
    const result = getZoneHighlightPredicate(
      { highlightCount: NaN, highlightHeight: NaN },
      cards
    )
    expect(result.count).toBe(0)
    expect(result.mult).toBe(1)
  })
})
