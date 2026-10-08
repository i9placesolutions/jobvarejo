/**
 * Estrutura inteligente do encarte: classifica o departamento de cada oferta,
 * escolhe a estrutura (Clássico, Produto Herói, Setores ou Faixa Lateral) pelas
 * ofertas e monta os setores a partir dos departamentos presentes.
 *
 * Sem dependências: roda no editor, no servidor, no worker e nos scripts.
 */

export type FlyerStructureId = 'classico' | 'heroi' | 'setores' | 'lateral'
export type FlyerStructureFormat = 'feed' | 'stories' | 'square' | 'print' | 'tv'

export type FlyerStructureProduct = {
  id: string
  name: string
  brand?: string
  variant?: string
  weight?: string
  /** Departamento informado (cliente, IA do WhatsApp ou catálogo). Vale mais que a inferência. */
  department?: string
  /** Oferta marcada como destaque/carro-chefe. */
  featured?: boolean
}

export type FlyerSector = {
  /** Título exibido no encarte, em caixa alta. */
  title: string
  productIds: string[]
  /** Linhas de cards que o setor ocupa; usado para dividir a altura proporcionalmente. */
  rows: number
  columns: number
}

export type FlyerStructurePlan = {
  structure: FlyerStructureId
  /** Motivo em linguagem simples, para mostrar ao varejista. */
  reason: string
  /** Departamento resolvido por produto ('' quando não foi possível classificar). */
  departments: Record<string, string>
  sectors: FlyerSector[]
  heroIds: string[]
}

/** Ordem do corredor do supermercado: os setores aparecem nesta sequência. */
export const FLYER_DEPARTMENTS = [
  'AÇOUGUE', 'HORTIFRÚTI', 'PADARIA', 'FRIOS E LATICÍNIOS', 'CONGELADOS', 'MERCEARIA',
  'BEBIDAS', 'LIMPEZA', 'HIGIENE E BELEZA', 'PET', 'BAZAR'
] as const
export const OTHER_OFFERS_TITLE = 'OUTRAS OFERTAS'

