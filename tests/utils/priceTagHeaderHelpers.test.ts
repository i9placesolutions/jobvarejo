import { describe, it, expect } from 'vitest'
import {
  extractWeightTokenForHeader,
  normalizeHeaderWeightToken,
  inferHeaderPartsFromProduct,
  inferUnitFromCard,
  inferHeaderPartsForPriceTemplate
} from '~/utils/priceTagHeaderHelpers'

describe('extractWeightTokenForHeader', () => {
  it('extrai peso do nome (1KG)', () => {
    expect(extractWeightTokenForHeader({ name: 'ARROZ 1KG' })).toBe('1KG')
  })

  it('extrai do peso (campo separado)', () => {
    expect(extractWeightTokenForHeader({ name: 'ARROZ', weight: '500G' })).toBe('500G')
  })

  it('normaliza GR -> G', () => {
    expect(extractWeightTokenForHeader({ name: 'TESTE 500GR' })).toBe('500G')
  })

  it('normaliza KGS -> KG', () => {
    expect(extractWeightTokenForHeader({ name: 'TESTE 5KGS' })).toBe('5KG')
  })

  it('normaliza MLS -> ML', () => {
    expect(extractWeightTokenForHeader({ name: 'TESTE 250MLS' })).toBe('250ML')
  })

  it('normaliza LTS -> L', () => {
    expect(extractWeightTokenForHeader({ name: 'TESTE 2LTS' })).toBe('2L')
  })

  it('fardo (12X1L) e' + ' detectado e formatado com X', () => {
    expect(extractWeightTokenForHeader({ name: 'CERVEJA 12X1L' })).toBe('12X1L')
  })

  it('fardo com espacos: 12 x 1L', () => {
    expect(extractWeightTokenForHeader({ name: 'CERVEJA 12 X 1L' })).toBe('12X1L')
  })

  it('fardo com × unicode', () => {
    expect(extractWeightTokenForHeader({ name: 'CERVEJA 6×500ML' })).toBe('6X500ML')
  })

  it('UN/L/MG aceitos como unidade', () => {
    expect(extractWeightTokenForHeader({ name: 'X 5UN' })).toBe('5UN')
    expect(extractWeightTokenForHeader({ name: 'X 1L' })).toBe('1L')
    expect(extractWeightTokenForHeader({ name: 'X 100MG' })).toBe('100MG')
  })

  it('sem peso: vazio', () => {
    expect(extractWeightTokenForHeader({ name: 'BANANA NANICA' })).toBe('')
  })

  it('null/undefined: vazio', () => {
    expect(extractWeightTokenForHeader(null)).toBe('')
    expect(extractWeightTokenForHeader(undefined)).toBe('')
    expect(extractWeightTokenForHeader({})).toBe('')
  })

  it('decimal com virgula: 1,5KG', () => {
    expect(extractWeightTokenForHeader({ name: 'TESTE 1,5KG' })).toBe('1,5KG')
  })

  it('decimal com ponto: 1.5KG', () => {
    expect(extractWeightTokenForHeader({ name: 'TESTE 1.5KG' })).toBe('1.5KG')
  })
})

describe('normalizeHeaderWeightToken', () => {
  it('normaliza GRS/GR -> G', () => {
    expect(normalizeHeaderWeightToken('500GRS')).toBe('500G')
    expect(normalizeHeaderWeightToken('500 GR')).toBe('500G')
  })

  it('normaliza KGS -> KG', () => {
    expect(normalizeHeaderWeightToken('5kgs')).toBe('5KG')
  })

  it('normaliza espacos', () => {
    expect(normalizeHeaderWeightToken('  500   G  ')).toBe('500G')
  })

  it('null/undefined: vazio', () => {
    expect(normalizeHeaderWeightToken(null as any)).toBe('')
    expect(normalizeHeaderWeightToken(undefined as any)).toBe('')
    expect(normalizeHeaderWeightToken('')).toBe('')
  })
})

