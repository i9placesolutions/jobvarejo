import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toIntOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `folders-post:${user.id}`, 120, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const name = String(body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Folder name required' })
  if (name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name too long (max 120 chars)' })
  }

  const parentIdRaw = body?.parent_id
  const parentId = parentIdRaw == null || parentIdRaw === '' ? null : String(parentIdRaw).trim()
  if (parentId && !isUuid(parentId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid parent_id format' })
  }

  const desiredOrderIndex = toIntOrNull(body?.order_index)
  if (body?.order_index != null && desiredOrderIndex == null) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid order_index format' })
  }

  try {
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
    }

    let orderIndex = desiredOrderIndex
    if (orderIndex == null) {
      const row = await pgOneOrNull<{ next_order_index: number }>(
        `select coalesce(max(order_index), -1) + 1 as next_order_index
         from public.folders
         where user_id = $1
           and (
             (parent_id is null and $2::uuid is null)
             or parent_id = $2::uuid
           )`,
        [user.id, parentId]
      )
      orderIndex = Number(row?.next_order_index ?? 0)
    }

    const { rows } = await pgQuery<any>(
      `insert into public.folders
         (name, parent_id, user_id, order_index)
       values
         ($1, $2::uuid, $3, $4)
       returning *`,
      [name, parentId, user.id, orderIndex]
    )

    return { success: true, folder: rows[0] || null }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to create folder' })
  }
})
