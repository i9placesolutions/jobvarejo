import type { UserWithProfile, AuthState } from '~/types/auth'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

const AUTH_COOKIE = 'authenticated'

// The access-token cookie is httpOnly — only the server can read/write it.
// We use the non-httpOnly `authenticated` flag to check presence client-side.
const isAuthFlagSet = (): boolean => {
  if (!process.client) return false
  return document.cookie.split(';').some(c => c.trim() === `${AUTH_COOKIE}=true`)
}

const clearAuthFlag = () => {
  if (!process.client) return
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`
}

const toUser = (user: any): UserWithProfile | null => {
  if (!user?.id) return null
  const metadataName = user?.user_metadata?.name ?? user?.name ?? null
  const metadataAvatarUrl = user?.user_metadata?.avatar_url ?? user?.avatar_url ?? null
  return {
    id: String(user.id),
    email: String(user.email || ''),
    name: metadataName == null ? null : String(metadataName),
    avatar_url: metadataAvatarUrl == null ? null : String(metadataAvatarUrl),
    user_metadata: {
      name: metadataName == null ? null : String(metadataName),
      avatar_url: metadataAvatarUrl == null ? null : String(metadataAvatarUrl)
    },
    role: (String(user.role || 'user') as UserWithProfile['role'])
  }
}

export const useAuth = () => {
  const state = useState<AuthState>('auth', () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false
  }))

  const getSession = async () => {
    state.value.isLoading = true
    try {
      // Check the non-httpOnly flag cookie before making an API call
      if (!isAuthFlagSet()) {
        state.value.user = null
        state.value.isAuthenticated = false
        return null
      }

      const data = await $fetch<any>('/api/auth/session')
      const user = toUser(data?.user)
      if (!user) {
        state.value.user = null
        state.value.isAuthenticated = false
        clearAuthFlag()
        return null
      }

      state.value.user = user
      state.value.isAuthenticated = true
      return { user }
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      // Apenas 401/403 indicam sessao realmente invalida.
      // Erros 5xx, timeout ou rede nao devem derrubar o usuario — preservamos
      // o estado atual para nao forcar um logout indevido em falhas transitorias.
      if (statusCode === 401 || statusCode === 403) {
        state.value.user = null
        state.value.isAuthenticated = false
        clearAuthFlag()
        return null
      }
      console.warn('[auth.getSession] falha transitoria ao consultar sessao:', statusCode || error?.message || error)
      return state.value.isAuthenticated ? { user: state.value.user! } : null
    } finally {
      state.value.isLoading = false
    }
  }

  const signIn = async (whatsapp: string, password: string) => {
    const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp)
    if (!normalizedWhatsApp) throw new Error('Informe um WhatsApp válido com DDD.')
    if (!String(password || '')) throw new Error('Informe sua senha.')

    try {
      const data = await $fetch<any>('/api/auth/login', {
        method: 'POST',
        body: {
          whatsapp: normalizedWhatsApp,
          password
        }
      })

      const user = toUser(data?.user)
      if (!user) throw new Error('Nao foi possivel iniciar sessao.')
      state.value.user = user
      state.value.isAuthenticated = true
      // Server already set the httpOnly access-token cookie; nothing to write client-side
      return data
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      if (statusCode === 401) throw new Error('WhatsApp ou senha inválidos.')
      throw new Error(error?.data?.statusMessage || error?.message || 'Erro ao fazer login. Tente novamente.')
    }
  }

  const signUp = async (email: string, password: string, name: string, whatsapp: string, whatsappCode: string) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const trimmedName = String(name || '').trim()
    const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp)
    if (!trimmedName) throw new Error('Informe seu nome.')
    if (!normalizedEmail) throw new Error('Informe um e-mail valido.')
    if (!normalizedWhatsApp) throw new Error('Informe um WhatsApp válido com DDD.')
    if (String(password || '').length < 8) throw new Error('A senha deve ter no minimo 8 caracteres.')
    if (!/^\d{6}$/.test(String(whatsappCode || '').trim())) throw new Error('Informe o código de confirmação do WhatsApp.')

    try {
      const data = await $fetch<any>('/api/auth/register', {
        method: 'POST',
        body: {
          name: trimmedName,
          email: normalizedEmail,
          whatsapp: normalizedWhatsApp,
          whatsapp_code: String(whatsappCode).trim(),
          password,
          auto_login: false
        }
      })
      return data
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      if (statusCode === 409) throw new Error('Este e-mail ou WhatsApp já está vinculado a uma conta.')
      throw new Error(error?.data?.statusMessage || error?.message || 'Erro ao criar conta. Tente novamente.')
    }
  }

  const signOut = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    state.value.user = null
    state.value.isAuthenticated = false
    // Server clears httpOnly token cookie; we just clear the flag cookie
    clearAuthFlag()
    await navigateTo('/auth/login')
  }

  const hasRole = (role: string) => state.value.user?.role === role
  const isSuperAdmin = computed(() => state.value.user?.role === 'super_admin')
  const isAdmin = computed(() =>
    state.value.user?.role === 'super_admin' ||
    state.value.user?.role === 'admin'
  )

  return {
    user: computed(() => state.value.user),
    isAuthenticated: computed(() => state.value.isAuthenticated),
    isLoading: computed(() => state.value.isLoading),
    getSession,
    signIn,
    signUp,
    signOut,
    hasRole,
    isSuperAdmin,
    isAdmin
  }
}
