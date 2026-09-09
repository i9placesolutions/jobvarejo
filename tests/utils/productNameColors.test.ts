import { describe, expect, it } from 'vitest'
import { automaticProductNameColor, syncProductNameColor } from '../../utils/productNameColors'

describe('cor dos nomes de produto', () => {
  it('usa preto nos fundos claros e branco nos fundos escuros ou vermelhos', () => {
    for (const color of ['#fff', '#ffffff', '#ffcc00', 'rgb(240, 240, 240)']) expect(automaticProductNameColor(color)).toBe('#000000')
    for (const color of ['#000', '#172033', '#ff0000', '#ef4444', '#0000ff']) expect(automaticProductNameColor(color)).toBe('#ffffff')
  })
  it('preserva cor manual ao mudar fundo e salvar/recarregar; automático volta a acompanhar o fundo', () => {
    let card: any = { _cardStyleOverrides: { prodNameColor: '#22cc55' }, objects: [
      { name: 'offerBackground', fill: '#ff0000' },
      { name: 'smart_title', type: 'textbox', fill: '#000000', styles: { 0: { 0: { fill: '#333333', fontWeight: 900 } } } },
      { name: 'price', type: 'text', fill: '#ffff00' }
    ] }
    syncProductNameColor(card)
    card = JSON.parse(JSON.stringify(card))
    card.objects[0].fill = '#ffffff'
    syncProductNameColor(card)
    expect(card.objects[1].fill).toBe('#22cc55')
    expect(card.objects[1].styles[0][0]).toEqual({ fontWeight: 900 })
    expect(card.objects[2].fill).toBe('#ffff00')
    delete card._cardStyleOverrides.prodNameColor
    syncProductNameColor(card)
    expect(card.objects[1].fill).toBe('#000000')
    card.objects[0].fill = '#ff0000'
    syncProductNameColor(card)
    expect(card.objects[1].fill).toBe('#ffffff')
  })
})
