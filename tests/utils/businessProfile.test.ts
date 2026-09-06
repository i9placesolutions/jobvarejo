import { describe, expect, it } from 'vitest'
import {
  formatBusinessAddressValues,
  formatBusinessContactValues,
  formatBusinessPaymentMethods,
  normalizeBusinessProfile,
} from '~/utils/businessProfile'

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
})
