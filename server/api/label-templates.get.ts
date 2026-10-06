import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const isMissingTableError = (err: any): boolean =>
  String(err?.code || '') === '42P01' ||
  String(err?.message || '').toLowerCase().includes('label_templates')

const isMissingCatalogScopeError = (err: any): boolean =>
  String(err?.code || '') === '42703' &&
  String(err?.message || '').toLowerCase().includes('template_key')

const parseTemplateIds = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  return [...new Set(values
    .flatMap((item) => String(item).split(','))
    .map((id) => id.trim())
    .filter(Boolean))]
    .slice(0, 500)
}

const selectedColumns = (summary: boolean, includePreview: boolean): string => {
  if (summary) return 'id, name, kind, created_at, updated_at'
  return [
    'id', 'user_id', 'name', 'kind', '"group"',
    includePreview ? 'preview_data_url' : 'null::text as preview_data_url',
    'created_at', 'updated_at'
  ].join(', ')
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `label-templates-get:${user.id}`, 180, 60_000)

  const query = getQuery(event)
  const hasIdsFilter = Object.prototype.hasOwnProperty.call(query, 'ids')
  const ids = parseTemplateIds(query.ids)
  const summary = String(query.summary || '') === '1'
  const includePreview = !summary && String(query.preview ?? '') !== '0'
  const columns = selectedColumns(summary, includePreview)
  const catalogOptionalColumns = [
    ...(!summary ? ['"group"'] : []),
    ...(!summary ? [includePreview ? 'preview_data_url' : 'null::text as preview_data_url'] : [])
  ].map((column) => `,\n           ${column}`).join('')
  const params: unknown[] = [user.id]
  const idFilter = hasIdsFilter
    ? (() => {
        params.push(ids)
        return `and coalesce(template_key, id) = any($${params.length}::text[])`
      })()
    : ''

  try {
    const { rows } = await pgQuery<any>(
      `select ${columns}
       from (
         select distinct on (coalesce(template_key, id))
           coalesce(template_key, id) as id,
           user_id,
           name,
           kind${catalogOptionalColumns},
           created_at,
           updated_at
         from public.label_templates
         where (user_id = $1 or user_id is null)
           ${idFilter}
         order by
           coalesce(template_key, id),
           case when user_id = $1 then 0 else 1 end,
           updated_at desc
       ) catalog
       order by updated_at desc
       limit 501`,
      params
    )

    const resultRows = rows || []
    return {
      success: true,
      templates: resultRows.slice(0, 500),
      complete: resultRows.length <= 500
    }
  } catch (error: any) {
    const msg = String(error?.message || error)
    if (isMissingTableError(error)) {
      return { success: true, templates: [], missingTable: true }
    }
    if (isMissingCatalogScopeError(error)) {
      // Preserve readability on older deployments without template_key.
      const legacyParams: unknown[] = [user.id]
      const legacyIdFilter = hasIdsFilter
        ? (() => {
            legacyParams.push(ids)
            return `and id = any($${legacyParams.length}::text[])`
          })()
        : ''
      const { rows } = await pgQuery<any>(
        `select ${columns}
         from public.label_templates
         where (user_id = $1 or user_id is null)
           ${legacyIdFilter}
         order by updated_at desc
         limit 501`,
        legacyParams
      )
      const resultRows = rows || []
      return {
        success: true,
        templates: resultRows.slice(0, 500),
        complete: resultRows.length <= 500,
        missingCatalogScope: true
      }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
