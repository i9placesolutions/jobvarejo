import { createClient } from '@supabase/supabase-js'

// Get Supabase URL and keys from environment
const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create client with anon key (for client-side operations)
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create admin client with service role key (for server operations)
export const createSupabaseAdmin = () => {
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
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
