import type { H3Event } from 'h3'

const isSecureRequest = (event: H3Event): boolean => {
  const [rawForwardedProto = ''] = String(getHeader(event, 'x-forwarded-proto') || '').split(',')
  const forwardedProto = rawForwardedProto.trim().toLowerCase()

  if (forwardedProto === 'https') return true
  if (forwardedProto === 'http') return false

  const encrypted = (event.node.req.socket as { encrypted?: boolean } | undefined)?.encrypted
  if (encrypted) return true

  return !import.meta.dev
}

const getBuilderCookieBase = (event: H3Event, expiresIn: number) => {
  const secure = isSecureRequest(event)

  return {
    path: '/',
    maxAge: expiresIn,
    sameSite: secure ? 'none' as const : 'lax' as const,
    secure,
  }
}

export const setBuilderAuthCookies = (event: H3Event, token: string, expiresIn: number) => {
  const base = getBuilderCookieBase(event, expiresIn)

  setCookie(event, 'builder-access-token', token, {
    ...base,
    httpOnly: true,
  })

  setCookie(event, 'builder-authenticated', 'true', {
    ...base,
    httpOnly: false,
  })
}
