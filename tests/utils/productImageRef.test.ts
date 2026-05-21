import { describe, expect, it } from 'vitest'
import { resolveProductImageRef } from '~/utils/productImageRef'

describe('resolveProductImageRef', () => {
  it('prioriza campos diretos usados pelo cache de produtos', () => {
    expect(resolveProductImageRef({ image_wasabi_key: 'produtos/arroz.webp' }))
      .toBe('produtos/arroz.webp')
    expect(resolveProductImageRef({ image_url: '/api/storage/p?key=produtos/feijao.webp' }))
      .toBe('/api/storage/p?key=produtos/feijao.webp')
    expect(resolveProductImageRef({ s3_key: 'produtos/cafe.webp' }))
      .toBe('produtos/cafe.webp')
  })

  it('aceita Product.images[] com objetos ou strings', () => {
    expect(resolveProductImageRef({ images: [{ key: 'produtos/leite.webp' }] }))
      .toBe('produtos/leite.webp')
    expect(resolveProductImageRef({ images: ['produtos/suco.webp'] }))
      .toBe('produtos/suco.webp')
  })

  it('procura em raw/productData quando a referencia vem aninhada', () => {
    expect(resolveProductImageRef({
      productData: {
        raw: {
          imageUrl: 'produtos/macarrao.webp'
        }
      }
    })).toBe('produtos/macarrao.webp')
  })

  it('retorna null para payload sem imagem aprovada', () => {
    expect(resolveProductImageRef({ name: 'Produto sem imagem', images: [] })).toBeNull()
  })
})
