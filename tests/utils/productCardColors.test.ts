import { describe, expect, it } from 'vitest'
import { resolveProductCardColor, findFlyerAccent } from '../../utils/productCardColors'

describe('cores dos cards', () => {
  const styles = { cardColorMode: 'auto' as const, highlightCardColor: '#ffcc00', cardColor: '#ff0000' }
  it('colore somente destaques e preserva escolhas individuais inclusive branco', () => {
    expect(resolveProductCardColor(styles, true)).toBe('#ffcc00')
    expect(resolveProductCardColor(styles, false)).toBe('#ffffff')
    expect(resolveProductCardColor(styles, true, { cardColor: '#ffffff' })).toBe('#ffffff')
    expect(resolveProductCardColor(styles, true, { isProdBgTransparent: true })).toBe('transparent')
    expect(resolveProductCardColor({ ...styles, cardColorMode: 'manual' }, false)).toBe('#ff0000')
    expect(resolveProductCardColor(JSON.parse(JSON.stringify(styles)), true)).toBe('#ffcc00')
  })
  it('usa arte do encarte, ignorando cores neutras e produtos', () => {
    expect(findFlyerAccent([
      { fill: '#ffffff', width: 1000, height: 1000 },
      { fill: '#ffcc00', width: 500, height: 500 },
      { parentZoneId: 'zone', fill: '#ff0000', width: 1000, height: 1000 },
      { fill: '#0000ff', width: 30, height: 30 }
    ])).toBe('#ffcc00')
    expect(findFlyerAccent([{ fill: '#ffffff' }])).toBeNull()
  })
})
