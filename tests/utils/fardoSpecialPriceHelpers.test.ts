import { describe, expect, it } from 'vitest'
import { resolveFardoSpecialPriceState } from '~/utils/fardoSpecialPriceHelpers'

describe('resolveFardoSpecialPriceState', () => {
  const completeProduct = {
    priceUnit: '6,25',
    pricePack: '37,50',
    priceSpecialUnit: '5,83',
    priceSpecial: '34,98',
    packQuantity: 6,
    packUnit: 'UN',
    packageLabel: 'FARDO',
    specialCondition: 'ACIMA DE 4 FD',
    unit: 'UN'
  }

  it('separa os dois precos e monta a linha compacta do fardo', () => {
    const state = resolveFardoSpecialPriceState(completeProduct, { displayUnit: 'UND' })

    expect(state.retail).toMatchObject({
      price: '6,25',
      unitText: 'UND',
      packLine: 'FARDO C/6 R$ 37,50',
      hasValue: true
    })
    expect(state.special).toMatchObject({
      price: '5,83',
      unitText: 'UND',
      packLine: 'FARDO C/6 R$ 34,98',
      hasValue: true
    })
    expect(state.conditionText).toBe('ACIMA DE 4 FD')
    expect(state.showRetail).toBe(true)
    expect(state.showSpecial).toBe(true)
    expect(state.showBanner).toBe(true)
  })

  it('prioriza o preco explicito do fardo e nao recalcula por unidade', () => {
    const state = resolveFardoSpecialPriceState({
      ...completeProduct,
      pricePack: '40,00',
      priceSpecial: '35,00'
    })

    expect(state.retail.packLine).toBe('FARDO C/6 R$ 40,00')
    expect(state.special.packLine).toBe('FARDO C/6 R$ 35,00')
  })

  it('auto-colapsa a faixa especial quando ela nao tem valor', () => {
    const state = resolveFardoSpecialPriceState({
      ...completeProduct,
      priceSpecialUnit: null,
      priceSpecial: null,
      specialCondition: null
    })

    expect(state.retail.hasValue).toBe(true)
    expect(state.showRetail).toBe(true)
    expect(state.special.hasValue).toBe(false)
    expect(state.showSpecial).toBe(false)
    expect(state.showBanner).toBe(false)
  })

  it('mantem a faixa vazia quando o auto-colapso esta desligado', () => {
    const state = resolveFardoSpecialPriceState({
      ...completeProduct,
      priceSpecialUnit: null,
      priceSpecial: null,
      specialCondition: null
    }, { autoCollapseMissingPrices: false })

    expect(state.showRetail).toBe(true)
    expect(state.showSpecial).toBe(true)
    expect(state.special.hasValue).toBe(false)
  })

  it('nao cria linha de embalagem para unidade sem semantica de fardo', () => {
    const state = resolveFardoSpecialPriceState({
      priceUnit: '11,99',
      priceSpecialUnit: '10,99',
      packQuantity: 1,
      packageLabel: 'UNIDADE',
      unit: 'UN'
    }, { displayUnit: 'UND' })

    expect(state.retail.packLine).toBeNull()
    expect(state.special.packLine).toBeNull()
  })
})
