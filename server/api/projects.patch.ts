import { requireAuthenticatedUser } from '../utils/auth'
import { parseAndStringifyJsonbParam } from '../utils/jsonb'
import {
  normalizeProjectCanvasDataStorageRefs,
  normalizeStoredStorageRef,
  stripInlineCanvasDataFromProjectCanvasData
} from '../utils/project-storage-refs'
import { publishProjectChange } from '../utils/project-realtime'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'
import { ensureProjectTemplateColumn } from '../utils/project-templates'
import { doesProjectPatchChangeContent } from '../../utils/projectEditedAt'
import {
  normalizeFlyerTemplateCategory,
  normalizeFlyerTemplateConfigCategory
} from '~/utils/flyerTemplateCategory'
import {
  hasSingleFlyerTemplateModel,
  renameFlyerTemplateModelInPlace
} from '~/utils/flyerTemplateNaming'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toIsoOrNull = (value: unknown): string | null => {
  if (value == null || value === '') return null
  const asString = String(value).trim()
  if (!asString) return null
  const date = new Date(asString)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const parseSharedWith = (value: unknown): string[] => {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'shared_with must be an array' })
  }
  const parsed = value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  if (parsed.some((item) => !isUuid(item))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid shared_with UUID format' })
  }
  return parsed
}

const ensureCanvasDataNotEmpty = (value: unknown) => {
  if (Array.isArray(value) && value.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'canvas_data cannot be an empty array' })
  }
}

