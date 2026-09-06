import { describe, expect, it } from 'vitest'
import { rankGoogleCseImageCandidates } from '~/server/utils/product-image-google-cse'

describe('rankGoogleCseImageCandidates', () => {
  it('prioriza embalagem do produto e rejeita resultados de logo/clipart', () => {
    const ranked = rankGoogleCseImageCandidates([
      {
        url: 'https://cdn.example.com/batata-1kg.png',
        title: 'Batata 1kg embalagem do produto',
        source: 'https://mercado.example.com/produtos/batata',
        imageWidth: 900,
        imageHeight: 900
      },
      {
        url: 'https://pinterest.com/batata-logo.svg',
        title: 'Logo batata vetor',
        source: 'https://pinterest.com'
      }
    ], { query: 'Batata 1kg', weight: '1kg' })

    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.title).toContain('embalagem')
    expect(ranked[0]?.recommended).toBe(true)
    expect(ranked[0]?.confidence).toBeGreaterThan(0.7)
  })

  it('mantém somente candidatos com algum sinal do produto', () => {
    const ranked = rankGoogleCseImageCandidates([
      { url: 'https://cdn.example.com/unknown.png', title: 'Imagem bonita', source: 'https://example.com' },
      { url: 'https://cdn.example.com/feijao-preto.png', title: 'Feijão preto 1kg produto', source: 'https://mercado.example.com' }
    ], { query: 'Feijão preto', weight: '1kg' })

    expect(ranked.map(candidate => candidate.title)).toEqual(['Feijão preto 1kg produto'])
  })
})
