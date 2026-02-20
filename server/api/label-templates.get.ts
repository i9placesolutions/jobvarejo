import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const isMissingTableError = (err: any): boolean =>
  String(err?.code || '') === '42P01' ||
  String(err?.message || '').toLowerCase().includes('label_templates')

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `label-templates-get:${user.id}`, 180, 60_000)

  try {
    const { rows } = await pgQuery<any>(
      `select id, user_id, name, kind, "group", preview_data_url, created_at, updated_at
       from public.label_templates
       where user_id = $1
          or user_id is null
       order by updated_at desc`,
      [user.id]
    )

    return { success: true, templates: rows || [] }
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (isMissingTableError(error)) {
      return { success: true, templates: [], missingTable: true }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
