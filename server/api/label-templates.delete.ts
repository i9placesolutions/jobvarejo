import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const id = query.id as string | undefined

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Template id required' })

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseKey)

  const { error } = await supabase
    .from('label_templates')
    .delete()
    .eq('id', id)

  if (error) {
    const msg = String((error as any).message || error)
    if (msg.includes("Could not find the table 'public.label_templates'") || msg.includes('schema cache')) {
      return { success: false, missingTable: true, message: msg }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
  return { success: true }
})
