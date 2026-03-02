import { hashBuilderToken, isBuilderFeatureEnabled } from '~/server/utils/builder'
import { requireAdminUser } from '~/server/utils/auth'
import { pgOneOrNull } from '~/server/utils/postgres'
import { enforceRateLimit } from '~/server/utils/rate-limit'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const normalizeText = (value: unknown, maxLen = 240): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

type TokenOwnershipRow = {
  id: string
  status: 'active' | 'revoked' | 'expired'
  project_id: string
  project_owner_id: string | null
}

export default defineEventHandler(async (event) => {
  if (!isBuilderFeatureEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Builder indisponível no momento' })
  }

  const { user, role } = await requireAdminUser(event)
  enforceRateLimit(event, `builder-token-revoke:${user.id}`, 120, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const tokenId = normalizeText(body?.tokenId, 80)
  const rawToken = normalizeText(body?.token, 512)

  if (!tokenId && !rawToken) {
    throw createError({ statusCode: 400, statusMessage: 'Informe tokenId ou token para revogar' })
  }
  if (tokenId && !isUuid(tokenId)) {
    throw createError({ statusCode: 400, statusMessage: 'tokenId inválido' })
  }

  const whereSql = tokenId ? 't.id = $1' : 't.token_hash = $1'
  const whereParam = tokenId || hashBuilderToken(rawToken)
  const row = await pgOneOrNull<TokenOwnershipRow>(
    `select
       t.id,
       t.status,
       t.project_id,
       p.user_id as project_owner_id
     from public.project_builder_tokens t
     join public.projects p on p.id = t.project_id
     where ${whereSql}
     limit 1`,
    [whereParam]
  )

  if (!row?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Token não encontrado' })
  }
  if (role !== 'super_admin' && String(row.project_owner_id || '') !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Sem permissão para revogar este token' })
  }
  if (row.status === 'revoked') {
    return { success: true, tokenId: row.id, status: 'revoked' as const }
  }

  const updated = await pgOneOrNull<{ id: string; status: 'active' | 'revoked' | 'expired' }>(
    `update public.project_builder_tokens
     set status = 'revoked',
         updated_at = timezone('utc', now())
     where id = $1
     returning id, status`,
    [row.id]
  )

  if (!updated?.id) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao revogar token' })
  }

  return {
    success: true,
    tokenId: updated.id,
    status: updated.status
  }
})
