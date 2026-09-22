import { resolvePriceGroupVisibleBoundsLocal } from './fabricMeasure'

export const EDITOR_SELECTION_CHROME = {
  transparentCorners: false,
  cornerStyle: 'circle' as const,
  cornerColor: '#6d28d9',
  cornerStrokeColor: '#1e1b4b',
  cornerSize: 13,
  borderColor: '#6d28d9',
  borderScaleFactor: 1.5,
  borderOpacityWhenMoving: 1,
  padding: 0
}

type ProductCardSelectionDimensions = {
  width: number
  height: number
}

type PriceGroupSelectionDimensions = ProductCardSelectionDimensions & {
  centerOffsetX: number
  centerOffsetY: number
}

type SelectionGeometryDimensions = ProductCardSelectionDimensions & {
  centerOffsetX?: number
  centerOffsetY?: number
}

// Impede que os métodos de geometria do Fabric se chamem recursivamente com
// o mesmo override temporário. Um WeakSet mantém esse estado fora do JSON do
// canvas, portanto não interfere em autosave, histórico ou exportação.
const selectionGeometryOverrideInProgress = new WeakSet<object>()

const finitePositive = (value: unknown): number | null => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.abs(number) : null
}

const isProductCardSelectionTarget = (object: any): boolean => {
  if (!object || String(object.type || '').toLowerCase() !== 'group') return false
  if (object.isProductCard === true) return true
  if (String(object.name || '').trim().toLowerCase().startsWith('product-card')) return true
  if (object.isSmartObject === true && (finitePositive(object._cardWidth) || finitePositive(object._cardHeight))) return true
  return !!(
    String(object.parentZoneId || '').trim() ||
    String(object._zoneSlot?.zoneId || '').trim()
  ) && !!(finitePositive(object._cardWidth) || finitePositive(object._cardHeight))
}

const isPriceGroupSelectionTarget = (object: any): boolean => {
  if (!object || String(object.type || '').toLowerCase() !== 'group') return false
  return String(object.name || '').trim().toLowerCase() === 'pricegroup'
}

/**
 * Retorna o tamanho nominal do card, que e' diferente do bbox de um Group
 * quando um titulo, uma etiqueta ou outro filho fica alguns pixels para fora
 * do fundo. A selecao deve representar o card que o usuario manipula, nao o
 * maior envelope acidental dos filhos.
 */
export const resolveProductCardSelectionDimensions = (object: any): ProductCardSelectionDimensions | null => {
  if (!isProductCardSelectionTarget(object)) return null

  const children = typeof object.getObjects === 'function' ? object.getObjects() || [] : []
  const background = children.find((child: any) => (
    String(child?.type || '').toLowerCase() === 'rect' &&
    String(child?.name || '').trim().toLowerCase() === 'offerbackground'
  )) || children.find((child: any) => (
    String(child?.type || '').toLowerCase() === 'rect' &&
    /(background|offer-bg|card-bg|bg)/i.test(String(child?.name || ''))
  ))

  const backgroundWidth = finitePositive(background?.width)
    ? Number(background.width) * (finitePositive(background?.scaleX) || 1)
    : null
  const backgroundHeight = finitePositive(background?.height)
    ? Number(background.height) * (finitePositive(background?.scaleY) || 1)
    : null
  const width = finitePositive(object._cardWidth) || backgroundWidth
  const height = finitePositive(object._cardHeight) || backgroundHeight

  if (!width || !height) return null
  return { width, height }
}

type FabricPoint = { x: number, y: number }

const isFinitePoint = (value: any): value is FabricPoint => (
  Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y))
)

/**
 * Procura o fundo que de fato desenha a pílula. Quando existe, ele é mais
 * confiável que o bbox do grupo: textos podem sair do fundo e grupos aninhados
 * têm coordenadas locais diferentes das coordenadas do `priceGroup`.
 */
const findVisiblePriceBackground = (object: any): any => {
  const walk = (current: any, ancestorsVisible: boolean): any => {
    if (!current || !ancestorsVisible || current.visible === false) return null
    if (String(current.name || '').trim().toLowerCase() === 'price_bg') return current
    if (typeof current.getObjects !== 'function') return null
    const children = current.getObjects() || []
    for (const child of children) {
      const result = walk(child, true)
      if (result) return result
    }
    return null
  }

  if (typeof object?.getObjects !== 'function') return null
  for (const child of object.getObjects() || []) {
    const result = walk(child, object.visible !== false)
    if (result) return result
  }
  return null
}

/**
 * Transforma um ponto absoluto no plano local de um objeto Fabric. O matrix de
 * `calcTransformMatrix()` já inclui grupos pais, por isso isto mantém correta a
 * seleção de etiquetas dentro de cards, frames e grupos aninhados.
 */
