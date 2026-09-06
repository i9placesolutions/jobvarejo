/**
 * Seletores seguros para as ferramentas de tema da edição rápida.
 *
 * O modo rápido pode alterar somente elementos vetoriais/textuais criados no
 * editor avançado. Imagens rasterizadas, molduras, zonas de produtos e campos
 * dinâmicos da loja continuam protegidos. Cards e etiquetas têm alvos próprios
 * para que a edição de cor fique explícita e não misture o modelo original com
 * a cópia deste projeto.
 */

const QUICK_NATIVE_TEXT_TYPES = new Set(['text', 'i-text', 'textbox'])
const QUICK_NATIVE_VECTOR_TYPES = new Set([
  'rect',
  'circle',
  'ellipse',
  'triangle',
  'polygon',
  'polyline',
  'line',
  'path'
])

const QUICK_NATIVE_EDITABLE_TYPES = new Set([
  ...QUICK_NATIVE_TEXT_TYPES,
  ...QUICK_NATIVE_VECTOR_TYPES
])

const QUICK_COLOR_TARGET_VECTOR_TYPES = new Set([...QUICK_NATIVE_VECTOR_TYPES])

const QUICK_CARD_BACKGROUND_NAMES = new Set([
  'offerbackground',
  'cardbackground',
  'productcardbackground'
])

const QUICK_PRICE_GROUP_NAMES = new Set(['pricegroup'])

// Nomes gerados pelos templates de etiqueta. O fallback por tipo abaixo
// também permite usar etiquetas legadas feitas com formas, desde que não
// sejam imagens.
const QUICK_PRICE_BACKGROUND_NAME_RE = /(?:^|_)(?:price|offer|atac|retail|wholesale|banner|header|currency|inner|burst)(?:_|$)|(?:^|_)(?:bg|background|border)(?:_|$)/i

export type QuickEditableColorTarget = {
  id: string
  kind: 'native' | 'product-card' | 'price-label'
  label: string
  description: string
  count: number
  objects: Array<{ object: any; property: 'fill' | 'stroke' }>
  color: string | null
  opacity: number
  mixedColor: boolean
  mixedOpacity: boolean
  canClear: boolean
}

const QUICK_SYSTEM_NAMES = new Set([
  'pricegroup',
  'offerbackground',
  'productimage',
  'product_image',
  'smart_image',
  'smartimage',
  'zonerect',
  'zone-border',
  'zoneborder'
])

const isTransparentPaint = (value: unknown): boolean => {
  if (value == null) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return !normalized || normalized === 'transparent' || normalized === 'none' || normalized === 'rgba(0, 0, 0, 0)'
  }
  return false
}

const normalizedName = (object: any): string => String(object?.name || '').trim().toLowerCase()

/** Retorna true quando o nó é parte estrutural do modelo ou do sistema. */
export const isQuickNativeExcludedObject = (object: any): boolean => {
  if (!object || typeof object !== 'object') return true

  const type = String(object.type || '').trim().toLowerCase()
  const name = normalizedName(object)

  if (!type || type === 'image' || type === 'active-selection' || type === 'activeselection' || type === 'clippath') return true
  if (object.visible === false || object.excludeFromExport === true) return true
  if (object.id === 'artboard-bg' || object.isFrame === true) return true
  if (object.isProductZone === true || object.isGridZone === true || object.isSmartObject === true || object.isProductCard === true) return true
  if (object.businessProfileField || object.isQuickGenerated === true || object.quickSeedId) return true
  if (QUICK_SYSTEM_NAMES.has(name)) return true

  return name.startsWith('product-card') || name.startsWith('product_card') || name.startsWith('smart-') || name.startsWith('zone-')
}

const getChildren = (object: any): any[] => {
  if (!object || typeof object.getObjects !== 'function') return []
  try {
    const children = object.getObjects()
    return Array.isArray(children) ? children : []
  } catch {
    return []
  }
}

/**
 * Percorre grupos sem expor o grupo em si. Assim uma composição nativa pode
 * continuar sendo editada por partes, enquanto um grupo de produto inteiro é
 * bloqueado pelo marcador estrutural acima.
 */
export const collectQuickNativeObjects = (objects: any[]): any[] => {
  const result: any[] = []
  const visited = new Set<any>()

  const walk = (object: any, blockedByParent = false) => {
    if (!object || visited.has(object)) return
    visited.add(object)

    const excluded = blockedByParent || isQuickNativeExcludedObject(object)
    if (excluded) return

    const children = getChildren(object)
    if (children.length > 0) {
      children.forEach(child => walk(child, false))
      return
    }

    const type = String(object.type || '').trim().toLowerCase()
    if (QUICK_NATIVE_EDITABLE_TYPES.has(type)) result.push(object)
  }

  ;(Array.isArray(objects) ? objects : []).forEach(object => walk(object))
  return result
}

