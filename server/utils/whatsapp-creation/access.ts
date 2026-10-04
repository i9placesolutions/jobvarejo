import { timingSafeEqual } from 'node:crypto'
import { createError, getHeader, type H3Event } from 'h3'
import type { UserRole } from '~/types/auth'
import { normalizeEditorPermissions } from '~/shared/access-control'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'
import { getBrazilWhatsAppPhoneCandidates } from '~/shared/whatsapp-creation-phone'
import { normalizeBusinessProfile } from '../business-profile'
import { PROFILE_ACTIVE_SQL } from '../account-access'
import { pgQuery } from '../postgres'
import type { AuthenticatedUser } from '../auth'

type WhatsAppProfile = {
  id: string
  email: string
  name: string | null
  role: UserRole
  login_whatsapp: string | null
  login_whatsapp_verified_at: string | null
  is_active: boolean
  editor_permissions: unknown
  business_profile: unknown
}

export type ResolvedWhatsAppAccount = {
  ok: true
  user: AuthenticatedUser
  businessProfile: ReturnType<typeof normalizeBusinessProfile>
  senderPhone: string
}

export type UnlinkedWhatsAppNumber = {
  ok: false
  error: 'unlinked_number'
}

const SERVICE_HEADER = 'x-jobvarejo-service-key'
const MIN_SERVICE_KEY_BYTES = 32

const serviceKeyFromEnvironment = (): string => String(process.env.JOBVAREJO_WHATSAPP_SERVICE_KEY || '').trim()

/** Authenticate the private service caller without minting or modifying a user session. */
export function authenticateWhatsAppService(event: H3Event): void {
  const expectedSecret = serviceKeyFromEnvironment()
  if (Buffer.byteLength(expectedSecret, 'utf8') < MIN_SERVICE_KEY_BYTES) {
    throw createError({ statusCode: 503, statusMessage: 'Autenticação do serviço WhatsApp indisponível.' })
  }

  const suppliedSecret = String(getHeader(event, SERVICE_HEADER) || '')
  const supplied = Buffer.from(suppliedSecret, 'utf8')
  const expected = Buffer.from(expectedSecret, 'utf8')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Autenticação do serviço inválida.' })
  }
}

/** Resolve a verified direct sender to that sender's own active account. */
export async function resolveWhatsAppAccount(phone: unknown): Promise<ResolvedWhatsAppAccount | UnlinkedWhatsAppNumber> {
  const normalizedPhone = normalizeBrazilWhatsApp(phone)
  if (!normalizedPhone) return { ok: false, error: 'unlinked_number' }
  const phoneCandidates = getBrazilWhatsAppPhoneCandidates(normalizedPhone)

  const result = await pgQuery<WhatsAppProfile>(
    `select p.id, p.email, p.name, p.role::text as role,
            p.login_whatsapp, p.login_whatsapp_verified_at,
            (${PROFILE_ACTIVE_SQL}) as is_active,
            coalesce(to_jsonb(p)->'editor_permissions', '{}'::jsonb) as editor_permissions,
            p.business_profile
       from public.profiles p
      where p.login_whatsapp = any($1::text[])
      limit 2`,
    [phoneCandidates]
  )

  if (result.rows.length === 0) return { ok: false, error: 'unlinked_number' }
  if (result.rows.length !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'Vínculo de WhatsApp ambíguo.' })
  }

  const profile = result.rows[0]!
  if (!profile.login_whatsapp_verified_at) return { ok: false, error: 'unlinked_number' }
  if (!profile.is_active) {
    throw createError({ statusCode: 403, statusMessage: 'A conta vinculada ao WhatsApp está indisponível.' })
  }
  // A WhatsApp message has no trusted account selection. Even staff use only
  // their own verified profile; editor remains outside this creation flow.
  if (profile.role === 'editor') {
    throw createError({ statusCode: 403, statusMessage: 'Esta conta não tem permissão para solicitar esta criação pelo WhatsApp.' })
  }

  const user: AuthenticatedUser = {
    id: profile.id,
    actorId: profile.id,
    accountId: profile.id,
    email: profile.email,
    role: profile.role,
    editorPermissions: normalizeEditorPermissions(profile.editor_permissions),
    user_metadata: { name: profile.name, avatar_url: null }
  }

  return {
    ok: true,
    user,
    businessProfile: normalizeBusinessProfile(profile.business_profile),
    senderPhone: normalizedPhone
  }
}
