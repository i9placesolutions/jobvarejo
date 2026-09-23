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
    expect(findFlyerAccent([
      { name: 'product-area-background', fill: '#ffe529', width: 1000, height: 1000 },
      { fill: '#b91c1c', width: 900, height: 900 }
    ])).toBe('#b91c1c')
  })
})

import { resolveFlyerProductStyles } from '../../utils/productCardColors'
it('troca amarelo legado pela arte de cada modelo e reage à troca da paleta', () => {
  const styles = { cardColorMode: 'auto' as const, highlightCardColor: '#ffcc00' }
  for (const fill of ['#135ab4', '#7f228a', '#198b42']) {
    const resolved = resolveFlyerProductStyles(styles, [{ width: 1000, height: 1000, fill }])
    expect(resolveProductCardColor(resolved, true)).toBe(fill)
    expect(resolveProductCardColor(resolved, false)).toBe('#ffffff')
  }
})
it('a arte define o destaque automático; escolha explícita prevalece', () => {
  const roots = [{ fill: '#135ab4', width: 1000, height: 1000 }]
  const configured = resolveFlyerProductStyles({ templateProductPalette: { highlightCardColor: '#228833' } }, roots)
  expect(resolveProductCardColor(configured, true)).toBe('#135ab4')
  const custom = resolveFlyerProductStyles({ productPalette: { highlightCardColor: '#ffcc00' } }, roots)
  expect(resolveProductCardColor(custom, true)).toBe('#ffcc00')
  expect(resolveProductCardColor(resolveFlyerProductStyles({ templateProductPalette: { highlightCardColor: '#228833' } }, []), true)).toBe('#228833')
  const manual = { cardColorMode: 'manual' as const, cardColor: '#ffffff' }
  expect(resolveFlyerProductStyles(manual, roots)).toBe(manual)
})
it('ignora a cor amarela da etiqueta e mantém a cor dos cards comuns legados', () => {
  const roots = [{ fill: '#135ab4', width: 500, height: 500 }, { name: 'priceGroup', fill: '#ffcc00', width: 2000, height: 2000 }]
  const resolved = resolveFlyerProductStyles({ cardColor: '#eeeeee', highlightCardColor: '#ffcc00' }, roots)
  expect(resolveProductCardColor(resolved, true)).toBe('#135ab4')
  expect(resolveProductCardColor(resolved, false)).toBe('#eeeeee')
})
it('respeita destaque escolhido no painel e reconhece paleta de gradientes', () => {
  const roots = [{ width: 1000, height: 1000, fill: { colorStops: [{ color: '#135ab4' }, { color: '#135ab4' }] } }]
  expect(resolveProductCardColor(resolveFlyerProductStyles({}, roots), true)).toBe('#135ab4')
  const selected = resolveFlyerProductStyles({ highlightCardColor: '#ffcc00' }, roots, { highlightCardColor: true })
  expect(resolveProductCardColor(selected, true)).toBe('#ffcc00')
})
