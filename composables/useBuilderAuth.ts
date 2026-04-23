import type { BuilderTenantPublic } from '~/types/builder'

interface BuilderAuthState {
  tenant: BuilderTenantPublic | null
  isAuthenticated: boolean
  isLoading: boolean
}

const AUTH_COOKIE = 'builder-authenticated'

const isAuthFlagSet = (): boolean => {
  if (!import.meta.client) return false
  return document.cookie.split(';').some(c => c.trim() === `${AUTH_COOKIE}=true`)
}

const clearAuthFlag = () => {
  if (!import.meta.client) return
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`
  document.cookie = `${AUTH_COOKIE}=; path=/builder; max-age=0; samesite=lax`
}

const toTenant = (data: any): BuilderTenantPublic | null => {
  if (!data?.id) return null
  return {
    id: String(data.id),
    email: String(data.email || ''),
    name: String(data.name || ''),
    slug: data.slug ?? null,
    logo: data.logo ?? null,
    logo_position: data.logo_position ?? {},
    slogan: data.slogan ?? null,
    phone: data.phone ?? null,
    phone2: data.phone2 ?? null,
    whatsapp: data.whatsapp ?? null,
    instagram: data.instagram ?? null,
    facebook: data.facebook ?? null,
    website: data.website ?? null,
    address: data.address ?? null,
    payment_notes: data.payment_notes ?? null,
    cep: data.cep ?? null,
    segment1: data.segment1 ?? null,
    segment2: data.segment2 ?? null,
    segment3: data.segment3 ?? null,
    show_on_portal: data.show_on_portal ?? false,
    flyer_defaults: data.flyer_defaults ?? null,
    plan: String(data.plan || 'free'),
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || '')
  }
}

export const useBuilderAuth = () => {
  const state = useState<BuilderAuthState>('builder-auth', () => ({
    tenant: null,
    isAuthenticated: false,
    isLoading: false
  }))

  const getSession = async () => {
    state.value.isLoading = true
    try {
      if (!isAuthFlagSet()) {
        state.value.tenant = null
        state.value.isAuthenticated = false
        return null
      }

      const data = await $fetch<any>('/api/builder/auth/session')
      const tenant = toTenant(data?.tenant)
      if (!tenant) {
        state.value.tenant = null
        state.value.isAuthenticated = false
        clearAuthFlag()
        return null
      }

      state.value.tenant = tenant
      state.value.isAuthenticated = true
      return { tenant }
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      // Apenas 401/403 indicam sessao realmente invalida.
      // Erros 5xx, timeout ou rede nao devem derrubar o tenant — preservamos
      // o estado atual para evitar logout indevido em falhas transitorias.
      if (statusCode === 401 || statusCode === 403) {
        state.value.tenant = null
        state.value.isAuthenticated = false
        clearAuthFlag()
        return null
      }
      console.warn('[builderAuth.getSession] falha transitoria ao consultar sessao:', statusCode || error?.message || error)
      return state.value.isAuthenticated && state.value.tenant ? { tenant: state.value.tenant } : null
    } finally {
      state.value.isLoading = false
    }
  }

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) throw new Error('Informe um e-mail válido.')
    if (!String(password || '')) throw new Error('Informe sua senha.')

    try {
      const data = await $fetch<any>('/api/builder/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password }
      })

      const tenant = toTenant(data?.tenant)
      if (!tenant) throw new Error('Não foi possível iniciar sessão.')
      state.value.tenant = tenant
      state.value.isAuthenticated = true
      return data
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      if (statusCode === 401) throw new Error('E-mail ou senha inválidos.')
      throw new Error(error?.data?.statusMessage || error?.message || 'Erro ao fazer login. Tente novamente.')
    }
  }

  const signUp = async (email: string, password: string, name: string, extra?: {
    phone?: string
    whatsapp?: string
    address?: string
    segment1?: string
  }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const trimmedName = String(name || '').trim()
    if (!trimmedName) throw new Error('Informe o nome da empresa.')
    if (!normalizedEmail) throw new Error('Informe um e-mail válido.')
    if (String(password || '').length < 8) throw new Error('A senha deve ter no mínimo 8 caracteres.')

    try {
      const data = await $fetch<any>('/api/builder/auth/register', {
        method: 'POST',
        body: {
          name: trimmedName,
          email: normalizedEmail,
          password,
          phone: extra?.phone || null,
          whatsapp: extra?.whatsapp || null,
          address: extra?.address || null,
          segment1: extra?.segment1 || null
        }
      })
      return data
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      if (statusCode === 409) throw new Error('Já existe uma conta com este e-mail.')
      throw new Error(error?.data?.statusMessage || error?.message || 'Erro ao criar conta. Tente novamente.')
    }
  }

  const signOut = async () => {
    try {
      await $fetch('/api/builder/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    state.value.tenant = null
    state.value.isAuthenticated = false
    clearAuthFlag()
    await navigateTo('/builder/login')
  }

  const updateProfile = (data: Partial<BuilderTenantPublic>) => {
    if (state.value.tenant) {
      state.value.tenant = { ...state.value.tenant, ...data }
    }
  }

  return {
    tenant: computed(() => state.value.tenant),
    isAuthenticated: computed(() => state.value.isAuthenticated),
    isLoading: computed(() => state.value.isLoading),
    getSession,
    signIn,
    signUp,
    signOut,
    updateProfile
  }
}