export const isQuickNativeTextObject = (object: any): boolean => {
  const type = String(object?.type || '').trim().toLowerCase()
  return QUICK_NATIVE_TEXT_TYPES.has(type)
}

export const collectQuickNativeTextObjects = (objects: any[]): any[] => (
  collectQuickNativeObjects(objects).filter(isQuickNativeTextObject)
)

/** Retorna qual pintura pode ser alterada sem transformar uma imagem em cor. */
export const getQuickNativeColorProperty = (object: any): 'fill' | 'stroke' | null => {
  if (!object || isQuickNativeExcludedObject(object)) return null
  const type = String(object.type || '').trim().toLowerCase()
  if (!QUICK_NATIVE_EDITABLE_TYPES.has(type)) return null
  if (isQuickNativeTextObject(object)) return 'fill'

  if (!isTransparentPaint(object.fill)) return 'fill'
  if (!isTransparentPaint(object.stroke)) return 'stroke'
  return type === 'line' ? 'stroke' : null
}

export const collectQuickNativeColorTargets = (objects: any[]): Array<{ object: any; property: 'fill' | 'stroke' }> => (
  collectQuickNativeObjects(objects)
    .map(object => {
      const property = getQuickNativeColorProperty(object)
      return property ? { object, property } : null
    })
    .filter((item): item is { object: any; property: 'fill' | 'stroke' } => !!item)
)

const getObjectChildren = (object: any): any[] => {
  if (!object || typeof object.getObjects !== 'function') return []
  try {
    const children = object.getObjects()
    return Array.isArray(children) ? children : []
  } catch {
    return []
  }
}

const isVectorColorObject = (object: any): boolean => {
  const type = String(object?.type || '').trim().toLowerCase()
  return QUICK_COLOR_TARGET_VECTOR_TYPES.has(type)
}

const isProductCardObject = (object: any): boolean => {
  if (!object || String(object.type || '').trim().toLowerCase() !== 'group') return false
  const name = normalizedName(object)
  if (object.isProductCard === true || object.isSmartObject === true || name.startsWith('product-card')) return true
  return getObjectChildren(object).some(child => normalizedName(child) === 'offerbackground')
}

const isPriceGroupObject = (object: any): boolean => (
  !!object &&
  String(object.type || '').trim().toLowerCase() === 'group' &&
  QUICK_PRICE_GROUP_NAMES.has(normalizedName(object))
)

const collectDescendants = (root: any): any[] => {
  const result: any[] = []
  const visited = new Set<any>()
  const walk = (object: any) => {
    if (!object || visited.has(object)) return
    visited.add(object)
    result.push(object)
    getObjectChildren(object).forEach(walk)
  }
  walk(root)
  return result
}

const hasPaint = (value: unknown): boolean => !isTransparentPaint(value)

const resolvePaintProperty = (object: any): 'fill' | 'stroke' | null => {
  if (!isVectorColorObject(object) || object.visible === false) return null
  if (hasPaint(object.fill)) return 'fill'
  if (hasPaint(object.stroke)) return 'stroke'
  // Card backgrounds are valid targets even when the model deliberately
  // starts transparent, so the user can choose a color later.
  if (QUICK_CARD_BACKGROUND_NAMES.has(normalizedName(object))) return 'fill'
  return null
}

const resolveColorString = (value: unknown): string | null => {
  if (isTransparentPaint(value)) return null
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^#[0-9a-f]{3,8}$/i.test(normalized) ? normalized : null
}

const resolveTargetColor = (
  objects: Array<{ object: any; property: 'fill' | 'stroke' }>
): { color: string | null; mixedColor: boolean } => {
  const colors = objects
    .map(({ object, property }) => resolveColorString(object?.[property]))
    .filter((value): value is string => !!value)
  const unique = [...new Set(colors)]
  if (unique.length === 1 && colors.length === objects.length) {
    return { color: unique[0] || null, mixedColor: false }
  }
  return { color: unique[0] || null, mixedColor: unique.length > 1 || colors.length !== objects.length }
}

const resolveTargetOpacity = (
  objects: Array<{ object: any; property: 'fill' | 'stroke' }>
): { opacity: number; mixedOpacity: boolean } => {
  const values = objects.map(({ object }) => {
    const value = Number(object?.opacity)
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
  })
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 1
  return {
    opacity: Math.round(average * 100) / 100,
    mixedOpacity: new Set(values.map(value => Math.round(value * 100) / 100)).size > 1
  }
}