const getProjectPages = (canvasData: any): any[] => {
  if (Array.isArray(canvasData)) return canvasData
  if (canvasData && typeof canvasData === 'object' && Array.isArray(canvasData.pages)) {
    return canvasData.pages
  }
  return []
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `projects-patch:${user.id}`, 180, 60_000)
  const actorClientId = String(getHeader(event, 'x-client-id') || '').trim() || null

  const body = await readBody<Record<string, any>>(event)
  const changesProjectContent = doesProjectPatchChangeContent(body)
  const projectId = String(body?.id || '').trim()
  if (!projectId || !isUuid(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
  }
  if ('template_config' in body && 'template_category' in body) {
    throw createError({ statusCode: 400, statusMessage: 'Atualize a configuração ou a categoria do modelo, não ambos no mesmo pedido.' })
  }

  const updates: string[] = []
  const params: any[] = []
  const pushParam = (value: any) => {
    params.push(value)
    return `$${params.length}`
  }
  let synchronizedTemplateCanvasData: any | undefined
  let synchronizedTemplateConfig: any | undefined

  if ('name' in body) {
    const name = String(body?.name || '').trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Project name required' })
    if (name.length > 120) throw createError({ statusCode: 400, statusMessage: 'Project name too long (max 120 chars)' })
    updates.push(`name = ${pushParam(name)}`)

    // The dashboard renames a project with only its name field. For a
    // single-model flyer template, keep the page/model label in sync at the
    // same time so a duplicated template no longer keeps the source title.
    if (!('canvas_data' in body) && !('template_config' in body) && !('template_category' in body)) {
      await ensureProjectTemplateColumn()
      const current = await pgOneOrNull<any>(
        `select canvas_data, template_config, is_template
           from public.projects
          where id = $1
            and user_id = $2
          limit 1`,
        [projectId, user.id]
      )
      if (!current) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
      if (current.is_template === true) {
        const canvasData = cloneJson(current.canvas_data)
        const templateConfig = current.template_config && typeof current.template_config === 'object'
          ? cloneJson(current.template_config)
          : null
        const pages = getProjectPages(canvasData)
        if (hasSingleFlyerTemplateModel(pages) &&
            renameFlyerTemplateModelInPlace(pages, pages[0], name, templateConfig)) {
          synchronizedTemplateCanvasData = canvasData
          if (templateConfig) synchronizedTemplateConfig = templateConfig
        }
      }
    }
  }

  if ('preview_url' in body) {
    const previewUrl = normalizeStoredStorageRef(body?.preview_url)
    if (previewUrl && previewUrl.length > 2048) {
      throw createError({ statusCode: 400, statusMessage: 'preview_url too long' })
    }
    updates.push(`preview_url = ${pushParam(previewUrl)}`)
  }

  if ('folder_id' in body) {
    const folderIdRaw = body?.folder_id
    const folderId = folderIdRaw == null || folderIdRaw === '' ? null : String(folderIdRaw).trim()
    if (folderId && !isUuid(folderId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid folder_id format' })
    }
    updates.push(`folder_id = ${pushParam(folderId)}::uuid`)
  }

  if ('last_viewed' in body) {
    const lastViewed = toIsoOrNull(body?.last_viewed)
    if (body?.last_viewed != null && !lastViewed) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid last_viewed date format' })
    }
    updates.push(`last_viewed = ${pushParam(lastViewed)}::timestamptz`)
  }

  if ('is_starred' in body) {
    updates.push(`is_starred = ${pushParam(Boolean(body?.is_starred))}`)
  }

  if ('is_shared' in body) {
    updates.push(`is_shared = ${pushParam(Boolean(body?.is_shared))}`)
  }

  if ('shared_with' in body) {
    const sharedWith = parseSharedWith(body?.shared_with)
    updates.push(`shared_with = ${pushParam(sharedWith)}::uuid[]`)
  }

  if ('is_template' in body) {
    updates.push(`is_template = ${pushParam(Boolean(body?.is_template))}`)
  }

  if ('template_config' in body) {
    const templateConfig = body?.template_config == null
      ? null
      : parseAndStringifyJsonbParam(
          normalizeFlyerTemplateConfigCategory(body.template_config),
          'template_config'
        )
    updates.push(`template_config = ${pushParam(templateConfig)}::jsonb`)
  } else if (synchronizedTemplateConfig !== undefined) {
    updates.push(`template_config = ${pushParam(parseAndStringifyJsonbParam(synchronizedTemplateConfig, 'template_config'))}::jsonb`)
  }

  if ('template_category' in body) {
    const templateCategory = normalizeFlyerTemplateCategory(body?.template_category)
    if (templateCategory) {
      updates.push(
        `template_config = jsonb_set(
          coalesce(template_config, '{}'::jsonb),
          '{category}',
          to_jsonb(${pushParam(templateCategory)}::text),
          true
        )`
      )
    } else {
      updates.push(`template_config = coalesce(template_config, '{}'::jsonb) - 'category'`)
    }
  }

  if ('canvas_data' in body) {
    if (body?.canvas_data == null) {
      throw createError({ statusCode: 400, statusMessage: 'canvas_data cannot be empty' })
    }
    ensureCanvasDataNotEmpty(body.canvas_data)
    const normalizedCanvasData = stripInlineCanvasDataFromProjectCanvasData(
      normalizeProjectCanvasDataStorageRefs(body.canvas_data)
    )
    const canvasDataJson = parseAndStringifyJsonbParam(normalizedCanvasData, 'canvas_data')
    updates.push(`canvas_data = ${pushParam(canvasDataJson)}::jsonb`)
  } else if (synchronizedTemplateCanvasData !== undefined) {
    updates.push(`canvas_data = ${pushParam(parseAndStringifyJsonbParam(synchronizedTemplateCanvasData, 'canvas_data'))}::jsonb`)
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  if (changesProjectContent) {
    updates.push(`updated_at = timezone('utc', now())`)
  }

  const idPlaceholder = pushParam(projectId)
  const userPlaceholder = pushParam(user.id)

  try {
    await ensureProjectTemplateColumn()
    const row = await pgOneOrNull<any>(
      `update public.projects
       set ${updates.join(', ')}
       where id = ${idPlaceholder}
         and user_id = ${userPlaceholder}
       returning *`,
      params
    )
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    try {
      await publishProjectChange({
        projectId: String(row.id || projectId),
        userId: user.id,
        action: 'updated',
        updatedAt: String(row.updated_at || new Date().toISOString()),
        actorClientId
      })
    } catch (notifyErr) {
      console.warn('[api/projects:patch] Failed to publish realtime notification:', notifyErr)
    }

    return { success: true, project: row }
  } catch (error: any) {
    if (error?.statusCode) throw error
    const message = String(error?.message || error?.detail || error?.hint || '').trim() || 'Failed to update project'
    console.error('[api/projects:patch] Update failed', {
      code: error?.code || null,
      message,
      detail: error?.detail || null,
      hint: error?.hint || null,
      constraint: error?.constraint || null
    })
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
