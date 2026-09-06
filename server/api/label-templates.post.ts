import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { parseAndStringifyJsonbParam } from '../utils/jsonb'
import { pgOneOrNull, pgQuery } from '../utils/postgres'
import { isBuiltInLabelTemplateId } from '../../utils/labelTemplateHelpers'

type Body = {
  id?: string
  userId?: string | null
  name?: string
  kind?: string
  group?: any
  previewDataUrl?: string | null
}

const isMissingTableError = (err: any): boolean =>
  String(err?.code || '') === '42P01' ||
  String(err?.message || '').toLowerCase().includes('label_templates')

const isMissingCatalogScopeError = (err: any): boolean =>
  String(err?.code || '') === '42703' &&
  String(err?.message || '').toLowerCase().includes('template_key')

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `label-templates-post:${user.id}`, 90, 60_000)
  const body = (await readBody(event)) as Body

  const templateId = String(body?.id || '').trim()
  const templateName = String(body?.name || '').trim()
  const templateKind = String(body?.kind || '').trim()
  const previewDataUrl = body?.previewDataUrl == null ? null : String(body?.previewDataUrl)
  const templateKey = isBuiltInLabelTemplateId(templateId) ? templateId : null

  if (!templateId) throw createError({ statusCode: 400, statusMessage: 'Template id required' })
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(templateId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid template id format' })
  }
  if (!templateName) throw createError({ statusCode: 400, statusMessage: 'Template name required' })
  if (templateName.length > 120) throw createError({ statusCode: 400, statusMessage: 'Template name too long (max 120 chars)' })
  if (!templateKind) throw createError({ statusCode: 400, statusMessage: 'Template kind required' })
  if (templateKind.length > 80) throw createError({ statusCode: 400, statusMessage: 'Template kind too long' })
  if (!body?.group || typeof body.group !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Template group required' })
  }
  const groupJson = parseAndStringifyJsonbParam(body.group, 'group')
  if (groupJson.length > 6_000_000) {
    throw createError({ statusCode: 400, statusMessage: 'Template group too large (max 6MB)' })
  }
  if (previewDataUrl && previewDataUrl.length > 1_500_000) {
    throw createError({ statusCode: 400, statusMessage: 'previewDataUrl too large' })
  }

  try {
    const existing = await pgOneOrNull<{ id: string; user_id: string | null; template_key: string | null }>(
      `select id, user_id, template_key
       from public.label_templates
       where (
         user_id = $1
         and (id = $2 or template_key = $2)
       )
       or (
         user_id is null
         and id = $2
       )
       order by
         case when user_id = $1 and template_key = $2 then 0 else 1 end,
         updated_at desc
       limit 1`,
      [user.id, templateId]
    )

    // A global built-in is a reusable source. On first save, fork it into the
    // current user's catalog instead of allowing one user's edit to mutate the
    // shared row. Non-built-in global rows keep the existing ownership guard.
    const existingIsGlobalBuiltIn = !!existing && existing.user_id === null && !!templateKey
    if (existing && !existingIsGlobalBuiltIn && String(existing.user_id || '') !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Template belongs to another user or is global' })
    }

    const storageId = existing && !existingIsGlobalBuiltIn
      ? existing.id
      : templateKey
        ? `tpl_bi_${user.id.replace(/-/g, '')}_${templateKey}`
        : templateId
    const values = [
      user.id,
      templateKey,
      templateName,
      templateKind,
      groupJson,
      previewDataUrl ?? null,
      new Date().toISOString(),
      storageId
    ]

    let data: any = null
    if (existing && !existingIsGlobalBuiltIn) {
      data = await pgOneOrNull<any>(
        `update public.label_templates
         set user_id = $1,
             template_key = $2,
             name = $3,
             kind = $4,
             "group" = $5::jsonb,
             preview_data_url = $6,
             updated_at = $7
         where id = $8
           and user_id = $1
         returning coalesce(template_key, id) as id,
                   id as storage_id,
                   user_id,
                   name,
                   kind,
                   "group",
                   preview_data_url,
                   created_at,
                   updated_at`,
        values
      )
    } else {
      const { rows } = await pgQuery<any>(
        `insert into public.label_templates
           (id, user_id, template_key, name, kind, "group", preview_data_url, updated_at)
         values
           ($8, $1, $2, $3, $4, $5::jsonb, $6, $7)
         returning coalesce(template_key, id) as id,
                   id as storage_id,
                   user_id,
                   name,
                   kind,
                   "group",
                   preview_data_url,
                   created_at,
                   updated_at`,
        values
      )
      data = rows[0] || null
    }

    if (!data) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to persist template' })
    }
    return { success: true, template: data }
  } catch (error: any) {
    if (error?.statusCode) throw error
    const msg = String(error?.message || error)
    if (isMissingTableError(error)) {
      return { success: false, missingTable: true, message: msg }
    }
    if (isMissingCatalogScopeError(error)) {
      return {
        success: false,
        missingCatalogScope: true,
        message: 'A migração do escopo do catálogo ainda não foi aplicada.'
      }
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