const buildColorTarget = (input: {
  id: string
  kind: QuickEditableColorTarget['kind']
  label: string
  description: string
  objects: Array<{ object: any; property: 'fill' | 'stroke' }>
}): QuickEditableColorTarget | null => {
  const uniqueObjects = input.objects.filter((item, index, items) => (
    item.object && items.findIndex(candidate => candidate.object === item.object && candidate.property === item.property) === index
  ))
  if (!uniqueObjects.length) return null
  const paint = resolveTargetColor(uniqueObjects)
  const opacity = resolveTargetOpacity(uniqueObjects)
  return {
    ...input,
    objects: uniqueObjects,
    count: uniqueObjects.length,
    color: paint.color,
    opacity: opacity.opacity,
    mixedColor: paint.mixedColor,
    mixedOpacity: opacity.mixedOpacity,
    canClear: true
  }
}

const isPriceLabelPaintObject = (object: any): boolean => {
  if (!isVectorColorObject(object) || object.visible === false) return false
  const name = normalizedName(object)
  if (name.includes('clip') || name.includes('mask')) return false
  if (QUICK_PRICE_BACKGROUND_NAME_RE.test(name)) return true
  // Templates created by users may have arbitrary names. In a priceGroup,
  // every vector node is still a shape owned by the label (text/images are
  // filtered by type), so it is safe to offer it as a project-only label color.
  return true
}

const collectCardBackgrounds = (objects: any[]): Array<{ object: any; property: 'fill' | 'stroke' }> => {
  const result: Array<{ object: any; property: 'fill' | 'stroke' }> = []
  const visited = new Set<any>()
  const walk = (object: any) => {
    if (!object || visited.has(object)) return
    visited.add(object)
    if (isProductCardObject(object)) {
      collectDescendants(object).forEach(child => {
        const name = normalizedName(child)
        if (!QUICK_CARD_BACKGROUND_NAMES.has(name)) return
        if (!isVectorColorObject(child)) return
        result.push({ object: child, property: 'fill' })
      })
      // O card é tratado como um alvo separado. Não expõe título, imagem ou
      // etiqueta como elementos nativos genéricos.
      return
    }
    getObjectChildren(object).forEach(walk)
  }
  ;(Array.isArray(objects) ? objects : []).forEach(walk)
  return result
}

const collectPriceLabelShapes = (objects: any[]): Array<{ object: any; property: 'fill' | 'stroke' }> => {
  const result: Array<{ object: any; property: 'fill' | 'stroke' }> = []
  const visited = new Set<any>()
  const walk = (object: any) => {
    if (!object || visited.has(object)) return
    visited.add(object)
    if (isPriceGroupObject(object)) {
      collectDescendants(object).forEach(child => {
        if (!isPriceLabelPaintObject(child)) return
        const property = resolvePaintProperty(child)
        if (property) result.push({ object: child, property })
      })
      return
    }
    getObjectChildren(object).forEach(walk)
  }
  ;(Array.isArray(objects) ? objects : []).forEach(walk)
  return result
}

/**
 * Retorna as escolhas que aparecem no botão Cores da edição rápida.
 *
 * Cada alvo contém referências apenas aos objetos da página atual. Alterar
 * esses objetos e salvar a página não toca no template de etiqueta nem no
 * modelo reutilizável original.
 */
export const collectQuickEditableColorTargets = (objects: any[]): QuickEditableColorTarget[] => {
  const cardObjects = collectCardBackgrounds(objects)
  const priceObjects = collectPriceLabelShapes(objects)
  const nativeObjects = collectQuickNativeColorTargets(objects)
  const seenObjects = new Set<any>()
  const seenIds = new Set<string>()
  const targets: QuickEditableColorTarget[] = []
  const append = (items: Array<{ object: any; property: 'fill' | 'stroke' }>, kind: QuickEditableColorTarget['kind'], label: string) => {
    items.forEach(item => {
      if (seenObjects.has(item.object)) return
      seenObjects.add(item.object)
      let id = String(item.object._customId || '')
      if (!id || seenIds.has(id)) {
        id = globalThis.crypto.randomUUID()
        item.object._customId = id
      }
      seenIds.add(id)
      let card = item.object.group
      while (card && !card._productData) card = card.group
      const productName = String(
        card?.getObjects?.().find((object: any) => object.name === 'smart_title')?.text ||
        card?._productData?.name || ''
      ).replace(/\s+/g, ' ').trim()
      const target = buildColorTarget({
        id: `object:${id}:${item.property}`, kind,
        label: kind === 'product-card' && productName ? productName : `${label} ${targets.length + 1}`,
        description: kind === 'product-card' ? 'Fundo do card deste produto' : String(item.object.name || 'Altera somente este elemento.'),
        objects: [item]
      })
      if (target) targets.push(target)
    })
  }
  append(cardObjects, 'product-card', 'Fundo do card')
  append(priceObjects, 'price-label', 'Forma da etiqueta')
  append(nativeObjects, 'native', 'Elemento')
  return targets
}
