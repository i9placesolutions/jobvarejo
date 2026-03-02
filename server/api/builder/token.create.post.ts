import { createBuilderToken, hashBuilderToken, isBuilderFeatureEnabled, normalizeBuilderConfig } from '~/server/utils/builder'
import { requireAdminUser } from '~/server/utils/auth'
import { pgOneOrNull, pgQuery } from '~/server/utils/postgres'
import { enforceRateLimit } from '~/server/utils/rate-limit'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const normalizeText = (value: unknown, maxLen = 120): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

const toIsoOrNull = (value: unknown): string | null => {
  if (value == null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'expiresAt inválido' })
  }
  return parsed.toISOString()
}

const toMaxSubmissionsOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 1 || n > 5000) {
    throw createError({ statusCode: 400, statusMessage: 'maxSubmissions inválido (1-5000)' })
  }
  return n
}

export default defineEventHandler(async (event) => {
  if (!isBuilderFeatureEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Builder indisponível no momento' })
  }

  const { user, role } = await requireAdminUser(event)
  enforceRateLimit(event, `builder-token-create:${user.id}`, 80, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const projectId = normalizeText(body?.projectId, 80)
  if (!projectId || !isUuid(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'projectId inválido' })
  }

  const project = await pgOneOrNull<{ id: string; user_id: string | null; builder_config: any; name: string }>(
    `select id, user_id, builder_config, name
     from public.projects
     where id = $1
     limit 1`,
    [projectId]
  )
  if (!project?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Projeto não encontrado' })
  }

  if (role !== 'super_admin' && String(project.user_id || '') !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Sem permissão para gerar link deste projeto' })
  }

  const config = normalizeBuilderConfig(project.builder_config)
  if (!config.enabled) {
    throw createError({ statusCode: 400, statusMessage: 'builder_config.enabled está desabilitado neste projeto' })
  }
  if (!config.templates.length) {
    throw createError({ statusCode: 400, statusMessage: 'Configure ao menos 1 template em builder_config.templates' })
  }

  const expiresAt = toIsoOrNull(body?.expiresAt)
  const maxSubmissions = toMaxSubmissionsOrNull(body?.maxSubmissions)
  const rawToken = createBuilderToken()
  const tokenHash = hashBuilderToken(rawToken)

  const inserted = await pgOneOrNull<{ id: string }>(
    `insert into public.project_builder_tokens
       (project_id, token_hash, expires_at, max_submissions, created_by)
     values
       ($1, $2, $3::timestamptz, $4::int, $5::uuid)
     returning id`,
    [projectId, tokenHash, expiresAt, maxSubmissions, user.id]
  )
  if (!inserted?.id) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar token de builder' })
  }

  const configRuntime = useRuntimeConfig()
  const appBaseUrl = normalizeText((configRuntime as any)?.appBaseUrl || process.env.APP_BASE_URL, 300)
  const publicUrl = appBaseUrl
    ? `${appBaseUrl.replace(/\/+$/, '')}/builder-v2/${rawToken}`
    : `/builder-v2/${rawToken}`

  await pgQuery(
    `update public.project_builder_tokens
     set updated_at = timezone('utc', now())
     where id = $1`,
    [inserted.id]
  ).catch(() => null)

  return {
    success: true,
    token: rawToken,
    tokenId: inserted.id,
    projectId,
    projectName: normalizeText(project.name, 120) || 'Projeto',
    expiresAt,
    maxSubmissions,
    url: publicUrl
  }
})
