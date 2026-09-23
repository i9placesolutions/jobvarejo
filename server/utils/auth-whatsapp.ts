import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { pgOneOrNull, pgQuery, pgTx } from './postgres'

export type WhatsAppChallengePurpose = 'register' | 'link' | 'password_reset'

export const WHATSAPP_CODE_TTL_SECONDS = 10 * 60
export const WHATSAPP_CODE_MAX_ATTEMPTS = 5

type WhatsAppChallengeRow = {
  phone_e164: string
  purpose: WhatsAppChallengePurpose
  user_id: string | null
  code_hash: string
  attempts: number
}

let challengeSchemaReady = false

export const ensureWhatsAppChallengeSchema = async (): Promise<void> => {
  if (challengeSchemaReady) return

  await pgTx(async (client) => {
    await client.query('select pg_advisory_xact_lock(821345, 223475)')
    await client.query(`
      create table if not exists public.auth_whatsapp_challenges (
        phone_e164 text not null,
        purpose text not null,
        user_id uuid references public.profiles(id) on delete cascade,
        code_hash text not null,
        attempts smallint not null default 0 check (attempts >= 0 and attempts <= ${WHATSAPP_CODE_MAX_ATTEMPTS}),
        expires_at timestamptz not null,
        last_sent_at timestamptz not null default timezone('utc', now()),
        consumed_at timestamptz,
        created_at timestamptz not null default timezone('utc', now()),
        primary key (phone_e164, purpose)
      )
    `)

    await client.query(`
      alter table public.auth_whatsapp_challenges
        drop constraint if exists auth_whatsapp_challenges_purpose_check
    `)
    await client.query(`
      alter table public.auth_whatsapp_challenges
        add constraint auth_whatsapp_challenges_purpose_check
        check (purpose in ('register', 'link', 'password_reset'))
    `)
    await client.query(`
      create index if not exists idx_auth_whatsapp_challenges_expiry
        on public.auth_whatsapp_challenges (expires_at)
    `)
  })

  challengeSchemaReady = true
}

const getOtpSecret = (): string => {
  const config = useRuntimeConfig()
  const secret = String((config as any).authJwtSecret || process.env.AUTH_JWT_SECRET || '').trim()
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'Missing AUTH_JWT_SECRET runtime configuration' })
  }
  return secret
}

export const hashWhatsAppCode = (
  secret: string,
  phone: string,
  purpose: WhatsAppChallengePurpose,
  code: string
): string => createHmac('sha256', secret)
  .update(`jobvarejo:whatsapp:${purpose}:${phone}:${code}`)
  .digest('hex')

export const issueWhatsAppChallenge = async (params: {
  phone: string
  purpose: WhatsAppChallengePurpose
  userId?: string | null
}): Promise<string> => {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const codeHash = hashWhatsAppCode(getOtpSecret(), params.phone, params.purpose, code)
  const userId = params.userId || null

  await pgQuery(`
    delete from public.auth_whatsapp_challenges
     where expires_at < timezone('utc', now()) - interval '24 hours'
       and created_at < timezone('utc', now()) - interval '24 hours'
  `)

  const issued = await pgOneOrNull<{ phone_e164: string }>(
    `insert into public.auth_whatsapp_challenges
       (phone_e164, purpose, user_id, code_hash, attempts, expires_at, last_sent_at, consumed_at, created_at)
     values
       ($1, $2, $3::uuid, $4, 0,
        timezone('utc', now()) + interval '${WHATSAPP_CODE_TTL_SECONDS} seconds',
        timezone('utc', now()), null, timezone('utc', now()))
     on conflict (phone_e164, purpose) do update
       set user_id = excluded.user_id,
           code_hash = excluded.code_hash,
           attempts = 0,
           expires_at = timezone('utc', now()) + interval '${WHATSAPP_CODE_TTL_SECONDS} seconds',
           last_sent_at = timezone('utc', now()),
           consumed_at = null,
           created_at = timezone('utc', now())
     where auth_whatsapp_challenges.user_id is not distinct from excluded.user_id
         or auth_whatsapp_challenges.expires_at <= timezone('utc', now())
         or auth_whatsapp_challenges.consumed_at is not null
     returning phone_e164`,
    [params.phone, params.purpose, userId, codeHash]
  )

  if (!issued) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Há uma confirmação em andamento para este WhatsApp.'
    })
  }

  return code
}

export const consumeWhatsAppChallenge = async (params: {
  phone: string
  purpose: WhatsAppChallengePurpose
  code: unknown
  userId?: string | null
}): Promise<boolean> => {
  const suppliedCode = String(params.code ?? '').trim()
  const codeHasValidFormat = /^\d{6}$/.test(suppliedCode)
  const secret = getOtpSecret()
  const challenge = await pgOneOrNull<WhatsAppChallengeRow>(
    `select phone_e164, purpose, user_id, code_hash, attempts
       from public.auth_whatsapp_challenges
      where phone_e164 = $1
        and purpose = $2
        and expires_at > timezone('utc', now())
        and consumed_at is null
        and attempts < $3
      limit 1`,
    [params.phone, params.purpose, WHATSAPP_CODE_MAX_ATTEMPTS]
  )

  const expectedUserId = params.userId || null
  const userMatches = Boolean(challenge) && challenge?.user_id === expectedUserId
  const candidateHash = hashWhatsAppCode(secret, params.phone, params.purpose, codeHasValidFormat ? suppliedCode : 'invalid')
  const expectedHash = String(challenge?.code_hash || '0'.repeat(64))
  const candidate = Buffer.from(candidateHash, 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  const hashMatches = candidate.length === expected.length && timingSafeEqual(candidate, expected)

  if (!challenge || !userMatches || !codeHasValidFormat || !hashMatches) {
    if (challenge && userMatches) {
      await pgQuery(
        `update public.auth_whatsapp_challenges
            set attempts = attempts + 1
          where phone_e164 = $1
            and purpose = $2
            and consumed_at is null
            and expires_at > timezone('utc', now())
            and attempts < $3`,
        [params.phone, params.purpose, WHATSAPP_CODE_MAX_ATTEMPTS]
      )
    }
    return false
  }

  const consumed = await pgOneOrNull<{ phone_e164: string }>(
    `update public.auth_whatsapp_challenges
        set consumed_at = timezone('utc', now())
      where phone_e164 = $1
        and purpose = $2
        and user_id is not distinct from $3::uuid
        and code_hash = $4
        and consumed_at is null
        and expires_at > timezone('utc', now())
        and attempts < $5
      returning phone_e164`,
    [params.phone, params.purpose, expectedUserId, expectedHash, WHATSAPP_CODE_MAX_ATTEMPTS]
  )

  return Boolean(consumed)
}

export const invalidateWhatsAppChallenge = async (params: {
  phone: string
  purpose: WhatsAppChallengePurpose
  code: string
}): Promise<void> => {
  const codeHash = hashWhatsAppCode(getOtpSecret(), params.phone, params.purpose, params.code)
  await pgQuery(
    `update public.auth_whatsapp_challenges
        set consumed_at = timezone('utc', now())
      where phone_e164 = $1
        and purpose = $2
        and code_hash = $3
        and consumed_at is null`,
    [params.phone, params.purpose, codeHash]
  )
}
