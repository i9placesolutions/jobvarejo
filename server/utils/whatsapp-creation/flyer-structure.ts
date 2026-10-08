import { chooseFlyerStructure, type FlyerStructureFormat, type FlyerStructurePlan } from '~/utils/flyerStructure'
import type { CreationOrder, FlyerCustomization } from '~/shared/whatsapp-creation'

/** Variação de estrutura salva no modelo (template_config.structureBlueprints). */
export interface FlyerStructureBlueprint {
  structureId: string
  structureName?: string
  formatId: string
  width: number
  height: number
  canvasDataPath: string
  thumbnailPath?: string
}

const FORMATS: readonly FlyerStructureFormat[] = ['feed', 'stories', 'square', 'print', 'tv']

/**
 * Estrutura do encarte para um pedido e formato. Usa a escolha do cliente (customization.structure)
 * ou decide pelas ofertas (utils/flyerStructure). Só vale para pedido de página única; divisões em
 * páginas/departamentos e modelos sem variações seguem no Clássico, como antes.
 * Retorna o plano e a variação a carregar (null = página normal do modelo).
 */
export function pickFlyerStructure(
  order: Pick<CreationOrder, 'products' | 'division'>,
  customization: FlyerCustomization | undefined,
  templateConfig: { structureBlueprints?: unknown } | null | undefined,
  formatId: string
): { plan: FlyerStructurePlan; blueprint: FlyerStructureBlueprint | null } | null {
  const blueprints = Array.isArray(templateConfig?.structureBlueprints) ? templateConfig!.structureBlueprints as FlyerStructureBlueprint[] : []
  const format = FORMATS.find(item => item === formatId)
  if (!blueprints.length || !format || !order.products.length) return null
  if (order.division && order.division !== 'single') return null
  const featured = new Set(customization?.featuredProductIds || [])
  const products = order.products.map(product => ({ id: product.id, name: product.name, brand: product.brand, variant: product.variant,
    department: product.department, featured: featured.has(product.id) }))
  const plan = chooseFlyerStructure(products, { format, preferred: customization?.structure || null })
  if (plan.structure === 'classico') return { plan, blueprint: null }
  const blueprint = blueprints.find(item => item.structureId === plan.structure && item.formatId === formatId
    && typeof item.canvasDataPath === 'string' && item.canvasDataPath.length > 0) || null
  // Sem a variação neste formato, o pedido segue na página normal do modelo.
  return blueprint ? { plan, blueprint } : { plan: { ...plan, structure: 'classico', sectors: [], heroIds: [] }, blueprint: null }
}

/** Ofertas em destaque primeiro: a receita "vitrine" do Produto Herói destaca as primeiras posições. */
export function orderForStructure<T extends { id: string }>(items: readonly T[], plan: FlyerStructurePlan | null | undefined): T[] {
  if (!plan || plan.structure !== 'heroi' || !plan.heroIds.length) return [...items]
  const heroes = plan.heroIds.map(id => items.find(item => item.id === id)).filter((item): item is T => Boolean(item))
  return [...heroes, ...items.filter(item => !plan.heroIds.includes(item.id))]
}

/** Aviso curto ao cliente sobre a estrutura escolhida pelo sistema, com a opção de trocar. */
export function structureNotice(plan: FlyerStructurePlan, chosenByClient: boolean): string | null {
  if (chosenByClient || plan.structure === 'classico') return null
  if (plan.structure === 'setores') return `Separei as ofertas por setor (${plan.sectors.map(sector => sector.title.toLowerCase()).join(', ')}). Se preferir tudo junto, é só pedir.`
  if (plan.structure === 'heroi') return 'Coloquei os destaques em tamanho grande no topo. Se preferir sem destaque, é só pedir.'
  return 'Como são poucas ofertas, deixei os produtos grandes e os contatos na faixa lateral. Se preferir em grade, é só pedir.'
}
