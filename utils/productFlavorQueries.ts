/** Somente sabores nomeados; “sabores”/“sortidos” nunca inventam variantes. */
export const getExplicitFlavorQueries = (description: string): Array<{ flavor: string; query: string }> => {
  const normalized = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const flavors = ['uva', 'morango', 'laranja', 'limao', 'maracuja', 'abacaxi', 'pessego', 'manga', 'melancia', 'maca', 'coco', 'chocolate', 'baunilha']
  const found = flavors.filter(flavor => new RegExp(`\\b${flavor}\\b`).test(normalized))
  if (found.length < 2) return []
  const pattern = new RegExp(`\\b(?:${found.join('|')})\\b`, 'g')
  const base = normalized.replace(pattern, '').replace(/\b(?:e|ou|sabores|sabor)\b/g, '').replace(/[,/]+/g, ' ').replace(/\s+/g, ' ').trim()
  return found.map(flavor => ({ flavor, query: `${base} ${flavor}`.trim() }))
}
