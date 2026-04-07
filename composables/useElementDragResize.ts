import { ref, type Ref } from 'vue'

// --- Tipos ---

export interface DragResizeElement {
  id: string
  x: string  // '5%'
  y: string  // '20%'
  w: string  // '90%'
  h: string  // '50%'
  [key: string]: any
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

// --- Helpers ---

/** Converte '50%' para 50 */
function parsePct(val: string): number {
  return parseFloat(val.replace('%', '')) || 0
}

/** Restringe valor entre min e max */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max)
}

/** Arredonda para grid de 1% (snap) */
function snapToGrid(val: number): number {
  return Math.round(val)
}

// --- Composable ---

export function useElementDragResize(
  containerRef: Ref<HTMLElement | null>,
  elements: Ref<DragResizeElement[]>,
  selectedId: Ref<string | null>,
  options: { snap?: boolean } = { snap: true }
) {
  const isDragging = ref(false)
  const isResizing = ref(false)
  const activeHandle = ref<ResizeHandle | null>(null)

  // Estado interno de tracking
  let startPointerX = 0
  let startPointerY = 0
  let startElX = 0
  let startElY = 0
  let startElW = 0
  let startElH = 0
  let activeElementId: string | null = null

  /** Retorna largura e altura do container em pixels */
  function getContainerSize(): { width: number; height: number } {
    const el = containerRef.value
    if (!el) return { width: 1, height: 1 }
    return { width: el.clientWidth, height: el.clientHeight }
  }

  /** Busca o elemento pelo id no array reativo */
  function findElement(id: string): DragResizeElement | undefined {
    return elements.value.find((el) => el.id === id)
  }

  /** Aplica snap opcional e clamp entre 0-100 */
  function finalize(val: number): number {
    const clamped = clamp(val, 0, 100)
    return options.snap ? snapToGrid(clamped) : clamped
  }

  // =====================
  // DRAG (arrastar corpo)
  // =====================

  function startDrag(elementId: string, event: PointerEvent) {
    const el = findElement(elementId)
    if (!el) return

    event.preventDefault()
    event.stopPropagation()

    // Captura pointer no target para tracking suave fora do elemento
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    activeElementId = elementId
    selectedId.value = elementId
    isDragging.value = true

    startPointerX = event.clientX
    startPointerY = event.clientY
    startElX = parsePct(el.x)
    startElY = parsePct(el.y)
    startElW = parsePct(el.w)
    startElH = parsePct(el.h)

    // Registra listeners no target capturado
    target.addEventListener('pointermove', onDragMove)
    target.addEventListener('pointerup', onDragEnd)
    target.addEventListener('pointercancel', onDragEnd)
  }

  function onDragMove(event: PointerEvent) {
    if (!isDragging.value || !activeElementId) return

    const el = findElement(activeElementId)
    if (!el) return

    const container = getContainerSize()

    // Delta em pixels convertido para porcentagem
    const deltaXPct = ((event.clientX - startPointerX) / container.width) * 100
    const deltaYPct = ((event.clientY - startPointerY) / container.height) * 100

    // Calcula nova posicao garantindo que o elemento nao saia do container
    const newX = finalize(clamp(startElX + deltaXPct, 0, 100 - startElW))
    const newY = finalize(clamp(startElY + deltaYPct, 0, 100 - startElH))

    el.x = `${newX}%`
    el.y = `${newY}%`
  }

  function onDragEnd(event: PointerEvent) {
    isDragging.value = false
    activeElementId = null

    const target = event.currentTarget as HTMLElement
    target.releasePointerCapture(event.pointerId)
    target.removeEventListener('pointermove', onDragMove)
    target.removeEventListener('pointerup', onDragEnd)
    target.removeEventListener('pointercancel', onDragEnd)
  }

  // =======================
  // RESIZE (redimensionar)
  // =======================

  function startResize(elementId: string, handle: ResizeHandle, event: PointerEvent) {
    const el = findElement(elementId)
    if (!el) return

    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    activeElementId = elementId
    selectedId.value = elementId
    isResizing.value = true
    activeHandle.value = handle

    startPointerX = event.clientX
    startPointerY = event.clientY
    startElX = parsePct(el.x)
    startElY = parsePct(el.y)
    startElW = parsePct(el.w)
    startElH = parsePct(el.h)

    target.addEventListener('pointermove', onResizeMove)
    target.addEventListener('pointerup', onResizeEnd)
    target.addEventListener('pointercancel', onResizeEnd)
  }

  function onResizeMove(event: PointerEvent) {
    if (!isResizing.value || !activeElementId || !activeHandle.value) return

    const el = findElement(activeElementId)
    if (!el) return

    const container = getContainerSize()
    const handle = activeHandle.value

    const deltaXPct = ((event.clientX - startPointerX) / container.width) * 100
    const deltaYPct = ((event.clientY - startPointerY) / container.height) * 100

    let newX = startElX
    let newY = startElY
    let newW = startElW
    let newH = startElH

    const MIN_SIZE = 2 // tamanho minimo em %

    // Eixo horizontal
    const movesLeft = handle.includes('w')
    const movesRight = handle.includes('e')

    if (movesRight) {
      // Borda direita se move: apenas largura muda
      newW = clamp(startElW + deltaXPct, MIN_SIZE, 100 - startElX)
    }

    if (movesLeft) {
      // Borda esquerda se move: posicao e largura mudam inversamente
      const maxDelta = startElW - MIN_SIZE // nao pode encolher alem do minimo
      const clampedDelta = clamp(deltaXPct, -startElX, maxDelta)
      newX = startElX + clampedDelta
      newW = startElW - clampedDelta
    }

    // Eixo vertical
    const movesTop = handle.includes('n')
    const movesBottom = handle.includes('s')

    if (movesBottom) {
      newH = clamp(startElH + deltaYPct, MIN_SIZE, 100 - startElY)
    }

    if (movesTop) {
      const maxDelta = startElH - MIN_SIZE
      const clampedDelta = clamp(deltaYPct, -startElY, maxDelta)
      newY = startElY + clampedDelta
      newH = startElH - clampedDelta
    }

    el.x = `${finalize(newX)}%`
    el.y = `${finalize(newY)}%`
    el.w = `${finalize(newW)}%`
    el.h = `${finalize(newH)}%`
  }

  function onResizeEnd(event: PointerEvent) {
    isResizing.value = false
    activeHandle.value = null
    activeElementId = null

    const target = event.currentTarget as HTMLElement
    target.releasePointerCapture(event.pointerId)
    target.removeEventListener('pointermove', onResizeMove)
    target.removeEventListener('pointerup', onResizeEnd)
    target.removeEventListener('pointercancel', onResizeEnd)
  }

  return {
    startDrag,
    startResize,
    isDragging,
    isResizing,
    activeHandle,
  }
}
