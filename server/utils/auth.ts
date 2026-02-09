import { createClient, type User } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

let authClientCache: ReturnType<typeof createClient> | null = null

const getAuthClient = () => {
  if (authClientCache) return authClientCache

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase public keys are not configured on server'
    })
  }

  authClientCache = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return authClientCache
}

const getBearerToken = (event: H3Event): string | null => {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) return null

  const prefix = 'Bearer '
  if (!authHeader.startsWith(prefix)) return null

  const token = authHeader.slice(prefix.length).trim()
  return token || null
}

export const requireAuthenticatedUser = async (event: H3Event): Promise<User> => {
  const token = getBearerToken(event)
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing Authorization bearer token'
    })
  }

  const supabase = getAuthClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired auth token'
    })
  }

  return data.user
}
