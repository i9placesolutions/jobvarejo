// Usado somente na galeria manual; não altera a aprovação automática de imagens.
const aliases: Record<string, string> = {
  ling: 'linguica', linguicas: 'linguica', tosc: 'toscana',
  bisc: 'biscoito', biscoitos: 'biscoito', bolacha: 'biscoito', bolachas: 'biscoito',
  refrig: 'refrigerante', refrigerantes: 'refrigerante',
  mac: 'macarrao', acuc: 'acucar', det: 'detergente',
  hamburgueres: 'hamburguer', hamburger: 'hamburguer',
  salsichas: 'salsicha', pizzas: 'pizza', queijos: 'queijo'
}
const noise = new Set('de da do das dos com sem e em para kg g gr ml l un und pct pacote embalagem imagem imagens produto produtos png jpg jpeg webp'.split(' '))
const families = new Set('linguica biscoito refrigerante macarrao acucar detergente hamburguer salsicha pizza queijo leite arroz feijao cafe oleo farinha frango carne picanha mortadela presunto salame bacon nuggets lasanha pao suco agua cerveja iogurte chocolate sorvete manteiga margarina maionese sabao sabonete shampoo papel banana maca tomate batata cebola'.split(' '))
const tokens = (value: unknown): string[] => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').split(' ').map(t => aliases[t] || t)
  .filter(t => t.length > 1 && !noise.has(t) && !/^\d/.test(t))
export const productSuggestionFamily = (product: { name?: string | null; brand?: string | null }): string => {
  const brand = new Set(tokens(product.brand))
  const words = tokens(product.name).filter(t => !brand.has(t))
  return words.find(t => families.has(t)) || words[0] || ''
}
export const scoreProductFamilySuggestion = (product: { name?: string | null; brand?: string | null }, title: string): number => {
  const family = productSuggestionFamily(product)
  const words = tokens(title)
  if (!family || !words.includes(family)) return 0
  // Recheio/sabor não transforma pizza de linguiça em foto de linguiça.
  const candidateFamily = words.find(t => families.has(t))
  if (candidateFamily && candidateFamily !== family) return 0
  const wanted = tokens(product.name)
  return 1 + wanted.filter(t => words.includes(t)).length + tokens(product.brand).filter(t => words.includes(t)).length * 2
}
