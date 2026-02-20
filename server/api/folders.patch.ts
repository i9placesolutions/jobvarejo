import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toIntOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `folders-patch:${user.id}`, 180, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const folderId = String(body?.id || '').trim()
  if (!folderId || !isUuid(folderId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid folder id format' })
  }

  const updates: string[] = []
  const params: any[] = []
  const pushParam = (value: any) => {
    params.push(value)
    return `$${params.length}`
  }

  if ('name' in body) {
    const name = String(body?.name || '').trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Folder name required' })
    if (name.length > 120) {
      throw createError({ statusCode: 400, statusMessage: 'Folder name too long (max 120 chars)' })
    }
    updates.push(`name = ${pushParam(name)}`)
  }

  if ('icon' in body) {
    const icon = String(body?.icon || '').trim()
    if (!icon) throw createError({ statusCode: 400, statusMessage: 'Icon cannot be empty' })
    updates.push(`icon = ${pushParam(icon)}`)
  }

  if ('color' in body) {
    const color = String(body?.color || '').trim()
    if (!color) throw createError({ statusCode: 400, statusMessage: 'Color cannot be empty' })
    updates.push(`color = ${pushParam(color)}`)
  }

  if ('order_index' in body) {
    const orderIndex = toIntOrNull(body?.order_index)
    if (orderIndex == null) throw createError({ statusCode: 400, statusMessage: 'Invalid order_index format' })
    updates.push(`order_index = ${pushParam(orderIndex)}`)
  }

  if ('parent_id' in body) {
    const parentRaw = body?.parent_id
    const parentId = parentRaw == null || parentRaw === '' ? null : String(parentRaw).trim()
    if (parentId && !isUuid(parentId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent_id format' })
    }
    if (parentId && parentId === folderId) {
      throw createError({ statusCode: 400, statusMessage: 'Folder cannot be its own parent' })
    }

    if (parentId) {
      const parent = await pgOneOrNull<{ id: string }>(
        `select id
         from public.folders
         where id = $1
           and user_id = $2
         limit 1`,
        [parentId, user.id]
      )
      if (!parent?.id) {
        throw createError({ statusCode: 404, statusMessage: 'Parent folder not found' })
      }

      const cycle = await pgOneOrNull<{ id: string }>(
        `with recursive descendants as (
           select id
           from public.folders
           where id = $1
             and user_id = $2
           union all
           select f.id
           from public.folders f
           inner join descendants d on f.parent_id = d.id
           where f.user_id = $2
         )
         select id
         from descendants
         where id = $3
         limit 1`,
        [folderId, user.id, parentId]
      )
      if (cycle?.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot move folder into itself or one of its descendants'
        })
      }
    }

    updates.push(`parent_id = ${pushParam(parentId)}::uuid`)
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  updates.push(`updated_at = timezone('utc', now())`)
  const idPlaceholder = pushParam(folderId)
  const userPlaceholder = pushParam(user.id)

  try {
    const row = await pgOneOrNull<any>(
      `update public.folders
       set ${updates.join(', ')}
       where id = ${idPlaceholder}
         and user_id = ${userPlaceholder}
       returning *`,
      params
    )
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Folder not found' })

    return { success: true, folder: row }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to update folder' })
  }
})
