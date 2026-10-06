import { pgOneOrNull } from '../postgres'
import { ensureBusinessProfileColumn, mergeBusinessProfile } from '../business-profile'

/**
 * Atualiza WhatsApp e/ou endereço do cadastro da loja a pedido do cliente (depois da confirmação na
 * conversa). Usa o mesmo merge do painel (PUT /api/profile) e preserva logoPreference, internalOnly e
 * adminAccess; só o dono da conta é alterado.
 */
export async function updateBusinessContact(userId: string, patch: { whatsapp?: string; address?: string }): Promise<void> {
  const incoming: Record<string, string> = {}
  if (patch.whatsapp?.trim()) incoming.whatsapp = patch.whatsapp.trim().slice(0, 80)
  if (patch.address?.trim()) incoming.address = patch.address.trim().slice(0, 300)
  if (!Object.keys(incoming).length) return
  await ensureBusinessProfileColumn()
  const current = await pgOneOrNull<{ business_profile: unknown }>('select business_profile from public.profiles where id = $1 limit 1', [userId])
  if (!current) throw new Error('Perfil não encontrado.')
  const merged = mergeBusinessProfile(current.business_profile, incoming)
  await pgOneOrNull(
    `update public.profiles
        set business_profile = ($1::jsonb - 'logoPreference' - 'internalOnly' - 'adminAccess') ||
            CASE WHEN business_profile ? 'logoPreference'
              THEN jsonb_build_object('logoPreference', business_profile->'logoPreference')
              ELSE '{}'::jsonb END ||
            CASE WHEN business_profile ? 'internalOnly'
              THEN jsonb_build_object('internalOnly', business_profile->'internalOnly')
              ELSE '{}'::jsonb END ||
            CASE WHEN business_profile ? 'adminAccess'
              THEN jsonb_build_object('adminAccess', business_profile->'adminAccess')
              ELSE '{}'::jsonb END,
            updated_at = timezone('utc', now())
      where id = $2
      returning id`,
    [JSON.stringify(merged), userId]
  )
}