const toLocalPoint = (point: FabricPoint, matrix: any): FabricPoint | null => {
  if (!Array.isArray(matrix) || matrix.length < 6) return null
  const a = Number(matrix[0])
  const b = Number(matrix[1])
  const c = Number(matrix[2])
  const d = Number(matrix[3])
  const e = Number(matrix[4])
  const f = Number(matrix[5])
  const determinant = (a * d) - (b * c)
  if (![a, b, c, d, e, f, determinant].every(Number.isFinite) || Math.abs(determinant) < 0.000001) return null
  const x = Number(point.x) - e
  const y = Number(point.y) - f
  return {
    x: ((d * x) - (c * y)) / determinant,
    y: ((-b * x) + (a * y)) / determinant
  }
}

const resolveVisiblePriceBackgroundGeometry = (priceGroup: any): PriceGroupSelectionDimensions | null => {
  const background = findVisiblePriceBackground(priceGroup)
  if (!background || typeof background.getCoords !== 'function' || typeof priceGroup?.calcTransformMatrix !== 'function') return null

  let absoluteCoords: any
  let matrix: any
  try {
    absoluteCoords = background.getCoords()
    matrix = priceGroup.calcTransformMatrix()
  } catch {
    return null
  }

  if (!Array.isArray(absoluteCoords) || absoluteCoords.length < 4 || !absoluteCoords.every(isFinitePoint)) return null
  const localCoords = absoluteCoords
    .map((point: FabricPoint) => toLocalPoint(point, matrix))
    .filter(Boolean) as FabricPoint[]
  if (localCoords.length !== absoluteCoords.length) return null

  const left = Math.min(...localCoords.map(point => point.x))
  const right = Math.max(...localCoords.map(point => point.x))
  const top = Math.min(...localCoords.map(point => point.y))
  const bottom = Math.max(...localCoords.map(point => point.y))
  const width = finitePositive(right - left)
  const height = finitePositive(bottom - top)
  if (!width || !height) return null

  return {
    width,
    height,
    centerOffsetX: (left + right) / 2,
    centerOffsetY: (top + bottom) / 2
  }
}

/**
 * A etiqueta pode manter filhos invisíveis ou uma área original muito maior
 * que a pílula renderizada. Para a seleção, usamos somente o bbox visível e
 * deslocamos temporariamente o centro do grupo até o centro desse bbox.
 */
export const resolvePriceGroupSelectionDimensions = (object: any): PriceGroupSelectionDimensions | null => {
  if (!isPriceGroupSelectionTarget(object)) return null

  const visibleBackground = resolveVisiblePriceBackgroundGeometry(object)
  if (visibleBackground) return visibleBackground

  const bounds = resolvePriceGroupVisibleBoundsLocal(object)
  const width = finitePositive(bounds?.width)
  const height = finitePositive(bounds?.height)
  if (!width || !height) return null

  const centerOffsetX = (Number(bounds?.left) + Number(bounds?.right)) / 2
  const centerOffsetY = (Number(bounds?.top) + Number(bounds?.bottom)) / 2
  if (!Number.isFinite(centerOffsetX) || !Number.isFinite(centerOffsetY)) return null

  return { width, height, centerOffsetX, centerOffsetY }
}

const resolveSelectionGeometryDimensions = (object: any): SelectionGeometryDimensions | null => {
  const productCard = resolveProductCardSelectionDimensions(object)
  if (productCard) return productCard
  return resolvePriceGroupSelectionDimensions(object)
}

const resolveSelectionCenterOffset = (
  object: any,
  dimensions: SelectionGeometryDimensions
): { x: number, y: number } => {
  const centerOffsetX = Number(dimensions.centerOffsetX) || 0
  const centerOffsetY = Number(dimensions.centerOffsetY) || 0
  if (!centerOffsetX && !centerOffsetY) return { x: 0, y: 0 }

  const rawScaleX = Number(object?.scaleX)
  const rawScaleY = Number(object?.scaleY)
  const scaleX = (Number.isFinite(rawScaleX) ? rawScaleX : 1) * (object?.flipX ? -1 : 1)
  const scaleY = (Number.isFinite(rawScaleY) ? rawScaleY : 1) * (object?.flipY ? -1 : 1)
  const angle = (Number(object?.angle) || 0) * (Math.PI / 180)
  const localX = centerOffsetX * scaleX
  const localY = centerOffsetY * scaleY

  return {
    x: localX * Math.cos(angle) - localY * Math.sin(angle),
    y: localX * Math.sin(angle) + localY * Math.cos(angle)
  }
}

