/**
 * Coalesced render scheduler para o editor Fabric.js.
 *
 * Em vez de cada chamada de requestRenderAll disparar seu proprio RAF,
 * o scheduler acumula requests e executa UM unico render por frame.
 * Isso elimina renders duplicados e reduz a carga no main thread.
 *
 * Uso:
 *   const scheduler = createRenderScheduler(canvasRef, isCanvasDestroyed)
 *   scheduler.scheduleRender()     // substitui canvas.value.requestRenderAll()
 *   scheduler.renderNow()          // render sincrono (para export, load, etc.)
 *   scheduler.dispose()            // limpa RAF pendente no unmount
 */

type CanvasRef = { value: any }
type DestroyedRef = { value: boolean }

export type RenderScheduler = {
  scheduleRender: () => void
  renderNow: () => void
  cancelPending: () => void
  dispose: () => void
}

export const createRenderScheduler = (
  canvasRef: CanvasRef,
  isCanvasDestroyed: DestroyedRef
): RenderScheduler => {
  let rafId: number | null = null

  const ensureFabricContexts = (fc: any): boolean => {
    try {
      if (fc.upperCanvasEl && (!fc.contextTop || typeof fc.contextTop.clearRect !== 'function')) {
        const ctxTop = fc.upperCanvasEl.getContext?.('2d')
        if (ctxTop) fc.contextTop = ctxTop
      }
      if (fc.lowerCanvasEl && (!fc.contextContainer || typeof fc.contextContainer.clearRect !== 'function')) {
        const ctx = fc.lowerCanvasEl.getContext?.('2d')
        if (ctx) fc.contextContainer = ctx
      }
      if (!fc.context && fc.contextContainer) fc.context = fc.contextContainer
      return !!(fc.contextContainer && typeof fc.contextContainer.clearRect === 'function')
    } catch {
      return false
    }
  }

  const executeRender = () => {
    const c = canvasRef.value
    if (!c || isCanvasDestroyed.value) return
    const requestRender = typeof c.__origRequestRenderAll === 'function'
      ? c.__origRequestRenderAll.bind(c)
      : (typeof c.requestRenderAll === 'function' ? c.requestRenderAll.bind(c) : null)
    if (!requestRender) return

    try {
      if (!ensureFabricContexts(c)) return
      requestRender()
    } catch {
      // Fallback: render sincrono
      try {
        if (typeof c.renderAll === 'function') c.renderAll()
      } catch {
        // Canvas pode estar disposed
      }
    }
  }

  const scheduleRender = () => {
    const c = canvasRef.value
    if (!c || isCanvasDestroyed.value) return

    // Se ja temos um RAF pendente, nao agendamos outro
    if (rafId !== null) return

    rafId = requestAnimationFrame(() => {
      rafId = null
      executeRender()
    })
  }

  const renderNow = () => {
    cancelPending()
    executeRender()
  }

  const cancelPending = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const dispose = () => {
    cancelPending()
  }

  return { scheduleRender, renderNow, cancelPending, dispose }
}
