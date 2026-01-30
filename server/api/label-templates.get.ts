import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)

  const userId = (query.userId as string | undefined) || undefined

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseKey)

  let q = supabase
    .from('label_templates')
    .select('id, user_id, name, kind, "group", preview_data_url, created_at, updated_at')
    .order('updated_at', { ascending: false })

  // If userId is provided, fetch user templates + global ones (user_id is null).
  if (userId) {
    q = q.or(`user_id.eq.${userId},user_id.is.null`)
  }

  const { data, error } = await q
  if (error) {
    const msg = String((error as any).message || error)
    // Graceful fallback when migration hasn't been applied yet.
    if (msg.includes("Could not find the table 'public.label_templates'") || msg.includes('schema cache')) {
      return { success: true, templates: [], missingTable: true }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  return { success: true, templates: data || [] }
})
