import { createSupabaseAdmin } from '../utils/supabase'
import { requireAuthenticatedUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  const userId = user.id

  const supabase = createSupabaseAdmin()

  let q = supabase
    .from('label_templates')
    .select('id, user_id, name, kind, "group", preview_data_url, created_at, updated_at')
    .order('updated_at', { ascending: false })

  // Always fetch user templates + global templates for the authenticated user.
  q = q.or(`user_id.eq.${userId},user_id.is.null`)

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
