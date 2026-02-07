import { createClient } from '@supabase/supabase-js'

// Create client with anon key (for client-side operations)
export const createSupabaseClient = () => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY)')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

// Singleton admin client — reutiliza a mesma instância para todas as requests
let _adminClient: ReturnType<typeof createClient> | null = null

export const createSupabaseAdmin = () => {
  if (_adminClient) return _adminClient

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceRoleKey

  if (!supabaseUrl) {
    throw new Error('Missing Supabase URL (NUXT_PUBLIC_SUPABASE_URL)')
  }
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  _adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  return _adminClient
}

// Type for profile
export type UserRole = 'super_admin' | 'admin' | 'user'

export interface DatabaseProfile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// Get user profile from database
export async function getUserProfile(userId: string): Promise<DatabaseProfile | null> {
  const supabase = createSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }

  return data
}

// Check if this is the first user (should be super admin)
export async function isFirstUser(): Promise<boolean> {
  const supabase = createSupabaseClient()

  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error checking first user:', error)
    return false
  }

  return (count || 0) === 0
}
