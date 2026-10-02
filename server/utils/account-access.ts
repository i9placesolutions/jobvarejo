import { createError } from 'h3'
import { pgTx } from './postgres'
import type { UserRole } from '../../types/auth'

// Usa metadados existentes para funcionar também nos bancos sem is_active.
export const PROFILE_ACTIVE_SQL = `COALESCE((to_jsonb(p)->>'is_active')::boolean, true)
  AND COALESCE(p.business_profile->'adminAccess'->>'blocked', 'false') <> 'true'
  AND COALESCE(p.business_profile->'adminAccess'->>'removedAt', '') = ''`

export const isRemovedAccount = (profile: { business_profile?: unknown }) => Boolean(
  (profile.business_profile as any)?.adminAccess?.removedAt
)

export async function manageAccountAccess(actorId: string, id: string, action: 'block' | 'unblock' | 'remove') {
  return pgTx(async client => {
    const { rows } = await client.query<{ id: string; email: string | null; role: UserRole; business_profile: unknown; has_active: boolean }>(
      `SELECT p.id, p.email, p.role::text AS role, p.business_profile,
              to_jsonb(p) ? 'is_active' AS has_active
         FROM public.profiles p WHERE p.id = $1 FOR UPDATE`, [id]
    )
    const target = rows[0]
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado.' })
    if (target.id === actorId || target.role === 'super_admin') {
      throw createError({ statusCode: 409, statusMessage: 'Não é permitido bloquear ou remover a própria conta ou um super admin.' })
    }
    if (isRemovedAccount(target)) throw createError({ statusCode: 409, statusMessage: 'Este usuário já foi removido.' })
    const active = action === 'unblock'
    const metadata = action === 'remove'
      ? { blocked: true, removedAt: new Date().toISOString(), removedBy: actorId }
      : { blocked: !active, changedAt: new Date().toISOString(), changedBy: actorId }
    const result = await client.query<{ id: string }>(
      `UPDATE public.profiles
          SET business_profile = jsonb_set(COALESCE(business_profile, '{}'::jsonb), '{adminAccess}', $2::jsonb),
              ${target.has_active ? 'is_active = $3,' : ''}
              ${action === 'remove' ? 'password_hash = NULL, reset_token_hash = NULL, reset_token_expires_at = NULL,' : ''}
              updated_at = now()
        WHERE id = $1 RETURNING id`,
      target.has_active ? [id, JSON.stringify(metadata), active] : [id, JSON.stringify(metadata)]
    )
    const builder = await client.query<{ relation: string | null }>("SELECT to_regclass('public.builder_tenants')::text AS relation")
    if (builder.rows[0]?.relation) {
      const normalizedEmail = String(target.email || '').trim().toLowerCase()
      await client.query(
        `UPDATE public.builder_tenants
            SET is_active = $3, updated_at = now()
          WHERE id = $1 OR ($2 <> '' AND lower(btrim(email)) = $2)`,
        [id, normalizedEmail, active]
      )
    }
    return { id: result.rows[0]!.id, is_active: active, removed: action === 'remove' }
  })
}
