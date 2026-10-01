import { describe, expect, it } from 'vitest'
import { normalizeSearchTerm } from '../../server/utils/product-image-matching'

describe('busca de Pirakids nas listas de oferta', () => {
  it('encontra o nome do catálogo a partir da abreviação com a fabricante', () => {
    expect(normalizeSearchTerm('ACHOC. PIRAKIDS PIRACANJUBA 200ML'))
      .toBe(normalizeSearchTerm('ACHOCOLATADO PIRAKIDS 200ML'))
    expect(normalizeSearchTerm('ACHOC PIRACANJUBA PIRAKIDS 200 ML'))
      .toBe(normalizeSearchTerm('ACHOCOLATADO PIRAKIDS 200ML'))
  })
  it('mantém distintas outras marcas e gramaturas', () => {
    const query = normalizeSearchTerm('ACHOC. PIRAKIDS PIRACANJUBA 200ML')
    expect(query).not.toBe(normalizeSearchTerm('ACHOCOLATADO NESCAU 200ML'))
    expect(query).not.toBe(normalizeSearchTerm('ACHOCOLATADO PIRAKIDS 1L'))
    expect(normalizeSearchTerm('LEITE PIRACANJUBA 1L')).toContain('piracanjuba')
  })
})
