import { expect, it } from 'vitest'
import { updateIsolatedPageFields } from '../../utils/isolatedPageFields'

it('atualiza campos dinâmicos sem copiar produtos entre páginas nem tocar na origem', () => {
  const a = { objects: [{ name: 'product-card', _productData: { name: 'KUAT', price: 4.99 }, left: 44 }, { businessProfileField: 'address', text: 'Amostra' }] }
  const b = { objects: [{ name: 'product-card', _productData: { name: 'OVOS', price: 12 }, left: 77 }, { objects: [{ businessProfileField: 'address', text: 'Outra amostra' }] }] }
  const patch = (o: any) => o.businessProfileField === 'address' ? { text: 'Endereço da loja' } : null
  const updatedA = updateIsolatedPageFields(a, patch)
  const updatedB = updateIsolatedPageFields(b, patch)
  expect(updatedA.objects[0]).toEqual(a.objects[0])
  expect(updatedB.objects[0]).toEqual(b.objects[0])
  expect(updatedB.objects[1].objects[0].text).toBe('Endereço da loja')
  expect(a.objects[1]!.text).toBe('Amostra')
  expect(b.objects[1]!.objects?.[0]?.text).toBe('Outra amostra')
  updatedA.objects[0].left = 900
  expect(a.objects[0]!.left).toBe(44)
  expect(updatedB.objects[0].left).toBe(77)
  expect(updateIsolatedPageFields(updatedB, patch)).toBeNull()
})
