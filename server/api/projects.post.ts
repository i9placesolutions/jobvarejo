import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)
    
    // Validate Body
    if (!body.canvas_data) {
        throw createError({ statusCode: 400, statusMessage: "Canvas Data required" })
    }

    // Initialize Supabase Client
    const supabase = createClient(config.public.supabaseUrl, config.public.supabaseKey)

    const projectData = {
        name: body.name || 'Untitled Project',
        canvas_data: body.canvas_data,
        preview_url: body.preview_url,
        updated_at: new Date().toISOString()
    }

    let result;
    
    if (body.id) {
        // Update
        const { data, error } = await supabase
            .from('projects')
            .update(projectData)
            .eq('id', body.id)
            .select()
            .single()
            
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        result = data
    } else {
        // Insert
        const { data, error } = await supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single()

        if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        result = data
    }

    return { success: true, project: result }
})
