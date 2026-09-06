import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import {
  resolveProjectCanvasDataReadUrls,
  resolveStorageReadUrl
} from '../utils/project-storage-refs'
import { pgOneOrNull, pgQuery } from '../utils/postgres'
import { ensureProjectTemplateColumn } from '../utils/project-templates'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const getProjectPages = (canvasData: any): any[] => {
  const pages = Array.isArray(canvasData)
    ? canvasData
    : (canvasData && typeof canvasData === 'object' && Array.isArray(canvasData.pages) ? canvasData.pages : [])
  return Array.isArray(pages) ? pages : []
}

const getPageThumbnailRef = (page: any): string | null => {
  const thumb = String(page?.thumbnailUrl || page?.thumbnail_url || '').trim()
  return thumb || null
}

const getPrimaryPageMeta = (canvasData: any): any | null => {
  return getProjectPages(canvasData).find((page) => !!page && typeof page === 'object') || null
}

const getFallbackPageThumbnailRef = (canvasData: any): string | null => {
  for (const page of getProjectPages(canvasData)) {
    const thumb = getPageThumbnailRef(page)
    if (thumb) return thumb
  }
  return null
}

const getProjectPreviewSize = (canvasData: any): { preview_width: number | null; preview_height: number | null } => {
  const page = getPrimaryPageMeta(canvasData)
  const width = Number(page?.width || 0)
  const height = Number(page?.height || 0)
  return {
    preview_width: Number.isFinite(width) && width > 0 ? width : null,
    preview_height: Number.isFinite(height) && height > 0 ? height : null
  }
}

const getProjectTemplateCounts = (canvasData: any, templateConfig?: any): {
  template_page_count: number
  template_model_count: number
  template_format_count: number
} => {
  const pages = getProjectPages(canvasData)
  const configuredModels = Array.isArray(templateConfig?.models)
    ? templateConfig.models.filter((model: any) => String(model?.id || model?.name || '').trim())
    : []
  const configuredFormats = Array.isArray(templateConfig?.formatIds)
    ? templateConfig.formatIds.filter((format: any) => String(format || '').trim())
    : []
  const models = new Set<string>()
  const formats = new Set<string>()
  pages.forEach((page: any) => {
    const modelId = String(page?.templateModelId || '').trim()
    const modelName = String(page?.templateModelName || '').trim()
    const rawName = String(page?.name || '').trim()
    const fallbackModel = rawName.includes(' · ') ? (rawName.split(' · ')[0] || 'legacy-model') : 'legacy-model'
    models.add(modelId || modelName || fallbackModel)

    const formatId = String(page?.templateFormatId || '').trim()
    const formatLabel = String(page?.templateFormatLabel || '').trim()
    const width = Number(page?.width || 0)
    const height = Number(page?.height || 0)
    formats.add(formatId || formatLabel || `${width}x${height}`)
  })
  return {
    template_page_count: pages.length,
    template_model_count: configuredModels.length || models.size,
    template_format_count: configuredFormats.length || formats.size
  }
}

const resolveProjectPreviewUrl = async (project: any, userId: string): Promise<string | null> => {
  // Prefer the current first-page thumbnail. Older projects may still have a
  // stale `preview_url` generated before thumbnail scaling/panning fixes.
  const primaryThumb = await resolveStorageReadUrl(getPageThumbnailRef(getPrimaryPageMeta(project?.canvas_data)), userId)
  if (primaryThumb) return primaryThumb

  const explicitPreview = await resolveStorageReadUrl(project?.preview_url, userId)
  if (explicitPreview) return explicitPreview

  return await resolveStorageReadUrl(getFallbackPageThumbnailRef(project?.canvas_data), userId)
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `projects-get:${user.id}`, 180, 60_000)

  const query = getQuery(event)
  const id = String(query.id || '').trim()
  const templatesOnly = String(query.templates || '').trim() === '1'
  const limitParam = query.limit
  const requestedLimitRaw = Array.isArray(limitParam) ? limitParam[0] : limitParam
  const requestedLimit = Number.parseInt(String(requestedLimitRaw || ''), 10)
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 1000)
    : null

  if (id) {
    if (!isUuid(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
    }

    try {
      await ensureProjectTemplateColumn()
      const row = await pgOneOrNull<any>(
        `select *
         from public.projects
         where id = $1
           and user_id = $2
         limit 1`,
        [id, user.id]
      )
      if (!row) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
      return {
        ...row,
        preview_url: await resolveProjectPreviewUrl(row, user.id),
        ...getProjectPreviewSize(row?.canvas_data),
        ...getProjectTemplateCounts(row?.canvas_data, row?.template_config),
        canvas_data: await resolveProjectCanvasDataReadUrls(row?.canvas_data, user.id)
      }
    } catch (error: any) {
      if (error?.statusCode) throw error
      throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to fetch project' })
    }
  }

  try {
    await ensureProjectTemplateColumn()
    const baseSql = `
      select id, name, created_at, updated_at, preview_url, canvas_data, template_config, folder_id, last_viewed, is_shared, shared_with, is_starred, is_template
      from public.projects
      where user_id = $1
        and coalesce(is_template, false) = $2
      order by updated_at desc
    `
    const params: any[] = [user.id, templatesOnly]
    const sql = safeLimit !== null ? `${baseSql} limit $3` : baseSql
    if (safeLimit !== null) params.push(safeLimit)

    const { rows } = await pgQuery<any>(sql, params)

    return await Promise.all(
      (rows || []).map(async (p: any) => {
        const { canvas_data: _canvasData, ...rest } = p || {}
        return {
          ...rest,
          preview_url: await resolveProjectPreviewUrl(p, user.id),
          ...getProjectPreviewSize(p?.canvas_data),
          ...getProjectTemplateCounts(p?.canvas_data, p?.template_config)
        }
      })
    )
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to list projects' })
  }
})
