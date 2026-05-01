import { describe, it, expect } from 'vitest'
import {
  getSpecialConditionFromProduct,
  getAvailablePrices
} from '~/utils/productPriceHelpers'

describe('getSpecialConditionFromProduct', () => {
  it('null/undefined/non-object → null', () => {
    expect(getSpecialConditionFromProduct(null)).toBeNull()
    expect(getSpecialConditionFromProduct(undefined)).toBeNull()
    expect(getSpecialConditionFromProduct('string' as any)).toBeNull()
  })

  it('le specialCondition canonico', () => {
    expect(getSpecialConditionFromProduct({ specialCondition: 'Promo' })).toBe('Promo')
  })

  it('fallback ordem: condition → observation → observations', () => {
    expect(getSpecialConditionFromProduct({ condition: 'A' })).toBe('A')
    expect(getSpecialConditionFromProduct({ observation: 'B' })).toBe('B')
    expect(getSpecialConditionFromProduct({ observations: 'C' })).toBe('C')
  })

  it('fallback portugues: observacao/observacoes/obs', () => {
    expect(getSpecialConditionFromProduct({ observacao: 'Pt' })).toBe('Pt')
    expect(getSpecialConditionFromProduct({ observacoes: 'Pts' })).toBe('Pts')
    expect(getSpecialConditionFromProduct({ obs: 'O' })).toBe('O')
  })

  it('precedencia: specialCondition > condition > obs', () => {
    expect(getSpecialConditionFromProduct({
      specialCondition: 'A',
      condition: 'B',
      obs: 'C'
    })).toBe('A')
  })

  it('heuristica: chave contendo OBSERV (case/accent insensitive)', () => {
    expect(getSpecialConditionFromProduct({ OBSERVACAO: 'X' })).toBe('X')
    expect(getSpecialConditionFromProduct({ Observação: 'Y' })).toBe('Y')
    expect(getSpecialConditionFromProduct({ observ_extra: 'Z' })).toBe('Z')
  })

  it('heuristica: chave contendo CONDI', () => {
    expect(getSpecialConditionFromProduct({ Condicao: 'C' })).toBe('C')
    expect(getSpecialConditionFromProduct({ CONDICAO_ESPECIAL: 'D' })).toBe('D')
  })

  it('heuristica: chave exatamente OBS', () => {
    expect(getSpecialConditionFromProduct({ obs: 'X' })).toBe('X')
    expect(getSpecialConditionFromProduct({ OBS: 'Y' })).toBe('Y')
  })

  it('valor vazio/null nao e considerado', () => {
    expect(getSpecialConditionFromProduct({ specialCondition: '', obs: 'real' })).toBe('real')
    expect(getSpecialConditionFromProduct({ specialCondition: null, condition: 'C' })).toBe('C')
  })

  it('produto sem campos relevantes → null', () => {
    expect(getSpecialConditionFromProduct({ name: 'foo', price: 10 })).toBeNull()
    expect(getSpecialConditionFromProduct({})).toBeNull()
  })
})

describe('getAvailablePrices', () => {
  it('produto sem precos: mainPrice=0,00 e prices=[]', () => {
    const result = getAvailablePrices({})
    expect(result.prices).toEqual([])
    expect(result.mainPrice).toBe('0,00')
    expect(result.hasSpecial).toBe(false)
  })

  it('apenas priceUnit (varejo simples): main', () => {
    const result = getAvailablePrices({ priceUnit: 5.99 })
    expect(result.prices).toHaveLength(1)
    expect(result.prices[0]).toEqual({ label: '', value: '5,99', type: 'main' })
    expect(result.mainPrice).toBe('5,99')
    expect(result.hasSpecial).toBe(false)
  })

  it('apenas pricePack (sem unit nem special): tipo pack, mainPrice cai em pack', () => {
    const result = getAvailablePrices({ pricePack: 24.5, packageLabel: 'CX' })
    expect(result.prices).toHaveLength(1)
    expect(result.prices[0]).toEqual({ label: 'CX', value: '24,50', type: 'pack' })
    expect(result.mainPrice).toBe('24,50') // fallback main → pack
  })

  it('priceSpecial + pricePack (sem priceUnit): pack VIRA main (sinaliza pack como principal varejo)', () => {
    const result = getAvailablePrices({
      priceSpecial: 50, pricePack: 24, packageLabel: 'CX'
    })
    const pack = result.prices.find(p => p.type === 'main')
    expect(pack).toEqual({ label: 'CX', value: '24,00', type: 'main' })
  })

  it('priceUnit + pricePack diferente: ambos exibidos', () => {
    const result = getAvailablePrices({ priceUnit: 5, pricePack: 24, packageLabel: 'CX' })
    expect(result.prices).toHaveLength(2)
    expect(result.prices[0].type).toBe('main')
    expect(result.prices[1].type).toBe('pack')
    expect(result.mainPrice).toBe('5,00')
  })

  it('priceUnit + pricePack iguais: apenas main', () => {
    const result = getAvailablePrices({ priceUnit: 10, pricePack: 10, packageLabel: 'CX' })
    expect(result.prices).toHaveLength(1)
    expect(result.prices[0].type).toBe('main')
  })

  it('priceSpecialUnit (atacado especial): tipo special, sem label', () => {
    const result = getAvailablePrices({ priceSpecialUnit: 4.99 })
    expect(result.prices[0]).toEqual({ label: '', value: '4,99', type: 'special' })
    expect(result.hasSpecial).toBe(true)
  })

  it('priceSpecial sem priceSpecialUnit: usa packageLabel ou CX', () => {
    expect(getAvailablePrices({ priceSpecial: 50, packageLabel: 'FARDO' }).prices[0])
      .toEqual({ label: 'FARDO', value: '50,00', type: 'special' })
    expect(getAvailablePrices({ priceSpecial: 50 }).prices[0])
      .toEqual({ label: 'CX', value: '50,00', type: 'special' })
  })

  it('priceSpecialUnit OFUSCA priceSpecial', () => {
    const result = getAvailablePrices({ priceSpecialUnit: 4, priceSpecial: 50 })
    expect(result.prices.filter(p => p.type === 'special')).toHaveLength(1)
    expect(result.prices.find(p => p.type === 'special')?.value).toBe('4,00')
  })

  it('cenario atacarejo: special + main + pack', () => {
    const result = getAvailablePrices({
      priceSpecialUnit: 4,
      priceUnit: 5,
      pricePack: 50,
      packageLabel: 'CX'
    })
    expect(result.prices).toHaveLength(3)
    expect(result.hasSpecial).toBe(true)
    expect(result.mainPrice).toBe('5,00') // varejo é o main
  })

  it('quando nao tem unit nem pack: special vira main pelo fallback de mainPrice', () => {
    const result = getAvailablePrices({ priceSpecial: 30 })
    expect(result.mainPrice).toBe('30,00')
  })

  it('fallback final: usa product.price legado', () => {
    expect(getAvailablePrices({ price: 7.5 }).mainPrice).toBe('7,50')
  })

  it('inclui condition do produto', () => {
    const result = getAvailablePrices({
      priceUnit: 5,
      specialCondition: 'Sob encomenda'
    })
    expect(result.condition).toBe('Sob encomenda')
  })

  it('null produto: defaults seguros', () => {
    const result = getAvailablePrices(null)
    expect(result.prices).toEqual([])
    expect(result.condition).toBeNull()
    expect(result.mainPrice).toBe('0,00')
  })
})
