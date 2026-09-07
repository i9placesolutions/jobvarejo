import { describe, expect, it } from 'vitest'
import {
  createDefaultBuilderThemeComposition,
  ensureBuilderThemeComposition,
  hasBuilderThemeComposition,
  normalizeBuilderThemeComposition,
  shouldRevealBackgroundThroughProductZone,
} from '~/utils/builderThemeComposition'

describe('builderThemeComposition', () => {
  it('cria uma composição inicial com zona de produtos e campos reutilizáveis', () => {
    const composition = createDefaultBuilderThemeComposition()
    expect(composition.version).toBe(1)
    expect(composition.elements.some(element => element.kind === 'product_zone')).toBe(true)
    expect(composition.elements.some(element => element.field === 'logo')).toBe(true)
    expect(composition.elements.some(element => element.field === 'whatsapp')).toBe(true)
    expect(composition.elements.find(element => element.kind === 'product_zone')?.style?.backgroundColor).toBe('transparent')
  })

  it('normaliza posição e tamanho para não extrapolar o canvas', () => {
    const composition = normalizeBuilderThemeComposition({
      background: { color: '#abc' },
      elements: [{ id: 'x', kind: 'text', x: 90, y: 95, width: 80, height: 80 }],
    })
    expect(composition.elements[0]).toMatchObject({ x: 90, y: 95, width: 10, height: 5 })
  })

  it('diferencia tema legado de composição ativada', () => {
    expect(hasBuilderThemeComposition({})).toBe(false)
    expect(hasBuilderThemeComposition(createDefaultBuilderThemeComposition())).toBe(true)
    expect(hasBuilderThemeComposition({ elements: [{ kind: 'product_zone', visible: false }] })).toBe(false)
    expect(ensureBuilderThemeComposition({}).elements.some(element => element.kind === 'product_zone')).toBe(true)
  })

  it('preserva uma arte de fundo sob a zona de produtos padrão legada', () => {
    const legacyZone = {
      kind: 'product_zone' as const,
      style: {
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderRadius: 8,
        opacity: 0.98,
        padding: 0.8,
      },
    }

    expect(shouldRevealBackgroundThroughProductZone(legacyZone, true)).toBe(true)
    expect(shouldRevealBackgroundThroughProductZone(legacyZone, false)).toBe(false)
    expect(shouldRevealBackgroundThroughProductZone({
      ...legacyZone,
      style: { ...legacyZone.style, backgroundColor: '#111827' },
    }, true)).toBe(false)
  })
})
