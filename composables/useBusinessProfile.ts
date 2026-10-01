import { createScopedRequestCache } from '~/utils/scopedRequestCache'

// Por Nuxt app: nunca compartilhar perfil entre requests SSR ou contas.
const profileCacheKey = Symbol('business-profile-reads')
export const useBusinessProfile = () => {
  const app = useNuxtApp() as ReturnType<typeof useNuxtApp> & { [profileCacheKey]?: ReturnType<typeof createScopedRequestCache<any>> }
  const cache = app[profileCacheKey] ||= createScopedRequestCache<any>()
  const { user } = useAuth()
  const { getApiAuthHeaders } = useApiAuth()
  watch(() => user.value?.id, (id, previous) => {
    if (id !== previous) cache.clear()
  }, { flush: 'sync' })
  const accept = (payload: any) => {
    const id = String(user.value?.id || '')
    // Eventos parciais não substituem a resposta completa do endpoint.
    if (id && String(payload?.id || '') === id && payload?.business_profile) {
      const previous = cache.peek(id)
      if (payload.role || previous) cache.accept(id, { ...previous, ...payload })
      else cache.clear()
    }
  }
  const load = async (options: { force?: boolean } = {}) => {
    const id = String(user.value?.id || '')
    if (!id) throw new Error('Conta indisponível.')
    const result = await cache.load(id, async () => {
      const response = await $fetch<any>('/api/profile', { headers: await getApiAuthHeaders(), query: { self: '1' } })
      if (String(response?.id || '') !== id || user.value?.id !== id) throw new Error('A conta foi alterada.')
      return response
    }, options.force)
    if (user.value?.id !== id) throw new Error('A conta foi alterada.')
    return result
  }
  return { load, accept, invalidate: () => cache.clear() }
}
