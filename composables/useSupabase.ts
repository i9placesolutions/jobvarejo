import { createClient } from '@supabase/supabase-js'

// Cache para garantir apenas uma instância do Supabase client
let supabaseCache: ReturnType<typeof createClient> | null = null

export const useSupabase = () => {
  if (supabaseCache) {
    return supabaseCache
  }

  const config = useRuntimeConfig()
  supabaseCache = createClient(config.public.supabaseUrl, config.public.supabaseKey)
  return supabaseCache
}
