import { expect, it } from 'vitest'
import { collectProductNameTexts } from '../../utils/productNameTypographyScope'
it('inclui somente nomes, sem preços, validade ou endereço', () => {
  const name = { type: 'textbox', name: 'smart_title' }
  const otherName = { type: 'Text', name: 'smart_title' }
  const price = { type: 'text', name: 'price_integer' }
  const validity = { type: 'textbox', quickDataField: 'validity' }
  const address = { type: 'textbox', businessProfileField: 'address' }
  const root = { getObjects: () => [validity, address, { getObjects: () => [name, price, otherName] }] }
  expect(collectProductNameTexts(root)).toEqual([name, otherName])
})
