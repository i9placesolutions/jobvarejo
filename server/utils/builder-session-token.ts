import { createHmac, timingSafeEqual } from 'node:crypto'
import type { BuilderTokenPayload } from '~/types/builder'

const TOKEN_ISSUER = 'builder'

const encodeBase64Url = (value: string | Buffer): string =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const decodeBase64Url = (value: string): string => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  const padded = `${normalized}${'='.repeat(padLength)}`
  return Buffer.from(padded, 'base64').toString('utf8')
}

const getAuthSecret = (): string => {
  const config = useRuntimeConfig()
  const raw = String((config as any).authJwtSecret || process.env.AUTH_JWT_SECRET || '').trim()
  if (!raw) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing AUTH_JWT_SECRET runtime configuration'
    })
  }
  return raw
}

const getTokenTtlSeconds = (): number => {
  const config = useRuntimeConfig()
  const raw = Number.parseInt(
    String((config as any).authTokenTtlSeconds || process.env.AUTH_TOKEN_TTL_SECONDS || '604800'),
    10
  )
  if (!Number.isFinite(raw) || raw <= 0) return 604800
  return Math.min(raw, 60 * 60 * 24 * 30)
}

const signMessage = (message: string): string => {
  const secret = getAuthSecret()
  return createHmac('sha256', secret).update(message).digest('base64url')
}

const safeEqualString = (left: string, right: string): boolean => {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const createBuilderSessionToken = (params: {
  tenantId: string
  email: string
  name: string
  isAdmin?: boolean
}): { token: string; expiresIn: number; payload: BuilderTokenPayload } => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresIn = getTokenTtlSeconds()
  const payload: BuilderTokenPayload = {
    sub: params.tenantId,
    email: params.email,
    name: params.name,
    scope: 'builder',
    ...(params.isAdmin ? { isAdmin: true } : {}),
    iat: nowSeconds,
    exp: nowSeconds + expiresIn
  }

  const headerEncoded = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT', iss: TOKEN_ISSUER }))
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload))
  const signature = signMessage(`${headerEncoded}.${payloadEncoded}`)
  const token = `${headerEncoded}.${payloadEncoded}.${signature}`

  return { token, expiresIn, payload }
}

export const verifyBuilderSessionToken = (token: string): BuilderTokenPayload | null => {
  const raw = String(token || '').trim()
  if (!raw) return null

  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [headerEncoded, payloadEncoded, providedSignature] = parts
  if (!headerEncoded || !payloadEncoded || !providedSignature) return null

  const expectedSignature = signMessage(`${headerEncoded}.${payloadEncoded}`)
  if (!safeEqualString(providedSignature, expectedSignature)) return null

  try {
    const header = JSON.parse(decodeBase64Url(headerEncoded)) as Record<string, any>
    if (header?.alg !== 'HS256') return null
    if (header?.typ !== 'JWT') return null
    if (String(header?.iss || '') !== TOKEN_ISSUER) return null

    const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as BuilderTokenPayload
    if (!payload?.sub || !payload?.exp || !payload?.iat || !payload?.email || !payload?.name) return null
    if (payload?.scope !== 'builder') return null
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (payload.exp <= nowSeconds) return null
    return payload
  } catch {
    return null
  }
}
