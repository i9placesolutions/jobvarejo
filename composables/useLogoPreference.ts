import { normalizeLogoPreference, type LogoPreference } from '~/utils/logoPreference'

export const useLogoPreference = () => {
  const preference = useState<LogoPreference | null>('logo-preference', () => null)
  const { user } = useAuth()
  const ownerId = useState<string>('logo-preference-owner', () => '')
  const { getApiAuthHeaders } = useApiAuth()
  let queue = Promise.resolve()
  let revision = 0
  const accept = (payload: any) => {
    if (payload?.id && user.value?.id && payload.id !== user.value.id) return
    if (payload?.id) ownerId.value = payload.id
    preference.value = normalizeLogoPreference((payload?.business_profile ?? payload)?.logoPreference)
  }
  const refresh = async () => {
    const version = revision
    const accountId = user.value?.id
    try {
      const result = await $fetch('/api/profile', { headers: await getApiAuthHeaders() })
      if (version === revision && accountId === user.value?.id) accept(result)
    } catch { /* Authentication may not exist on a public preview. */ }
  }
  const save = (value: LogoPreference) => {
    const accountId = user.value?.id
    const version = ++revision
    const normalized = normalizeLogoPreference(value)!
    const task = queue.catch(() => undefined).then(async () => {
      if (accountId !== user.value?.id) throw new Error('A conta foi alterada. Salve novamente.')
      const result = await $fetch('/api/profile/logo-preference', {
        method: 'PUT', headers: await getApiAuthHeaders(), body: normalized
      })
      if (accountId !== user.value?.id || version !== revision) return
      accept(result)
      if (import.meta.client) window.dispatchEvent(new CustomEvent('business-profile:updated', { detail: result }))
    })
    queue = task
    return task
  }
  watch(() => user.value?.id, id => {
    revision++
    if (!id || ownerId.value !== id) {
      preference.value = null
      ownerId.value = id || ''
    }
    if (id && import.meta.client) void refresh()
  }, { immediate: true })
  if (import.meta.client) {
    const update = (event: Event) => accept((event as CustomEvent).detail)
    onMounted(() => {
      void refresh()
      window.addEventListener('business-profile:updated', update)
      window.addEventListener('focus', refresh)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('business-profile:updated', update)
      window.removeEventListener('focus', refresh)
    })
  }
  return { preference, save, refresh, accept, flush: () => queue }
}
