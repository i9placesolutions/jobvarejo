import type { UserWithProfile, AuthState } from '~/types/auth'

// Cookie key for auth state
const AUTH_COOKIE = 'authenticated'

// Cache for state to ensure it's only created once
let stateCache: Ref<AuthState> | null = null

// Helper to update auth cookie
const updateAuthCookie = (authenticated: boolean) => {
  if (process.client) {
    if (authenticated) {
      document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=604800` // 7 days
    } else {
      document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`
    }
  }
}

export const useAuth = () => {
  const state = stateCache ?? useState<AuthState>('auth', () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }))
  stateCache = state

  const supabase = useSupabase()

  // Get current session and profile
  const getSession = async () => {
    state.value.isLoading = true

    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {
        state.value.user = null
        state.value.isAuthenticated = false
        updateAuthCookie(false)
        return null
      }

      // Get user profile from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        state.value.user = {
          id: session.user.id,
          email: session.user.email!,
          name: profile.name,
          avatar_url: profile.avatar_url,
          role: profile.role,
        }
        state.value.isAuthenticated = true
        updateAuthCookie(true)
      }

      return session
    } catch (error) {
      console.error('Error getting session:', error)
      state.value.user = null
      state.value.isAuthenticated = false
      updateAuthCookie(false)
      return null
    } finally {
      state.value.isLoading = false
    }
  }

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    // Get user profile after sign in
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profile) {
        state.value.user = {
          id: data.user.id,
          email: data.user.email!,
          name: profile.name,
          avatar_url: profile.avatar_url,
          role: profile.role,
        }
        state.value.isAuthenticated = true
        updateAuthCookie(true)
      }
    }

    return data
  }

  // Sign up with email and password
  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  }

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut()
    state.value.user = null
    state.value.isAuthenticated = false
    updateAuthCookie(false)
    await navigateTo('/auth/login')
  }

  // Check if user has specific role
  const hasRole = (role: string) => {
    return state.value.user?.role === role
  }

  // Check if user is super admin
  const isSuperAdmin = computed(() => state.value.user?.role === 'super_admin')

  // Check if user is admin (admin or super admin)
  const isAdmin = computed(() =>
    state.value.user?.role === 'super_admin' ||
    state.value.user?.role === 'admin'
  )

  return {
    // State
    user: computed(() => state.value.user),
    isAuthenticated: computed(() => state.value.isAuthenticated),
    isLoading: computed(() => state.value.isLoading),

    // Methods
    getSession,
    signIn,
    signUp,
    signOut,
    hasRole,
    isSuperAdmin,
    isAdmin,
  }
}