const normalize = (value: unknown): string => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Regras em ordem: as mais específicas primeiro (ex.: "água sanitária" antes de "água",
// "pão de alho" e "batata air fryer" antes de padaria/hortifrúti, "leite em pó" antes de laticínios).
const RULES: ReadonlyArray<[string, RegExp]> = [
  ['LIMPEZA', /\b(agua sanitaria|alvejante|amaciante|desinfetante|detergente|esponja|sabao|soda caustica|lava roupas?|multiuso|limpador|limpa (vidros?|pisos?|aluminio)|lustra moveis|saco (de|p) lixo|inseticida|cloro|pinho sol|veja|ype|omo|uau perfumes?|odorizador|bom ar)\b/],
  ['HIGIENE E BELEZA', /\b(creme dental|pasta de dente|escova dental|enxaguante|fio dental|desodorante|sabonete|shampoo|xampu|condicionador|papel higienico|absorvente|fralda|lenco umedecido|hidratante|protetor solar|aparelho de barbear|cotonete|algodao|colgate|rexona|gillette)\b/],
  ['CONGELADOS', /\b(pizza|lasanha|nuggets?|empanado|hot hit|mini chicken|hamburguer|batata (palito|pre frita|air fryer|congelada|bem brasil)|pao de alho|sorvete|picole|polpa de fruta|congelad[oa]s?|steak)\b/],
  ['FRIOS E LATICÍNIOS', /\b(queijo|mussarela|muzzarela|presunto|mortadela|salame|apresuntado|requeijao|iogurte|danone|danoninho|bebida lactea|margarina|manteiga|nata|petit suisse|leite fermentado|yakult|blanquet|peito de peru)\b/],
  // Processados com nome de carne/hortaliça ("molho de tomate", "caldo de carne") são mercearia.
  ['MERCEARIA', /\b(molho|extrato|massa de tomate|conserva|ketchup|catchup|seleta|pure|batata palha|farofa|tempero|caldo|sopa|enlatad[oa]|sardinha (em|lata|com)|atum)\b/],
  ['AÇOUGUE', /\b(carne|picanha|alcatra|patinho|acem|costela|cupim|maminha|fraldinha|contra file|file mignon|musculo|coxao|lagarto|frango|coxa|sobrecoxa|asa|peito de frango|linguica|bisteca|pernil|lombo suino|panceta|toucinho|bacon|carne moida|figado|charque|carne seca|peixe|tilapia|sardinha fresca)\b/],
  ['HORTIFRÚTI', /\b(banana|maca|tomate|batata|cebola|alho|laranja|limao|alface|cenoura|mamao|melancia|melao|uva|abacaxi|manga|pera|chuchu|abobrinha|abobora|pimentao|repolho|couve|brocolis|beterraba|mandioca|aipim|ovos?|morango|hortifruti|verdura|legume|fruta)\b/],
  ['PADARIA', /\b(pao frances|pao de forma|pao de queijo|pao doce|pao|bisnaguinha|bolo|rosca|torrada|sonho|broa)\b/],
  ['BEBIDAS', /\b(cerveja|refrigerante|refri|coca cola|guarana|suco|nectar|agua mineral|agua de coco|agua com gas|energetico|vinho|espumante|vodka|cachaca|whisky|gin|licor|cha gelado|isotonico|amstel|skol|brahma|heineken|itaipava|antarctica)\b/],
  ['PET', /\b(racao|petisco (para|p) (caes|gatos)|areia (sanitaria|para gatos)|whiskas|pedigree|golden)\b/],
  ['BAZAR', /\b(pilha|lampada|vela|copo descartavel|prato descartavel|papel aluminio|filme plastico|carvao|fosforo|isqueiro)\b/],
  ['MERCEARIA', /\b(arroz|feijao|acucar|cafe|oleo|azeite|macarrao|massa|farinha|fuba|flocao|molho|extrato de tomate|leite em po|leite condensado|creme de leite|leite|achocolatado|biscoito|bolacha|salgadinho|sal|tempero|caldo|maionese|ketchup|mostarda|vinagre|enlatado|milho verde|ervilha|atum|sardinha|doce|chocolate|bombom|bala|gelatina|refresco|refreskant|aveia|granola|cereal|instantaneo|miojo|ninho|pilao|docile)\b/]
]

const ALIASES: Record<string, string> = Object.fromEntries([
  ['acougue', 'AÇOUGUE'], ['carnes', 'AÇOUGUE'], ['carne', 'AÇOUGUE'],
  ['hortifruti', 'HORTIFRÚTI'], ['hortifruti e ovos', 'HORTIFRÚTI'], ['frutas', 'HORTIFRÚTI'], ['verduras', 'HORTIFRÚTI'], ['sacolao', 'HORTIFRÚTI'],
  ['padaria', 'PADARIA'], ['frios', 'FRIOS E LATICÍNIOS'], ['laticinios', 'FRIOS E LATICÍNIOS'], ['frios e laticinios', 'FRIOS E LATICÍNIOS'],
  ['congelados', 'CONGELADOS'], ['mercearia', 'MERCEARIA'], ['alimentos', 'MERCEARIA'], ['bebidas', 'BEBIDAS'],
  ['limpeza', 'LIMPEZA'], ['higiene', 'HIGIENE E BELEZA'], ['perfumaria', 'HIGIENE E BELEZA'], ['higiene e beleza', 'HIGIENE E BELEZA'],
  ['higiene pessoal', 'HIGIENE E BELEZA'], ['pet', 'PET'], ['pet shop', 'PET'], ['bazar', 'BAZAR'], ['utilidades', 'BAZAR']
])

/** Departamento canônico de uma oferta: o informado (se reconhecível) ou o inferido pelo nome. */
export const resolveFlyerDepartment = (product: Pick<FlyerStructureProduct, 'name' | 'brand' | 'variant' | 'department'>): string => {
  const informed = normalize(product.department)
  if (informed) {
    if (ALIASES[informed]) return ALIASES[informed]
    const canonical = FLYER_DEPARTMENTS.find(item => normalize(item) === informed)
    if (canonical) return canonical
  }
  const text = normalize([product.name, product.brand, product.variant].filter(Boolean).join(' '))
  if (!text) return ''
  for (const [department, pattern] of RULES) if (pattern.test(text)) return department
  return ''
}

/** Produtos por linha de um setor, pelo formato. */
const sectorRowCapacity = (format: FlyerStructureFormat): number => format === 'tv' ? 6 : 4

const MAX_SECTORS: Record<FlyerStructureFormat, number> = { feed: 4, stories: 4, square: 3, print: 4, tv: 4 }
/** Ofertas que cabem divididas em setores numa página, sem cards miúdos (acima disso, grade comum). */
export const SECTOR_PRODUCT_CAPACITY: Record<FlyerStructureFormat, number> = { feed: 12, stories: 9, square: 8, print: 12, tv: 12 }

/**
 * Setores a partir dos departamentos presentes, na ordem do corredor.
 * Departamentos com uma única oferta e produtos sem departamento vão para "OUTRAS OFERTAS";
 * quando passa do limite do formato, os menores setores também vão para lá.
 */
export const planFlyerSectors = (
  products: ReadonlyArray<FlyerStructureProduct>,
  format: FlyerStructureFormat,
  departments: Record<string, string> = Object.fromEntries(products.map(p => [p.id, resolveFlyerDepartment(p)]))
): FlyerSector[] => {
  const groups = new Map<string, string[]>()
  for (const product of products) {
    const department = departments[product.id] || ''
    groups.set(department, [...(groups.get(department) || []), product.id])
  }
  const ranked = FLYER_DEPARTMENTS
    .filter(department => (groups.get(department)?.length || 0) >= 2)
    .map(department => ({ title: department, ids: groups.get(department)! }))
  const leftovers: string[] = [...(groups.get('') || [])]
  for (const department of FLYER_DEPARTMENTS) {
    const ids = groups.get(department) || []
    if (ids.length === 1) leftovers.push(...ids)
  }
  // Limite de setores: mantém os maiores (desempate pela ordem do corredor).
  // Ao passar do limite, sobra oferta para "OUTRAS OFERTAS": reserva espaço para esse bloco.
  const max = MAX_SECTORS[format]
  const limit = leftovers.length || ranked.length > max ? max - 1 : max
  let kept = ranked
  if (ranked.length > limit) {
    const keep = new Set([...ranked].sort((a, b) => b.ids.length - a.ids.length).slice(0, Math.max(1, limit)).map(group => group.title))
    kept = ranked.filter(group => keep.has(group.title))
    for (const group of ranked) if (!keep.has(group.title)) leftovers.push(...group.ids)
  }
  const perRow = sectorRowCapacity(format)
  const toSector = (title: string, ids: string[]): FlyerSector => {
    const rows = Math.max(1, Math.ceil(ids.length / perRow))
    return { title, productIds: ids, rows, columns: Math.ceil(ids.length / rows) }
  }
  const sectors = kept.map(group => toSector(group.title, group.ids))
  if (leftovers.length) {
    const order = new Map(products.map((product, index) => [product.id, index]))
    sectors.push(toSector(OTHER_OFFERS_TITLE, leftovers.sort((a, b) => order.get(a)! - order.get(b)!)))
  }
  return sectors
}

/**
 * Escolhe a estrutura pelas ofertas. Ordem das regras:
 * 1. escolha explícita do cliente;
 * 2. Produto Herói — há ofertas marcadas como destaque (intenção explícita do varejista);
 * 3. Setores — 2 ou mais departamentos com pelo menos 2 ofertas cada (e no máximo 30% sem setor);
 * 4. Faixa Lateral — poucas ofertas (até 10) de um mesmo tipo: dá destaque aos contatos;
 * 5. Clássico — listas maiores sem divisão clara.
 * TV e quadrado não usam Faixa Lateral (proporção não favorece a coluna).
 */
export const chooseFlyerStructure = (
  products: ReadonlyArray<FlyerStructureProduct>,
  options: { format?: FlyerStructureFormat; preferred?: FlyerStructureId | null } = {}
): FlyerStructurePlan => {
  const format = options.format || 'feed'
  const departments = Object.fromEntries(products.map(product => [product.id, resolveFlyerDepartment(product)]))
  const featured = products.filter(product => product.featured).slice(0, 2).map(product => product.id)
  const sectors = planFlyerSectors(products, format, departments)
  const realSectors = sectors.filter(sector => sector.title !== OTHER_OFFERS_TITLE)
  const unclassified = sectors.find(sector => sector.title === OTHER_OFFERS_TITLE)?.productIds.length || 0
  const base = { departments, sectors: [] as FlyerSector[], heroIds: [] as string[] }
  const plan = (structure: FlyerStructureId, reason: string): FlyerStructurePlan => ({
    ...base, structure, reason,
    sectors: structure === 'setores' ? sectors : [],
    heroIds: structure === 'heroi' ? (featured.length ? featured : products.slice(0, 2).map(product => product.id)) : []
  })

  if (options.preferred) return plan(options.preferred, 'Estrutura escolhida pelo cliente.')
  if (featured.length) {
    return plan('heroi', featured.length === 1 ? 'Há uma oferta marcada como destaque: ela aparece em tamanho grande.' : 'Há ofertas marcadas como destaque: elas aparecem em tamanho grande no topo.')
  }
  if (realSectors.length >= 2 && unclassified <= products.length * .3 && products.length <= SECTOR_PRODUCT_CAPACITY[format]) {
    return plan('setores', `Ofertas de ${realSectors.length} setores diferentes (${realSectors.map(s => s.title.toLowerCase()).join(', ')}): separadas por setor para facilitar a leitura.`)
  }
  if (products.length <= 10 && format !== 'tv' && format !== 'square') {
    return plan('lateral', 'Poucas ofertas: produtos grandes e contatos da loja em destaque na lateral.')
  }
  return plan('classico', 'Muitas ofertas sem divisão clara por setor: grade completa.')
}

export type FlyerSectorBand = {
  /** Setores lado a lado nesta faixa, na ordem em que aparecem. */
  sectors: FlyerSector[]
  /** Linhas de cards da faixa (a maior entre os setores); define a altura proporcional. */
  rows: number
}

/**
 * Agrupa setores em faixas horizontais. Setores pequenos dividem a mesma faixa (ex.: Congelados
 * com 2 e Bebidas com 2), liberando altura para os cards; setores cheios ficam sozinhos.
 * A largura de cada setor na faixa é proporcional às suas colunas. A ordem das faixas segue
 * o primeiro setor de cada uma (ordem do corredor).
 */
export const arrangeFlyerSectorBands = (sectors: ReadonlyArray<FlyerSector>, format: FlyerStructureFormat): FlyerSectorBand[] => {
  const perRow = sectorRowCapacity(format)
  const bands: Array<{ sectors: FlyerSector[]; used: number }> = []
  // Maiores primeiro para encaixar (first-fit decreasing); a ordem final volta à do corredor.
  const order = new Map(sectors.map((sector, index) => [sector, index]))
  for (const sector of [...sectors].sort((a, b) => b.columns - a.columns || order.get(a)! - order.get(b)!)) {
    const fits = sector.rows === 1 && bands.find(band => band.sectors.every(item => item.rows === 1) && band.used + sector.columns <= perRow)
    if (fits) { fits.sectors.push(sector); fits.used += sector.columns }
    else bands.push({ sectors: [sector], used: sector.columns })
  }
  return bands
    .map(band => ({ sectors: band.sectors.sort((a, b) => order.get(a)! - order.get(b)!), rows: Math.max(...band.sectors.map(sector => sector.rows)) }))
    .sort((a, b) => order.get(a.sectors[0]!)! - order.get(b.sectors[0]!)!)
}

export type FlyerZoneTarget = {
  id: string
  /** Nome da zona no modelo (ex.: "Mercearia"); quando é um setor, recebe as ofertas desse setor. */
  name?: string
  /** Área da zona; define a parte de ofertas sem setor que ela recebe. */
  area: number
}

/**
 * Distribui as ofertas entre as zonas de produtos de uma página. Zona com nome de setor recebe as
 * ofertas daquele departamento; o restante vai para as zonas sem setor (ou, se não houver, para
 * todas) em proporção à área. A ordem das ofertas é preservada dentro de cada zona.
 */
export const assignProductsToZones = (
  products: ReadonlyArray<FlyerStructureProduct>,
  zones: ReadonlyArray<FlyerZoneTarget>
): Record<string, string[]> => {
  const result: Record<string, string[]> = Object.fromEntries(zones.map(zone => [zone.id, [] as string[]]))
  if (!zones.length) return result
  const zoneDepartment = new Map(zones.map(zone => {
    const informed = normalize(zone.name)
    const department = informed && informed !== normalize(OTHER_OFFERS_TITLE) ? resolveFlyerDepartment({ name: '', department: zone.name }) : ''
    return [zone.id, department]
  }))
  const leftovers: FlyerStructureProduct[] = []
  for (const product of products) {
    const department = resolveFlyerDepartment(product)
    const zone = department ? zones.find(item => zoneDepartment.get(item.id) === department) : undefined
    if (zone) result[zone.id]!.push(product.id)
    else leftovers.push(product)
  }
  if (!leftovers.length) return result
  const open = zones.filter(zone => !zoneDepartment.get(zone.id))
  const targets = open.length ? open : [...zones]
  // Maiores restos (Hamilton): cada zona recebe a parte proporcional à área, sem perder ofertas.
  const totalArea = targets.reduce((sum, zone) => sum + Math.max(1, zone.area), 0)
  const quotas = targets.map(zone => leftovers.length * Math.max(1, zone.area) / totalArea)
  const counts = quotas.map(Math.floor)
  let missing = leftovers.length - counts.reduce((sum, count) => sum + count, 0)
  const byRemainder = quotas.map((quota, index) => ({ index, remainder: quota - Math.floor(quota) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) { if (missing-- <= 0) break; counts[index]!++ }
  let cursor = 0
  targets.forEach((zone, index) => {
    for (let n = 0; n < counts[index]!; n++) result[zone.id]!.push(leftovers[cursor++]!.id)
  })
  return result
}
