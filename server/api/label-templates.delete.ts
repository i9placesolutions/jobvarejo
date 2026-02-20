import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const isMissingTableError = (err: any): boolean =>
  String(err?.code || '') === '42P01' ||
  String(err?.message || '').toLowerCase().includes('label_templates')

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `label-templates-delete:${user.id}`, 90, 60_000)
  const query = getQuery(event)
  const id = String(query.id || '').trim()

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Template id required' })
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid template id format' })
  }

  try {
    await pgQuery(
      `delete from public.label_templates
       where id = $1
         and user_id = $2`,
      [id, user.id]
    )
    return { success: true }
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (isMissingTableError(error)) {
      return { success: false, missingTable: true, message: msg }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
