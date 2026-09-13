export type ProductCardDropRect = {
  left: number
  top: number
  width: number
  height: number
}

type ProductCardDropSwapOptions = {
  draggedCard: any
  cards: any[]
  zoneId: string
  getBounds: (card: any) => ProductCardDropRect | null | undefined
}

const toFinite = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeRect = (value: any): ProductCardDropRect | null => {
  const left = toFinite(value?.left)
  const top = toFinite(value?.top)
  const width = toFinite(value?.width)
  const height = toFinite(value?.height)
  if (left === null || top === null || width === null || height === null || width <= 0 || height <= 0) return null
  return { left, top, width, height }
}

const getSlotRect = (card: any, zoneId: string): ProductCardDropRect | null => {
  const slot = card?._zoneSlot
  if (!slot || String(slot.zoneId || '').trim() !== zoneId) return null
  return normalizeRect(slot)
}

const isPointInside = (x: number, y: number, rect: ProductCardDropRect): boolean => (
  x >= rect.left &&
  x <= rect.left + rect.width &&
  y >= rect.top &&
  y <= rect.top + rect.height
)

const overlapRatio = (first: ProductCardDropRect, second: ProductCardDropRect): number => {
  const width = Math.max(0, Math.min(first.left + first.width, second.left + second.width) - Math.max(first.left, second.left))
  const height = Math.max(0, Math.min(first.top + first.height, second.top + second.height) - Math.max(first.top, second.top))
  if (width <= 0 || height <= 0) return 0
  return (width * height) / Math.max(1, Math.min(first.width * first.height, second.width * second.height))
}

/**
 * Encontra o card que ocupa o slot onde outro card foi solto.
 *
 * A troca só acontece quando o centro do card solto entrou no slot de outro
 * card ou quando há sobreposição relevante. Soltar o card em área vazia
 * preserva a posição manual, sem reordenar o restante do grid.
 */
export const resolveProductCardDropSwapTarget = (
  options: ProductCardDropSwapOptions
): any | null => {
  const zoneId = String(options.zoneId || '').trim()
  if (!zoneId || !options.draggedCard || !Array.isArray(options.cards)) return null

  const draggedBounds = normalizeRect(options.getBounds(options.draggedCard))
  if (!draggedBounds) return null

  const centerX = draggedBounds.left + draggedBounds.width / 2
  const centerY = draggedBounds.top + draggedBounds.height / 2
  const seen = new Set<any>()
  let best: { card: any; priority: number; overlap: number; distance: number } | null = null

  for (const candidate of options.cards) {
    if (!candidate || candidate === options.draggedCard || seen.has(candidate)) continue
    seen.add(candidate)

    const candidateZoneId = String(candidate?.parentZoneId || candidate?._zoneSlot?.zoneId || '').trim()
    if (candidateZoneId !== zoneId) continue

    const slot = getSlotRect(candidate, zoneId)
    if (!slot) continue

    const inside = isPointInside(centerX, centerY, slot)
    const overlap = overlapRatio(draggedBounds, slot)
    if (!inside && overlap < 0.3) continue

    const slotCenterX = slot.left + slot.width / 2
    const slotCenterY = slot.top + slot.height / 2
    const distance = ((centerX - slotCenterX) ** 2) + ((centerY - slotCenterY) ** 2)
    const score = { card: candidate, priority: inside ? 2 : 1, overlap, distance }

    if (!best ||
      score.priority > best.priority ||
      (score.priority === best.priority && score.overlap > best.overlap) ||
      (score.priority === best.priority && score.overlap === best.overlap && score.distance < best.distance)
    ) {
      best = score
    }
  }

  return best?.card || null
}
