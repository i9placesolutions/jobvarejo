import { buildBuilderTemplateOptions, extractBuilderToken, hashBuilderToken, isBuilderFeatureEnabled, normalizeBuilderConfig } from '~/server/utils/builder'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgOneOrNull, pgQuery } from '~/server/utils/postgres'

type BuilderSessionRow = {
  token_id: string
  project_id: string
  project_name: string
  builder_config: any
  canvas_data: any
  status: 'active' | 'revoked' | 'expired'
  expires_at: string | null
  max_submissions: number | null
  submissions_count: number
}

const normalizeText = (value: unknown, maxLen = 180): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

const asIsoOrNull = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const isExpired = (value: unknown): boolean => {
  const date = asIsoOrNull(value)
  if (!date) return false
  return new Date(date).getTime() <= Date.now()
}

export default defineEventHandler(async (event) => {
  if (!isBuilderFeatureEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Builder indisponível no momento' })
  }

  const requesterIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `builder-session-resolve:${requesterIp}`, 100, 60_000)

  const body = (await readBody(event).catch(() => ({}))) as Record<string, any>
  const token = extractBuilderToken(event, body?.token)
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token de builder obrigatório' })
  }

  const tokenHash = hashBuilderToken(token)
  const row = await pgOneOrNull<BuilderSessionRow>(
    `select
      t.id as token_id,
      t.project_id,
      t.status,
      t.expires_at,
      t.max_submissions,
      t.submissions_count,
      p.name as project_name,
      p.builder_config,
      p.canvas_data
     from public.project_builder_tokens t
     join public.projects p on p.id = t.project_id
     where t.token_hash = $1
     limit 1`,
    [tokenHash]
  )

  if (!row?.token_id) {
    throw createError({ statusCode: 404, statusMessage: 'Link inválido ou expirado' })
  }

  if (row.status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'Link não está mais ativo' })
  }

  if (isExpired(row.expires_at)) {
    await pgQuery(
      `update public.project_builder_tokens
       set status = 'expired', updated_at = timezone('utc', now())
       where id = $1
         and status = 'active'`,
      [row.token_id]
    ).catch(() => null)
    throw createError({ statusCode: 403, statusMessage: 'Link expirado' })
  }

  if (
    Number.isFinite(Number(row.max_submissions)) &&
    Number(row.max_submissions) > 0 &&
    Number(row.submissions_count || 0) >= Number(row.max_submissions)
  ) {
    throw createError({ statusCode: 403, statusMessage: 'Limite de envios deste link foi atingido' })
  }

  const config = normalizeBuilderConfig(row.builder_config)
  if (!config.enabled) {
    throw createError({ statusCode: 403, statusMessage: 'Builder não habilitado para este projeto' })
  }
  if (!config.templates.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum template configurado para este builder' })
  }

  const labelTemplateIds = Array.from(
    new Set(config.templates.flatMap((item) => item.labelTemplateIds).filter(Boolean))
  )
  const labelTemplateMap = new Map<string, string>()
  if (labelTemplateIds.length > 0) {
    const { rows } = await pgQuery<{ id: string; name: string }>(
      `select id, name
       from public.label_templates
       where id = any($1::text[])`,
      [labelTemplateIds]
    )
    ;(rows || []).forEach((item) => {
      labelTemplateMap.set(String(item.id), normalizeText(item.name, 120) || String(item.id))
    })
  }

  const templates = buildBuilderTemplateOptions(config.templates, labelTemplateMap)
  const pages = Array.isArray(row.canvas_data) ? row.canvas_data : []
  const templatePages = templates.map((template) => {
    const page = pages.find((item: any) => String(item?.id || '') === template.pageId) || null
    return {
      templateId: template.id,
      pageId: template.pageId,
      zoneId: template.zoneId,
      pageName: normalizeText(page?.name || template.name, 120),
      width: Number(page?.width || 0) || 1080,
      height: Number(page?.height || 0) || 1350,
      canvasData: page?.canvasData || null
    }
  })

  setResponseHeader(event, 'Cache-Control', 'no-store')

  return {
    success: true,
    session: {
      tokenId: row.token_id,
      projectId: row.project_id,
      projectName: normalizeText(row.project_name, 120) || 'Projeto',
      expiresAt: asIsoOrNull(row.expires_at),
      maxSubmissions: row.max_submissions == null ? null : Number(row.max_submissions),
      submissionsCount: Number(row.submissions_count || 0),
      templates,
      allowedFields: config.allowedFields,
      maxProductsPerSubmit: config.maxProductsPerSubmit
    },
    templatePages
  }
})
