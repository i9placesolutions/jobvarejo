import type { UserWithProfile, AuthState } from '~/types/auth'

const AUTH_COOKIE = 'authenticated'
const ACCESS_TOKEN_COOKIE = 'access-token'
const LEGACY_ACCESS_TOKEN_COOKIE = 'sb-access-token'

const updateAuthCookie = (authenticated: boolean, accessToken?: string | null) => {
  if (!process.client) return

  if (authenticated) {
    document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=604800; samesite=lax`
  } else {
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`
  }

  const normalizedToken = String(accessToken || '').trim()
  if (authenticated && normalizedToken) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(normalizedToken)}; path=/; max-age=604800; samesite=lax`
    // Keep legacy cookie for backward compatibility during cutover.
    document.cookie = `${LEGACY_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(normalizedToken)}; path=/; max-age=604800; samesite=lax`
  } else if (!authenticated) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`
    document.cookie = `${LEGACY_ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`
  }
}

const readTokenFromCookie = (): string | null => {
  if (!process.client) return null
  const cookieEntries = document.cookie
    .split(';')
    .map((entry) => entry.trim())
  const currentCookie = cookieEntries.find((entry) => entry.startsWith(`${ACCESS_TOKEN_COOKIE}=`))
  const legacyCookie = cookieEntries.find((entry) => entry.startsWith(`${LEGACY_ACCESS_TOKEN_COOKIE}=`))
  const match = currentCookie || legacyCookie
  if (!match) return null
  const prefix = currentCookie ? `${ACCESS_TOKEN_COOKIE}=` : `${LEGACY_ACCESS_TOKEN_COOKIE}=`
  const raw = match.slice(prefix.length)
  try {
    return decodeURIComponent(raw).trim() || null
  } catch {
    return raw.trim() || null
  }
}

const toUser = (user: any): UserWithProfile | null => {
  if (!user?.id) return null
  return {
    id: String(user.id),
    email: String(user.email || ''),
    name: user.name == null ? null : String(user.name),
    avatar_url: user.avatar_url == null ? null : String(user.avatar_url),
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
      const data = await $fetch<any>('/api/auth/session')
      const user = toUser(data?.user)
      if (!user) {
        state.value.user = null
        state.value.isAuthenticated = false
        updateAuthCookie(false)
        return null
      }

      state.value.user = user
      state.value.isAuthenticated = true
      updateAuthCookie(true, readTokenFromCookie())
      return { user }
    } catch {
      state.value.user = null
      state.value.isAuthenticated = false
      updateAuthCookie(false)
      return null
    } finally {
      state.value.isLoading = false
    }
  }

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) throw new Error('Informe um e-mail valido.')
    if (!String(password || '')) throw new Error('Informe sua senha.')

    try {
      const data = await $fetch<any>('/api/auth/login', {
        method: 'POST',
        body: {
          email: normalizedEmail,
          password
        }
      })

      const user = toUser(data?.user)
      if (!user) throw new Error('Nao foi possivel iniciar sessao.')
      state.value.user = user
      state.value.isAuthenticated = true
      updateAuthCookie(true, String(data?.session?.access_token || readTokenFromCookie() || ''))
      return data
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      if (statusCode === 401) throw new Error('E-mail ou senha invalidos.')
      throw new Error(error?.data?.statusMessage || error?.message || 'Erro ao fazer login. Tente novamente.')
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const trimmedName = String(name || '').trim()
    if (!trimmedName) throw new Error('Informe seu nome.')
    if (!normalizedEmail) throw new Error('Informe um e-mail valido.')
    if (String(password || '').length < 8) throw new Error('A senha deve ter no minimo 8 caracteres.')

    try {
      const data = await $fetch<any>('/api/auth/register', {
        method: 'POST',
        body: {
          name: trimmedName,
          email: normalizedEmail,
          password,
          auto_login: false
        }
      })
      return data
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.response?.status || 0)
      if (statusCode === 409) throw new Error('Ja existe uma conta com este e-mail.')
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
    updateAuthCookie(false)
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
