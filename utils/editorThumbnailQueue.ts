/** Uma fila por página: alterações durante o intervalo nunca são descartadas. */
export const createEditorThumbnailQueue = <T>(render: (id: string, value: T) => Promise<string>, apply: (id: string, image: string, value: T) => void) => {
  const states = new Map<string, { value: T; revision: number; lastAt: number; timer?: ReturnType<typeof setTimeout>; running: boolean; interval: number }>()
  let disposed = false
  const arm = (id: string) => {
    const state = states.get(id)!
    if (disposed || state.running) return
    if (state.timer) clearTimeout(state.timer)
    const delay = state.lastAt ? Math.max(0, state.interval - (Date.now() - state.lastAt)) : 0
    state.timer = setTimeout(async () => {
      state.timer = undefined
      state.running = true
      const revision = state.revision
      try {
        const image = await render(id, state.value)
        if (!disposed && revision === state.revision && image) apply(id, image, state.value)
      } catch (error) {
        console.warn('[Thumbnail] Falha ao atualizar prévia:', error)
      } finally {
        state.running = false
        state.lastAt = Date.now()
        if (!disposed && revision !== state.revision) arm(id)
      }
    }, delay)
  }
  return {
    schedule(id: string, value: T, interval: number) {
      if (disposed) return
      const state = states.get(id)
      if (state) { state.value = value; state.revision++; state.interval = interval }
      else states.set(id, { value, revision: 1, lastAt: 0, running: false, interval })
      arm(id)
    },
    dispose() {
      disposed = true
      for (const state of states.values()) if (state.timer) clearTimeout(state.timer)
      states.clear()
    }
  }
}
