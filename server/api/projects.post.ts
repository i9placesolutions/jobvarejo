import { createSupabaseAdmin } from '../utils/supabase'
import { requireAuthenticatedUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event)
    const body = await readBody(event)
    
    // Validate Body
    if (!body.canvas_data) {
        throw createError({ statusCode: 400, statusMessage: "Canvas Data required" })
    }

    const supabase = createSupabaseAdmin()

    const projectData = {
        name: body.name || 'Untitled Project',
        canvas_data: body.canvas_data,
        preview_url: body.preview_url,
        user_id: user.id,
        updated_at: new Date().toISOString()
    }

    let result;
    
    if (body.id) {
        // Update
        const { data, error } = await (supabase.from as any)('projects')
            .update(projectData)
            .eq('id', body.id)
            .eq('user_id', user.id)
            .select()
            .single()
            
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        result = data
    } else {
        // Insert
        const { data, error } = await (supabase.from as any)('projects')
            .insert(projectData)
            .select()
            .single()

        if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        result = data
    }

    return { success: true, project: result }
})
