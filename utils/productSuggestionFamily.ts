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
type SuggestionProduct = { name?: string | null; brand?: string | null; flavor?: string | null; weight?: string | null }
const variants = new Set('tradicional integral desnatado semidesnatado sabores sabor moido torrado vacuo branco tinto lata garrafa caixa sache toscana frango'.split(' '))
const packageSizes = (value: unknown): string[] => [...String(value || '').toLowerCase().matchAll(/(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|lt|l)(?=$|[^a-z])/g)]
  .map((match) => {
    const unit = match[2]!
    const amount = Number(match[1]!.replace(',', '.')) * (unit === 'kg' || unit === 'lt' || unit === 'l' ? 1000 : 1)
    return `${amount}${unit === 'ml' || unit === 'lt' || unit === 'l' ? 'ml' : 'g'}`
  })
export const productSuggestionWeightMatches = (product: SuggestionProduct, title: string): boolean => {
  const wanted = productPackageSizes(product)
  const found = packageSizes(title)
  return !wanted.length || !found.length || wanted.some(size => found.includes(size))
}
const productPackageSizes = (product: SuggestionProduct): string[] => {
  const fromName = packageSizes(product.name)
  return fromName.length ? fromName : packageSizes(product.weight)
}
export const scoreProductFamilySuggestion = (product: SuggestionProduct, title: string): number => {
  const family = productSuggestionFamily(product)
  const words = tokens(title)
  if (!family || !words.includes(family)) return 0
  // Recheio/sabor não transforma pizza de linguiça em foto de linguiça.
  const candidateFamily = words.find(t => families.has(t))
  if (candidateFamily && candidateFamily !== family) return 0
  const wanted = [...new Set(tokens(product.name))]
  // Identidade (inclusive marca escrita só no nome) pesa mais que termos
  // genéricos como "tradicional". Mantém alternativas da família na galeria.
  const identityScore = wanted.filter(t => words.includes(t)).reduce((score, t) => score + (families.has(t) || variants.has(t) ? 1 : 8), 0)
  const sizeScore = productPackageSizes(product).some(size => packageSizes(title).includes(size)) ? 3 : 0
  return 1 + identityScore + tokens(product.brand).filter(t => words.includes(t)).length * 8
    + tokens(product.flavor).filter(t => words.includes(t)).length + sizeScore
}
