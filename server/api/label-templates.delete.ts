import { createSupabaseAdmin } from '../utils/supabase'
import { requireAuthenticatedUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  const query = getQuery(event)
  const id = query.id as string | undefined

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Template id required' })

  const supabase = createSupabaseAdmin()

  const { error } = await supabase
    .from('label_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    const msg = String((error as any).message || error)
    if (msg.includes("Could not find the table 'public.label_templates'") || msg.includes('schema cache')) {
      return { success: false, missingTable: true, message: msg }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
  return { success: true }
})
