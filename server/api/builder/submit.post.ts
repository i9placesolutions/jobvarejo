import type { BuilderProductInput, BuilderSubmissionPayload } from '~/types/builder'
import { applyBuilderSubmissionToCanvasPage } from '~/server/utils/builder-canvas'
import {
  BUILDER_DEFAULT_ALLOWED_FIELDS,
  extractBuilderToken,
  hashBuilderToken,
  isBuilderFeatureEnabled,
  normalizeBuilderConfig,
  sanitizeBuilderProduct
} from '~/server/utils/builder'
import { stringifyJsonbParam } from '~/server/utils/jsonb'
import { pgTx } from '~/server/utils/postgres'
import { enforceRateLimit } from '~/server/utils/rate-limit'

type BuilderSubmitRow = {
  token_id: string
  project_id: string
  status: 'active' | 'revoked' | 'expired'
  expires_at: string | null
  max_submissions: number | null
  submissions_count: number
  builder_config: any
  canvas_data: any
}

const normalizeText = (value: unknown, maxLen = 240): string => {
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

const validateNoBlockedFields = (
  products: BuilderProductInput[],
  allowedFields: string[]
) => {
  const allowed = new Set([...allowedFields, 'id'])
  for (const product of products) {
    const keys = Object.keys(product || {})
    const invalid = keys.find((key) => !allowed.has(key))
    if (invalid) {
      throw createError({
        statusCode: 400,
        statusMessage: `Campo não permitido no payload: ${invalid}`
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  if (!isBuilderFeatureEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Builder indisponível no momento' })
  }

  const requesterIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `builder-submit:${requesterIp}`, 60, 60_000)

  const body = (await readBody(event).catch(() => ({}))) as Record<string, any>
  const token = extractBuilderToken(event, body?.token)
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token de builder obrigatório' })
  }

  const payload = (body?.payload || body) as BuilderSubmissionPayload
  const templateId = normalizeText(payload?.templateId, 120)
  if (!templateId) {
    throw createError({ statusCode: 400, statusMessage: 'templateId é obrigatório' })
  }

  const rawProducts = Array.isArray(payload?.products) ? payload.products : []
  if (!rawProducts.length) {
    throw createError({ statusCode: 400, statusMessage: 'Envie ao menos 1 produto' })
  }

  const tokenHash = hashBuilderToken(token)

  const response = await pgTx(async (client) => {
    const locked = await client.query<BuilderSubmitRow>(
      `select
         t.id as token_id,
         t.project_id,
         t.status,
         t.expires_at,
         t.max_submissions,
         t.submissions_count,
         p.builder_config,
         p.canvas_data
       from public.project_builder_tokens t
       join public.projects p on p.id = t.project_id
       where t.token_hash = $1
       for update of t, p`,
      [tokenHash]
    )
    const row = locked.rows[0]
    if (!row?.token_id) {
      throw createError({ statusCode: 404, statusMessage: 'Link inválido ou expirado' })
    }
    if (row.status !== 'active') {
      throw createError({ statusCode: 403, statusMessage: 'Link não está mais ativo' })
    }
    if (isExpired(row.expires_at)) {
      await client.query(
        `update public.project_builder_tokens
         set status = 'expired', updated_at = timezone('utc', now())
         where id = $1
           and status = 'active'`,
        [row.token_id]
      )
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
    const template = config.templates.find((item) => item.id === templateId)
    if (!template) {
      throw createError({ statusCode: 400, statusMessage: 'Template não permitido para este link' })
    }

    if (rawProducts.length > config.maxProductsPerSubmit) {
      throw createError({
        statusCode: 400,
        statusMessage: `Máximo de ${config.maxProductsPerSubmit} produtos por envio`
      })
    }

    const allowedFields = config.allowedFields.length > 0
      ? config.allowedFields
      : BUILDER_DEFAULT_ALLOWED_FIELDS
    validateNoBlockedFields(rawProducts, allowedFields)

    const themeId = normalizeText(payload?.themeId, 120) || null
    const labelTemplateId = normalizeText(payload?.labelTemplateId, 120) || null
    if (themeId && !template.themeIds.includes(themeId)) {
      throw createError({ statusCode: 400, statusMessage: 'Tema não permitido para este template' })
    }
    if (labelTemplateId && !template.labelTemplateIds.includes(labelTemplateId)) {
      throw createError({ statusCode: 400, statusMessage: 'Etiqueta não permitida para este template' })
    }

    const sanitizedProducts = rawProducts.map((product) =>
      sanitizeBuilderProduct((product || {}) as BuilderProductInput, allowedFields)
    )
    const pages = Array.isArray(row.canvas_data) ? [...row.canvas_data] : []
    const pageIndex = pages.findIndex((page: any) => String(page?.id || '') === template.pageId)
    if (pageIndex < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Página do template não encontrada no projeto' })
    }

    const pageMeta = pages[pageIndex] || {}
    const canvasData = pageMeta?.canvasData
    if (!canvasData || typeof canvasData !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Template sem canvas_data válido. Abra o editor interno e salve novamente.'
      })
    }

    const result = applyBuilderSubmissionToCanvasPage({
      pageCanvasData: canvasData,
      template,
      products: sanitizedProducts,
      allowedFields,
      themeId,
      labelTemplateId
    })

    pages[pageIndex] = {
      ...pageMeta,
      canvasData: result.pageCanvasData
    }

    await client.query(
      `update public.projects
       set canvas_data = $1::jsonb,
           updated_at = timezone('utc', now())
       where id = $2`,
      [stringifyJsonbParam(pages), row.project_id]
    )

    const payloadSummary = {
      templateId,
      themeId,
      labelTemplateId,
      productsReceived: sanitizedProducts.length,
      cardsFound: result.stats.cardsFound,
      productsApplied: result.stats.productsApplied,
      productsIgnored: result.stats.productsIgnored
    }

    await client.query(
      `insert into public.project_builder_submissions
         (project_id, token_id, template_id, payload_summary, ip, user_agent)
       values
         ($1, $2, $3, $4::jsonb, $5::inet, $6)`,
      [
        row.project_id,
        row.token_id,
        templateId,
        stringifyJsonbParam(payloadSummary),
        requesterIp === 'unknown' ? null : requesterIp,
        normalizeText(getHeader(event, 'user-agent'), 1000) || null
      ]
    )

    const tokenUpdate = await client.query<{ submissions_count: number }>(
      `update public.project_builder_tokens
       set submissions_count = submissions_count + 1,
           updated_at = timezone('utc', now())
       where id = $1
       returning submissions_count`,
      [row.token_id]
    )

    return {
      success: true,
      projectId: row.project_id,
      templateId,
      stats: result.stats,
      submissionsCount: Number(tokenUpdate.rows?.[0]?.submissions_count || (row.submissions_count + 1))
    }
  })

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return response
})
