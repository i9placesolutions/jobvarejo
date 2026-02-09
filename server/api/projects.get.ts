import { toWasabiProxyUrl } from '~/utils/storageProxy'
import { createSupabaseAdmin } from '../utils/supabase'
import { requireAuthenticatedUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event)
    const query = getQuery(event)
    const id = query.id as string

    const supabase = createSupabaseAdmin()

    if (id) {
        // Get only project owned by current user
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) {
            throw createError({ statusCode: 500, statusMessage: error.message })
        }
        return data
    } else {
        // List only projects from current user (Limit 10 for now)
        const { data, error } = await supabase
            .from('projects')
            .select('id, name, created_at, preview_url') // Don't fetch heavy canvas_data for list
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) {
            throw createError({ statusCode: 500, statusMessage: error.message })
        }
        // Normalize preview URLs so thumbnails work even when the bucket is private.
        return (data || []).map((p: any) => ({
            ...p,
            preview_url: toWasabiProxyUrl(p?.preview_url)
        }))
    }
})
