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

const withProductCardSelectionDimensions = <T>(object: any, callback: () => T): T => {
  const dimensions = resolveProductCardSelectionDimensions(object)
  if (!dimensions) return callback()

  const previousWidth = object.width
  const previousHeight = object.height
  try {
    // Fabric's selection methods derive both border and control coordinates
    // from width/height. Temporarily substituting the nominal dimensions keeps
    // the rendered art and persisted geometry untouched.
    object.width = dimensions.width
    object.height = dimensions.height
    return callback()
  } finally {
    object.width = previousWidth
    object.height = previousHeight
  }
}

const isTransientControlObject = (object: any): boolean => {
  const name = String(object?.name || '')
  return name === 'control_point' || name === 'path_node' || name === 'bezier_handle' || object?.excludeFromExport === true && object?.selectable === false
}

export const applyVisibleSelectionChrome = (object: any): void => {
  if (!object || typeof object.set !== 'function' || isTransientControlObject(object)) return
  object.set({ ...EDITOR_SELECTION_CHROME })
  if (resolveProductCardSelectionDimensions(object)) {
    // Rebuild aCoords/oCoords after the selection-bound override is installed.
    // No custom property is persisted; _cardWidth/_cardHeight are already the
    // canonical card dimensions used by the product-card engine.
    object.setCoords?.()
  }
  if (String(object.type || '').toLowerCase() === 'activeselection' && typeof object.getObjects === 'function') {
    object.getObjects().forEach((child: any) => applyVisibleSelectionChrome(child))
  }
}

const patchProductCardSelectionGeometry = (fabricNs: any): void => {
  const Ctor = fabricNs?.FabricObject || fabricNs?.InteractiveFabricObject || fabricNs?.Object
  const prototype = Ctor?.prototype
  if (!prototype || prototype.__patchedProductCardSelectionGeometry) return

  const originalCalcACoords = prototype.calcACoords
  const originalCalcOCoords = prototype.calcOCoords
  const originalCalculateCurrentDimensions = prototype._calculateCurrentDimensions
  const originalDrawBorders = prototype.drawBorders

  if (typeof originalCalcACoords === 'function') {
    prototype.calcACoords = function(this: any) {
      return withProductCardSelectionDimensions(this, () => originalCalcACoords.call(this))
    }
  }

  if (typeof originalCalcOCoords === 'function') {
    prototype.calcOCoords = function(this: any) {
      return withProductCardSelectionDimensions(this, () => originalCalcOCoords.call(this))
    }
  }

  if (typeof originalCalculateCurrentDimensions === 'function') {
    prototype._calculateCurrentDimensions = function(this: any, ...args: any[]) {
      return withProductCardSelectionDimensions(this, () => originalCalculateCurrentDimensions.apply(this, args))
    }
  }

  if (typeof originalDrawBorders === 'function') {
    prototype.drawBorders = function(this: any, ...args: any[]) {
      return withProductCardSelectionDimensions(this, () => originalDrawBorders.apply(this, args))
    }
  }

  prototype.__patchedProductCardSelectionGeometry = true
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

  patchProductCardSelectionGeometry(fabricNs)
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