const withSelectionGeometryDimensions = <T>(object: any, callback: () => T): T => {
  const dimensions = resolveSelectionGeometryDimensions(object)
  if (!dimensions) return callback()
  if (selectionGeometryOverrideInProgress.has(object)) return callback()

  const previousWidth = object.width
  const previousHeight = object.height
  const previousLeft = object.left
  const previousTop = object.top
  const centerOffset = resolveSelectionCenterOffset(object, dimensions)
  selectionGeometryOverrideInProgress.add(object)
  try {
    // Fabric's selection methods derive both border and control coordinates
    // from width/height and the group's center. Temporarily substituting the
    // visible dimensions keeps rendered art and persisted geometry untouched.
    object.width = dimensions.width
    object.height = dimensions.height
    if (Number.isFinite(Number(previousLeft))) object.left = Number(previousLeft) + centerOffset.x
    if (Number.isFinite(Number(previousTop))) object.top = Number(previousTop) + centerOffset.y
    return callback()
  } finally {
    object.width = previousWidth
    object.height = previousHeight
    object.left = previousLeft
    object.top = previousTop
    selectionGeometryOverrideInProgress.delete(object)
  }
}

/** Atualiza as alças no mesmo bbox temporário que será desenhado pelo Fabric. */
const syncSelectionGeometryCoordinates = (object: any): void => {
  if (!resolveSelectionGeometryDimensions(object) || typeof object?.setCoords !== 'function') return
  withSelectionGeometryDimensions(object, () => object.setCoords())
}

const isTransientControlObject = (object: any): boolean => {
  const name = String(object?.name || '')
  return name === 'control_point' || name === 'path_node' || name === 'bezier_handle' || object?.excludeFromExport === true && object?.selectable === false
}

export const applyVisibleSelectionChrome = (object: any): void => {
  if (!object || typeof object.set !== 'function' || isTransientControlObject(object)) return
  object.set({ ...EDITOR_SELECTION_CHROME })
  // Rebuild aCoords/oCoords with the same temporary dimensions used to draw
  // the selector. The override is runtime-only and never reaches canvas JSON.
  syncSelectionGeometryCoordinates(object)
  if (String(object.type || '').toLowerCase() === 'activeselection' && typeof object.getObjects === 'function') {
    object.getObjects().forEach((child: any) => applyVisibleSelectionChrome(child))
  }
}

const patchSelectionGeometry = (fabricNs: any): void => {
  const Ctor = fabricNs?.FabricObject || fabricNs?.InteractiveFabricObject || fabricNs?.Object
  const prototype = Ctor?.prototype
  if (!prototype || prototype.__patchedVisibleSelectionGeometryV2) return

  const originalRenderControls = prototype._renderControls
  if (typeof originalRenderControls === 'function') {
    prototype._renderControls = function(this: any, ...args: any[]) {
      // `_renderControls` calcula a matriz de desenho, a borda e as alças numa
      // única chamada. Aplicar o bbox somente aqui mantém os três no mesmo
      // centro; sobrescrever cada método separadamente foi o que deslocou a
      // moldura para a esquerda enquanto as alças iam para outro ponto.
      return withSelectionGeometryDimensions(this, () => {
        this.setCoords?.()
        return originalRenderControls.apply(this, args)
      })
    }
  }

  prototype.__patchedVisibleSelectionGeometryV2 = true
}

export const patchFabricObjectSelectionDefaults = (fabricNs: any): void => {
  const constructors = [
    fabricNs?.InteractiveFabricObject,
    fabricNs?.FabricObject,
    fabricNs?.Object
  ].filter(Boolean)

  constructors.forEach((Ctor: any) => {
    if (!Ctor?.prototype || Ctor.prototype.__patchedVisibleSelectionChrome) return
    Object.assign(Ctor.prototype, EDITOR_SELECTION_CHROME)
    // Fabric 7 copies `ownDefaults` onto every instance before options are
    // applied, so changing only the prototype does not affect new objects.
    if (Ctor.ownDefaults && typeof Ctor.ownDefaults === 'object') {
      Object.assign(Ctor.ownDefaults, EDITOR_SELECTION_CHROME)
    }
    Ctor.prototype.__patchedVisibleSelectionChrome = true
  })

  patchSelectionGeometry(fabricNs)
}

export const attachFabricControlLayer = (canvas: any): (() => void) => {
  if (!canvas) return () => {}

  canvas.controlsAboveOverlay = true
  canvas.skipControlsDrawing = false

  const syncChrome = () => {
    const active = canvas.getActiveObject?.()
    if (active) applyVisibleSelectionChrome(active)
  }

  canvas.on?.('selection:created', syncChrome)
  canvas.on?.('selection:updated', syncChrome)
  canvas.on?.('mouse:up', syncChrome)
  syncChrome()

  return () => {
    canvas.off?.('selection:created', syncChrome)
    canvas.off?.('selection:updated', syncChrome)
    canvas.off?.('mouse:up', syncChrome)
  }
}

export const setFabricControlsHiddenDuringTransform = (canvas: any, hidden: boolean) => {
  if (!canvas) return
  canvas.__hideControlsDuringTransform = hidden
  if (hidden) {
    try {
      canvas.clearContext?.(canvas.contextTop)
    } catch {
      // ignore
    }
  }
}