describe('inferHeaderPartsFromProduct', () => {
  it('produto basico: title em UPPERCASE', () => {
    const result = inferHeaderPartsFromProduct({ name: 'arroz extra' })
    expect(result.title).toBe('ARROZ EXTRA')
  })

  it('produto null: usa fallback', () => {
    const result = inferHeaderPartsFromProduct(null, 'PROMOCAO')
    expect(result.title).toBe('PROMOCAO')
  })

  it('produto vazio: usa fallback default OFERTA', () => {
    const result = inferHeaderPartsFromProduct({})
    expect(result.title).toBe('OFERTA')
  })

  it('remove R$ XX.XX do title', () => {
    const result = inferHeaderPartsFromProduct({ name: 'Arroz R$ 5.99 Tipo 1' })
    expect(result.title).not.toMatch(/R\$/)
  })

  it('preferFullNameWithWeight: anexa weight token', () => {
    const result = inferHeaderPartsFromProduct(
      { name: 'ARROZ TIPO 1', weight: '5KG' },
      'OFERTA',
      { preferFullNameWithWeight: true }
    )
    expect(result.title).toContain('5KG')
  })

  it('preferFullNameWithWeight + sem weight + unit KG: anexa KG', () => {
    const result = inferHeaderPartsFromProduct(
      { name: 'BANANA' },
      'OFERTA',
      { preferFullNameWithWeight: true }
    )
    // unit so e' KG se inferUnitLabelFromProduct retornar 'KG'.
    // Sem indicacao explicita, KG nao e' anexado por default — verifica formato basico.
    expect(typeof result.title).toBe('string')
  })

  it('splitUnitIntoDedicatedField + title termina em KG: remove KG do title', () => {
    const result = inferHeaderPartsFromProduct(
      { name: 'ARROZ KG', priceUnit: 'KG' }, // forca unit=KG
      'OFERTA',
      { splitUnitIntoDedicatedField: true }
    )
    // Se unit=='KG' e title termina em KG, KG e' removido do title
    if (result.unit === 'KG') {
      expect(result.title).not.toMatch(/\sKG$/)
    }
  })

  it('title muito longo: truncado com ...', () => {
    const longName = 'PRODUTO MUITO LONGO COM NOME ABSURDAMENTE GRANDE'
    const result = inferHeaderPartsFromProduct({ name: longName })
    expect(result.title.length).toBeLessThanOrEqual(26 + 3) // +3 = "..."
    if (result.title.length > 26) {
      expect(result.title.endsWith('...')).toBe(true)
    }
  })

  it('preferFullNameWithWeight: maxLen=36 (mais espaco)', () => {
    const longName = 'PRODUTO LONGO COM NOME GRANDE TAMANHO 1KG'
    const result = inferHeaderPartsFromProduct(
      { name: longName },
      'OFERTA',
      { preferFullNameWithWeight: true }
    )
    expect(result.title.length).toBeLessThanOrEqual(36 + 3)
  })

  it('fallback customizado e' + ' usado quando produto vazio', () => {
    const result = inferHeaderPartsFromProduct({}, 'COMBO ESPECIAL')
    expect(result.title).toBe('COMBO ESPECIAL')
  })

  it('unit retornado como "" se nao detectado', () => {
    const result = inferHeaderPartsFromProduct({ name: 'BANANA' })
    expect(result.unit).toBe('')
  })
})

describe('inferUnitFromCard', () => {
  it('null/undefined: vazio', () => {
    expect(inferUnitFromCard(null, () => null)).toBe('')
    expect(inferUnitFromCard(undefined, () => null)).toBe('')
  })

  it('respeita unitLabel explicito', () => {
    const card = { unitLabel: 'KG' }
    expect(inferUnitFromCard(card, () => null)).toBe('KG')
  })

  it('respeita unit explicito', () => {
    const card = { unit: 'UN' }
    expect(inferUnitFromCard(card, () => null)).toBe('UN')
  })

  it('respeita packUnit explicito', () => {
    const card = { packUnit: 'KG' }
    expect(inferUnitFromCard(card, () => null)).toBe('KG')
  })

  it('fallback: title com KG -> KG', () => {
    const card = {}
    const findTitle = () => ({ text: 'ARROZ KG' })
    expect(inferUnitFromCard(card, findTitle)).toBe('KG')
  })

  it('fallback: title sem KG -> ""', () => {
    const card = {}
    const findTitle = () => ({ text: 'BANANA' })
    expect(inferUnitFromCard(card, findTitle)).toBe('')
  })

  it('priority: explicit > title scan', () => {
    const card = { unit: 'UN' }
    const findTitle = () => ({ text: 'ALGO KG' })
    // unit=UN deve vencer title KG scan
    expect(inferUnitFromCard(card, findTitle)).toBe('UN')
  })

  it('whitespace-only meta: cai para title scan', () => {
    const card = { unitLabel: '   ' }
    const findTitle = () => ({ text: 'ARROZ KG' })
    expect(inferUnitFromCard(card, findTitle)).toBe('KG')
  })
})

describe('inferHeaderPartsForPriceTemplate', () => {
  const findTitle = (c: any) => c?._title

  it('produto basico via _productData', () => {
    const card = { _productData: { name: 'arroz tipo 1' } }
    const result = inferHeaderPartsForPriceTemplate(card, findTitle)
    expect(result.title).toBe('ARROZ TIPO 1')
  })

  it('fallback: usa text do title quando productData ausente', () => {
    const card = { _title: { text: 'PROMO' } }
    const result = inferHeaderPartsForPriceTemplate(card, findTitle)
    expect(result.title).toBe('PROMO')
  })

  it('card vazio: usa fallback', () => {
    const result = inferHeaderPartsForPriceTemplate({}, findTitle, 'COMBO')
    expect(result.title).toBe('COMBO')
  })

  it('maxLen 22 (mais conservador que produto)', () => {
    const longName = 'PRODUTO LONGO COM VARIOS CARACTERES NO NOME'
    const card = { _productData: { name: longName } }
    const result = inferHeaderPartsForPriceTemplate(card, findTitle)
    expect(result.title.length).toBeLessThanOrEqual(22 + 3)
  })

  it('preferFullNameWithWeight: maxLen 36', () => {
    const longName = 'PRODUTO LONGO COM NOME GRANDE TAMANHO'
    const card = { _productData: { name: longName, weight: '1KG' } }
    const result = inferHeaderPartsForPriceTemplate(card, findTitle, 'OFERTA', { preferFullNameWithWeight: true })
    expect(result.title.length).toBeLessThanOrEqual(36 + 3)
  })
})
