import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const isMissingTableError = (err: any): boolean =>
  String(err?.code || '') === '42P01' ||
  String(err?.message || '').toLowerCase().includes('label_templates')

const isMissingCatalogScopeError = (err: any): boolean =>
  String(err?.code || '') === '42703' &&
  String(err?.message || '').toLowerCase().includes('template_key')

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `label-templates-get:${user.id}`, 180, 60_000)

  try {
    const { rows } = await pgQuery<any>(
      `select id, user_id, name, kind, "group", preview_data_url, created_at, updated_at
       from (
         select distinct on (coalesce(template_key, id))
           coalesce(template_key, id) as id,
           user_id,
           name,
           kind,
           "group",
           preview_data_url,
           created_at,
           updated_at
         from public.label_templates
         where user_id = $1
            or user_id is null
         order by
           coalesce(template_key, id),
           case when user_id = $1 then 0 else 1 end,
           updated_at desc
       ) catalog
       order by updated_at desc
       limit 500`,
      [user.id]
    )

    return { success: true, templates: rows || [] }
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (isMissingTableError(error)) {
      return { success: true, templates: [], missingTable: true }
    }
    if (isMissingCatalogScopeError(error)) {
      // Keep older deployments readable until the explicit catalog-scope
      // migration is applied. Writes will remain local until then.
      const { rows } = await pgQuery<any>(
        `select id, user_id, name, kind, "group", preview_data_url, created_at, updated_at
         from public.label_templates
         where user_id = $1
            or user_id is null
         order by updated_at desc
         limit 500`,
        [user.id]
      )
      return { success: true, templates: rows || [], missingCatalogScope: true }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
