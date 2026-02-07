import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Cache para garantir apenas uma instância do Supabase client
// NOTE: Avoid `ReturnType<typeof createClient>` here — it can infer the wrong generic
// and make `.from('table')` resolve to `never` in TS.
let supabaseCache: SupabaseClient<any, any, any> | null = null

export const useSupabase = () => {
  if (supabaseCache) {
    return supabaseCache
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseKey
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured: missing public.supabaseUrl/public.supabaseKey')
  }

  supabaseCache = createClient(supabaseUrl, supabaseKey)
  return supabaseCache
}
