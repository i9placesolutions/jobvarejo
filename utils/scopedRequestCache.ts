/** Cache curto de leituras, isolado por conta. Uma atualização invalida respostas antigas. */
export function createScopedRequestCache<T>(ttlMs = 5_000, now = Date.now) {
  let generation = 0
  const entries = new Map<string, { value?: T; expires: number; pending?: Promise<T>; generation: number }>()
  return {
    clear() { generation++; entries.clear() },
    peek(key: string) { return entries.get(key)?.value },
    accept(key: string, value: T) {
      if (key) entries.set(key, { value, expires: now() + ttlMs, generation: ++generation })
    },
    load(key: string, loader: () => Promise<T>, force = false): Promise<T> {
      if (!key) return Promise.reject(new Error('Conta indisponível.'))
      const cached = entries.get(key)
      if (cached?.pending) return cached.pending
      if (!force && cached?.value !== undefined && cached.expires > now()) return Promise.resolve(cached.value)
      const entry = { expires: 0, generation, pending: undefined as Promise<T> | undefined, value: undefined as T | undefined }
      entries.set(key, entry)
      entry.pending = Promise.resolve().then(loader).then(value => {
        if (entries.get(key) !== entry) {
          const current = entries.get(key)
          if (current?.value !== undefined) return current.value
          throw new Error('Leitura de conta obsoleta.')
        }
        entry.value = value
        entry.expires = now() + ttlMs
        entry.pending = undefined
        return value
      }, error => {
        if (entries.get(key) === entry) entries.delete(key)
        throw error
      })
      return entry.pending
    }
  }
}
