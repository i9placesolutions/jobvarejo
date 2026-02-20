import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../utils/postgres'

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

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `label-templates-post:${user.id}`, 90, 60_000)
  const body = (await readBody(event)) as Body

  const templateId = String(body?.id || '').trim()
  const templateName = String(body?.name || '').trim()
  const templateKind = String(body?.kind || '').trim()
  const previewDataUrl = body?.previewDataUrl == null ? null : String(body?.previewDataUrl)

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
  if (previewDataUrl && previewDataUrl.length > 1_500_000) {
    throw createError({ statusCode: 400, statusMessage: 'previewDataUrl too large' })
  }

  try {
    const existing = await pgOneOrNull<{ id: string; user_id: string | null }>(
      `select id, user_id
       from public.label_templates
       where id = $1
       limit 1`,
      [templateId]
    )

    if (existing && String(existing.user_id || '') !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Template belongs to another user or is global' })
    }

    const values = [
      user.id,
      templateName,
      templateKind,
      body.group,
      previewDataUrl ?? null,
      new Date().toISOString(),
      templateId
    ]

    let data: any = null
    if (existing) {
      data = await pgOneOrNull<any>(
        `update public.label_templates
         set user_id = $1,
             name = $2,
             kind = $3,
             "group" = $4::jsonb,
             preview_data_url = $5,
             updated_at = $6
         where id = $7
           and user_id = $1
         returning id, user_id, name, kind, "group", preview_data_url, created_at, updated_at`,
        values
      )
    } else {
      const { rows } = await pgQuery<any>(
        `insert into public.label_templates
           (id, user_id, name, kind, "group", preview_data_url, updated_at)
         values
           ($7, $1, $2, $3, $4::jsonb, $5, $6)
         returning id, user_id, name, kind, "group", preview_data_url, created_at, updated_at`,
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
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
