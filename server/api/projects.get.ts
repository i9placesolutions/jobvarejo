import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const query = getQuery(event)
    const id = query.id as string

    // Initialize Supabase Client (Server-side)
    const supabase = createClient(config.public.supabaseUrl, config.public.supabaseKey)

    if (id) {
        // Get Single Project
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            throw createError({ statusCode: 500, statusMessage: error.message })
        }
        return data
    } else {
        // List Projects (Limit 10 for now)
        const { data, error } = await supabase
            .from('projects')
            .select('id, name, created_at, preview_url') // Don't fetch heavy canvas_data for list
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) {
            throw createError({ statusCode: 500, statusMessage: error.message })
        }
        return data
    }
})
