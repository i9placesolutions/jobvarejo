/** Último estado por página, com apenas uma renderização offscreen por editor. */
export const createEditorThumbnailQueue = <T>(render: (id: string, value: T) => Promise<string>, apply: (id: string, image: string, value: T) => void) => {
  type State = { value: T; revision: number; lastAt: number; interval: number; pending: boolean }
  const states = new Map<string, State>()
  let disposed = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const arm = () => {
    if (disposed || running) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    const pending = [...states.entries()].filter(([, state]) => state.pending)
    if (!pending.length) return
    const readyAt = (state: State) => state.lastAt ? state.lastAt + state.interval : 0
    pending.sort((a, b) => readyAt(a[1]) - readyAt(b[1]))
    const [id, state] = pending[0]!
    timer = setTimeout(async () => {
      timer = undefined
      if (disposed) return
      running = true
      state.pending = false
      const revision = state.revision
      const value = state.value
      try {
        const image = await render(id, value)
        if (!disposed && revision === state.revision && image) apply(id, image, value)
      } catch (error) {
        console.warn('[Thumbnail] Falha ao atualizar prévia:', error)
      } finally {
        running = false
        state.lastAt = Date.now()
        arm()
      }
    }, Math.max(0, readyAt(state) - Date.now()))
  }
  return {
    schedule(id: string, value: T, interval: number) {
      if (disposed) return
      const state = states.get(id)
      if (state) { state.value = value; state.revision++; state.interval = interval; state.pending = true }
      else states.set(id, { value, revision: 1, lastAt: 0, interval, pending: true })
      arm()
    },
    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      states.clear()
    }
  }
}
