export const ASSET_LIBRARY_CATEGORIES = [
  // A aba "Marca" e o upload de marca já usam este prefixo público.
  // Ele também fica disponível entre os filtros da biblioteca de uploads.
  { id: 'logos', label: 'Logos', prefix: 'logo/' },
  { id: 'selos', label: 'Selos 3D', prefix: 'imagens/biblioteca/selos/' },
  { id: 'produtos', label: 'Produtos', prefix: 'imagens/biblioteca/produtos/' },
  { id: 'fundos', label: 'Fundos', prefix: 'imagens/biblioteca/fundos/' },
  { id: 'pessoas', label: 'Pessoas', prefix: 'imagens/biblioteca/pessoas/' },
  { id: 'elementos', label: 'Elementos', prefix: 'imagens/biblioteca/elementos/' }
] as const
export type AssetLibraryCategory = typeof ASSET_LIBRARY_CATEGORIES[number]['id']
export const getAssetLibraryCategory = (value: unknown) => ASSET_LIBRARY_CATEGORIES.find(c => c.id === value)
/** Legacy directory names are recognized without changing stored references. */
export const categoryFromAssetKey = (key: string): AssetLibraryCategory | null => {
  const path = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split('/').slice(0, -1)
  for (const segment of path) {
    if (/^(logos?|marcas?|brands?)$/.test(segment)) return 'logos'
    if (/^(selos?|selos?[-_ ]?3d|seals?|badges?)$/.test(segment)) return 'selos'
    if (/^(produtos?|products?)$/.test(segment)) return 'produtos'
    if (/^(fundos?|backgrounds?|texturas?)$/.test(segment)) return 'fundos'
    if (/^(pessoas?|people|persons?)$/.test(segment)) return 'pessoas'
    if (/^(elementos?|elements?)$/.test(segment)) return 'elementos'
  }
  return null
}
