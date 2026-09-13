import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import {
  resolveProjectCanvasDataReadUrls,
  resolveStorageReadUrl
} from '../utils/project-storage-refs'
import { pgOneOrNull, pgQuery } from '../utils/postgres'
import { ensureProjectTemplateColumn } from '../utils/project-templates'
import {
  getFlyerTemplateCategory,
  getFlyerTemplateCategoryLabel,
  getFlyerTemplateSubcategory,
  normalizeFlyerTemplateCategory
} from '~/utils/flyerTemplateCategory'

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

const resolveProjectPreviewUrl = async (
  project: any,
  userId: string,
  options: { direct?: boolean } = {}
): Promise<string | null> => {
  // Prefer the current first-page thumbnail. Older projects may still have a
  // stale `preview_url` generated before thumbnail scaling/panning fixes.
  // A listagem resumida devolve um proxy autenticado: assim a resposta dos
  // cards não espera nenhuma assinatura S3. Cada <img> assina e lê direto do
  // Wasabi somente quando o navegador realmente precisar dela.
  const direct = options.direct ?? true
  const primaryThumb = await resolveStorageReadUrl(
    getPageThumbnailRef(getPrimaryPageMeta(project?.canvas_data)),
    userId,
    { direct }
  )
  if (primaryThumb) return primaryThumb

  const explicitPreview = await resolveStorageReadUrl(project?.preview_url, userId, { direct })
  if (explicitPreview) return explicitPreview

  return await resolveStorageReadUrl(getFallbackPageThumbnailRef(project?.canvas_data), userId, { direct })
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `projects-get:${user.id}`, 180, 60_000)

  const query = getQuery(event)
  const id = String(query.id || '').trim()
  const templatesOnly = String(query.templates || '').trim() === '1'
  const summaryOnly = String(query.summary || '').trim() === '1'
  const rawTemplateCategory = Array.isArray(query.category) ? query.category[0] : query.category
  const rawTemplateSubcategory = Array.isArray(query.subcategory) ? query.subcategory[0] : query.subcategory
  const templateCategory = templatesOnly
    ? normalizeFlyerTemplateCategory(rawTemplateCategory)
    : null
  const templateSubcategory = templatesOnly
    ? normalizeFlyerTemplateCategory(rawTemplateSubcategory)
    : null
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
        template_category: getFlyerTemplateCategory(row?.template_config),
        template_subcategory: getFlyerTemplateSubcategory(row?.template_config),
        template_category_label: getFlyerTemplateCategoryLabel(row?.template_config),
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
    const params: any[] = [user.id, templatesOnly]
    const categoryClauses: string[] = []
    if (templateCategory) {
      categoryClauses.push(`and lower(btrim(template_config ->> 'category')) = lower($${params.push(templateCategory)})`)
    }
    if (templateSubcategory) {
      categoryClauses.push(`and lower(btrim(template_config ->> 'subcategory')) = lower($${params.push(templateSubcategory)})`)
    }
    const categoryClause = categoryClauses.length ? `\n        ${categoryClauses.join('\n        ')}` : ''
    // A listagem normal usa apenas metadados das páginas. Remover o canvas
    // inline evita transferir desenhos legados inteiros; o GET por id mantém
    // o conteúdo completo para o editor.
    const fullListSql = `
      select id, name, created_at, updated_at, preview_url,
        (
          select coalesce(jsonb_agg(
            case when jsonb_typeof(page.value) = 'object'
              then page.value - 'canvasData'
              else page.value
            end order by page.ordinality
          ), '[]'::jsonb)
          from jsonb_array_elements(
            case
              when jsonb_typeof(canvas_data) = 'array' then canvas_data
              when jsonb_typeof(canvas_data -> 'pages') = 'array' then canvas_data -> 'pages'
              else '[]'::jsonb
            end
          ) with ordinality as page(value, ordinality)
        ) as canvas_data,
        template_config, folder_id, last_viewed, is_shared, shared_with, is_starred, is_template
      from public.projects
      where user_id = $1
        and coalesce(is_template, false) = $2
        ${categoryClause}
      order by updated_at desc
    `
    // A galeria de modelos não precisa carregar todas as composições e
    // blueprints para montar cada card. Em contas com muitos temas, a query
    // anterior agregava cada página e transferia centenas de KB antes de o
    // navegador receber a primeira miniatura.
    const summaryListSql = `
      select
        project.id,
        project.name,
        project.created_at,
        project.updated_at,
        project.preview_url,
        project.is_template,
        jsonb_build_object(
          'category', project.template_config -> 'category',
          'subcategory', project.template_config -> 'subcategory'
        ) as template_config,
        nullif(btrim(coalesce(
          first_page.value ->> 'thumbnailUrl',
          first_page.value ->> 'thumbnail_url',
          ''
        )), '') as primary_thumbnail_url,
        nullif(btrim(coalesce(fallback_page.thumbnail_url, '')), '') as fallback_thumbnail_url,
        first_page.value ->> 'width' as preview_width,
        first_page.value ->> 'height' as preview_height,
        page_counts.page_count as template_page_count,
        coalesce(
          nullif(jsonb_array_length(
            case
              when jsonb_typeof(project.template_config -> 'models') = 'array'
                then project.template_config -> 'models'
              else '[]'::jsonb
            end
          ), 0),
          page_counts.model_count
        ) as template_model_count,
        coalesce(
          nullif(jsonb_array_length(
            case
              when jsonb_typeof(project.template_config -> 'formatIds') = 'array'
                then project.template_config -> 'formatIds'
              else '[]'::jsonb
            end
          ), 0),
          page_counts.format_count
        ) as template_format_count
      from public.projects project
      cross join lateral (
        select case
          when jsonb_typeof(project.canvas_data) = 'array' then project.canvas_data
          when jsonb_typeof(project.canvas_data -> 'pages') = 'array' then project.canvas_data -> 'pages'
          else '[]'::jsonb
        end as items
      ) as page_list
      left join lateral (
        select page.value
          from jsonb_array_elements(page_list.items) with ordinality as page(value, ordinality)
         order by page.ordinality
         limit 1
      ) as first_page on true
      left join lateral (
        select nullif(btrim(coalesce(
          page.value ->> 'thumbnailUrl',
          page.value ->> 'thumbnail_url',
          ''
        )), '') as thumbnail_url
          from jsonb_array_elements(page_list.items) as page(value)
         where nullif(btrim(coalesce(
           page.value ->> 'thumbnailUrl',
           page.value ->> 'thumbnail_url',
           ''
         )), '') is not null
         limit 1
      ) as fallback_page on true
      cross join lateral (
        select
          count(*)::int as page_count,
          count(distinct coalesce(
            nullif(btrim(page.value ->> 'templateModelId'), ''),
            nullif(btrim(page.value ->> 'templateModelName'), ''),
            nullif(btrim(split_part(coalesce(page.value ->> 'name', ''), ' · ', 1)), ''),
            'legacy-model'
          ))::int as model_count,
          count(distinct coalesce(
            nullif(btrim(page.value ->> 'templateFormatId'), ''),
            nullif(btrim(page.value ->> 'templateFormatLabel'), ''),
            nullif(concat_ws('x', page.value ->> 'width', page.value ->> 'height'), ''),
            'legacy-format'
          ))::int as format_count
          from jsonb_array_elements(page_list.items) as page(value)
      ) as page_counts
      where project.user_id = $1
        and coalesce(project.is_template, false) = $2
        ${categoryClause}
      order by project.updated_at desc
    `
    const baseSql = summaryOnly ? summaryListSql : fullListSql
    if (safeLimit !== null) params.push(safeLimit)
    const sql = safeLimit !== null ? `${baseSql} limit $${params.length}` : baseSql

    const { rows } = await pgQuery<any>(sql, params)

    return await Promise.all(
      (rows || []).map(async (p: any) => {
        const summaryPageMeta = summaryOnly
          ? [
              {
                thumbnailUrl: p?.primary_thumbnail_url || undefined,
                width: p?.preview_width,
                height: p?.preview_height
              },
              ...(p?.fallback_thumbnail_url && p?.fallback_thumbnail_url !== p?.primary_thumbnail_url
                ? [{ thumbnailUrl: p.fallback_thumbnail_url }]
                : [])
            ]
          : null
        const previewProject = summaryOnly
          ? { canvas_data: summaryPageMeta, preview_url: p?.preview_url }
          : p
        const previewSize = summaryOnly
          ? getProjectPreviewSize(summaryPageMeta)
          : getProjectPreviewSize(p?.canvas_data)
        const templateCounts = summaryOnly
          ? {
              template_page_count: Math.max(0, Number(p?.template_page_count || 0)),
              template_model_count: Math.max(0, Number(p?.template_model_count || 0)),
              template_format_count: Math.max(0, Number(p?.template_format_count || 0))
            }
          : getProjectTemplateCounts(p?.canvas_data, p?.template_config)
        const {
          canvas_data: _canvasData,
          primary_thumbnail_url: _primaryThumbnailUrl,
          fallback_thumbnail_url: _fallbackThumbnailUrl,
          preview_width: _previewWidth,
          preview_height: _previewHeight,
          template_page_count: _templatePageCount,
          template_model_count: _templateModelCount,
          template_format_count: _templateFormatCount,
          ...rest
        } = p || {}
        // A composição do modelo pode ter várias páginas e URLs. A grade de
        // escolha só usa título, categoria, tamanho e thumbnail; não envie a
        // biblioteca inteira até que o usuário abra um modelo.
        const {
          template_config: _templateConfig,
          folder_id: _folderId,
          last_viewed: _lastViewed,
          is_shared: _isShared,
          shared_with: _sharedWith,
          is_starred: _isStarred,
          ...summaryRest
        } = rest
        return {
          ...(summaryOnly ? summaryRest : rest),
          template_category: getFlyerTemplateCategory(p?.template_config),
          template_subcategory: getFlyerTemplateSubcategory(p?.template_config),
          template_category_label: getFlyerTemplateCategoryLabel(p?.template_config),
          preview_url: await resolveProjectPreviewUrl(previewProject, user.id, {
            direct: !summaryOnly
          }),
          ...previewSize,
          ...templateCounts
        }
      })
    )
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to list projects' })
  }
})
