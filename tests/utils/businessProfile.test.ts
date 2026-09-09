import { describe, expect, it } from 'vitest'
import {
  formatBusinessAddressValues,
  formatBusinessContactValues,
  formatBusinessPaymentMethods,
  normalizeBusinessProfile,
} from '~/utils/businessProfile'
import { mergeBusinessProfile } from '../../server/utils/business-profile'

describe('businessProfile repeatable data', () => {
  it('migrates legacy WhatsApp and endereço strings without losing compatibility', () => {
    const profile = normalizeBusinessProfile({ whatsapp: '(11) 99999-0000', address: 'Rua A, 10' })

    expect(profile.whatsapp).toBe('(11) 99999-0000')
    expect(profile.whatsappNumbers).toEqual([{ id: 'whatsapp-1', label: '', value: '(11) 99999-0000' }])
    expect(profile.addresses).toEqual([{ id: 'address-1', label: '', value: 'Rua A, 10' }])
  })

  it('keeps multiple labeled contacts and addresses in order', () => {
    const profile = normalizeBusinessProfile({
      whatsappNumbers: [
        { id: 'delivery', label: 'Delivery', value: '(11) 99999-0000' },
        { label: 'Loja', value: '(11) 3333-0000' },
      ],
      addresses: ['Rua A, 10', { label: 'Filial', value: 'Av. B, 20' }],
    })

    expect(formatBusinessContactValues(profile.whatsappNumbers)).toBe('Delivery: (11) 99999-0000 · Loja: (11) 3333-0000')
    expect(formatBusinessAddressValues(profile.addresses)).toBe('Rua A, 10 · Av. B, 20')
    expect(profile.whatsapp).toBe('(11) 99999-0000')
    expect(profile.address).toBe('Rua A, 10')
  })

  it('não adiciona rótulos de cidade ou filial ao texto do endereço', () => {
    expect(formatBusinessAddressValues([
      { label: 'Cidade', value: 'Rua das Flores, 25 - Centro' },
      { label: 'Filial', value: 'Av. Brasil, 100' },
    ])).toBe('Rua das Flores, 25 - Centro · Av. Brasil, 100')
  })

  it('não recupera endereço legado quando a lista foi esvaziada', () => {
    expect(formatBusinessAddressValues([], 'Cidade: Rua antiga, 10')).toBe('')
  })

  it('resolves the standard payment labels and the 92-card catalog IDs', () => {
    expect(formatBusinessPaymentMethods(['pix', 'amex', 'cartao-82', 'cartao-92']))
      .toBe('PIX · American Express · Visa · G Card')
  })

  it('preserva se as formas de pagamento foram confirmadas pela loja', () => {
    const onlyInstagram = mergeBusinessProfile({}, { instagram: '@mercadocentral' }) as Record<string, unknown>
    expect(onlyInstagram.__paymentMethodsConfigured).toBe(false)

    const selectedPayments = mergeBusinessProfile(onlyInstagram, { paymentMethods: ['pix', 'visa'] }) as Record<string, unknown>
    expect(selectedPayments.__paymentMethodsConfigured).toBe(true)
  })
})


describe('máscara brasileira dos números exibidos', () => {
  it.each([
    ['64996185163', '(64) 99618-5163'],
    ['+55 64 99618 5163', '(64) 99618-5163'],
    ['6433334444', '(64) 3333-4444'],
    ['(64) 99618-5163', '(64) 99618-5163'],
    ['996185163', '996185163'],
  ])('formata %s sem alterar o cadastro', (value, expected) => {
    const entries = [{ value, label: 'Loja' }]
    expect(formatBusinessContactValues(entries)).toBe(`Loja: ${expected}`)
    expect(entries[0]?.value).toBe(value)
    expect(formatBusinessContactValues(undefined, value)).toBe(expected)
  })
})
