import { createClient } from '@supabase/supabase-js'

type Body = {
  id?: string
  userId?: string | null
  name?: string
  kind?: string
  group?: any
  previewDataUrl?: string | null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = (await readBody(event)) as Body

  if (!body?.id) throw createError({ statusCode: 400, statusMessage: 'Template id required' })
  if (!body?.name) throw createError({ statusCode: 400, statusMessage: 'Template name required' })
  if (!body?.kind) throw createError({ statusCode: 400, statusMessage: 'Template kind required' })
  if (!body?.group) throw createError({ statusCode: 400, statusMessage: 'Template group required' })

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseKey)

  const payload = {
    id: body.id,
    user_id: body.userId ?? null,
    name: body.name,
    kind: body.kind,
    group: body.group,
    preview_data_url: body.previewDataUrl ?? null,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('label_templates')
    .upsert(payload, { onConflict: 'id' })
    .select('id, user_id, name, kind, "group", preview_data_url, created_at, updated_at')
    .single()

  if (error) {
    const msg = String((error as any).message || error)
    if (msg.includes("Could not find the table 'public.label_templates'") || msg.includes('schema cache')) {
      return { success: false, missingTable: true, message: msg }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
  return { success: true, template: data }
})
