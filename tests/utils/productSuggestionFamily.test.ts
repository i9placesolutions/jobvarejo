import { expect, it } from 'vitest'
import { productSuggestionFamily, scoreProductFamilySuggestion as score } from '../../utils/productSuggestionFamily'
it('expande abreviações e inclui linguiça com e sem marca', () => {
 const p = { name: 'LING TOSC DE FRANGO FRICO KG' }
 expect(productSuggestionFamily(p)).toBe('linguica')
 expect(score(p, 'Linguiça Toscana Frico')).toBeGreaterThan(0)
 expect(score(p, 'Linguiça de frango a granel')).toBeGreaterThan(0)
 expect(score(p, 'Linguiça Sadia 1kg')).toBeGreaterThan(0)
 expect(score(p, 'Pizza de linguiça')).toBe(0)
 expect(score(p, 'Arroz 1kg')).toBe(0)
})
it.each([
 ['BISC LIANE 270G SABORES', 'Biscoito sem marca'],
 ['LEITE INTEGRAL ITALAC 1L', 'Leite integral Piracanjuba'],
 ['ARROZ TIO JOAO 5KG', 'Arroz branco'],
 ['DETERGENTE YPE', 'Detergente Limpol']
])('sugere a família de %s', (name, title) => expect(score({ name }, title)).toBeGreaterThan(0))
it('prioriza correspondência de marca e variante', () => {
 const p = { name: 'Linguiça Toscana Frico', brand: 'Frico' }
 expect(score(p, 'Linguiça Toscana Frico')).toBeGreaterThan(score(p, 'Linguiça Sadia'))
})

it('a consulta expandida encontra arquivos abreviados e plurais da biblioteca', () => {
 const query = { name: productSuggestionFamily({ name: 'LING TOSC DE FRANGO FRICO KG' }) }
 expect(score(query, 'imagens/manual-ling-tosc-frango-frico-kg.webp')).toBeGreaterThan(0)
 expect(score(query, 'Linguiças Sadia')).toBeGreaterThan(0)
 expect(score(query, 'Pizza de linguiça')).toBe(0)
})
