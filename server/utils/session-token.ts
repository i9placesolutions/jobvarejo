import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import type { UserRole } from '~/types/auth'

export interface SessionTokenPayload {
  sub: string
  email: string
  role: UserRole
  iat: number
  exp: number
}

const TOKEN_ISSUER = 'jobvarejo'

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

export const createSessionToken = (params: {
  userId: string
  email: string
  role: UserRole
}): { token: string; expiresIn: number; payload: SessionTokenPayload } => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresIn = getTokenTtlSeconds()
  const payload: SessionTokenPayload = {
    sub: params.userId,
    email: params.email,
    role: params.role,
    iat: nowSeconds,
    exp: nowSeconds + expiresIn
  }

  const headerEncoded = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT', iss: TOKEN_ISSUER }))
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload))
  const signature = signMessage(`${headerEncoded}.${payloadEncoded}`)
  const token = `${headerEncoded}.${payloadEncoded}.${signature}`

  return { token, expiresIn, payload }
}

export const verifySessionToken = (token: string): SessionTokenPayload | null => {
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

    const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as SessionTokenPayload
    if (!payload?.sub || !payload?.exp || !payload?.iat || !payload?.email || !payload?.role) return null
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (payload.exp <= nowSeconds) return null
    return payload
  } catch {
    return null
  }
}

export const createPasswordResetToken = (): string => randomBytes(32).toString('hex')

export const hashOpaqueToken = (token: string): string =>
  createHash('sha256').update(String(token || '')).digest('hex')
