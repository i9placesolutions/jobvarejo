import type { H3Event } from 'h3'

type AuthCookieOptions = {
  path: '/'
  maxAge: number
  sameSite: 'lax' | 'none'
  secure: boolean
}

const getRequestHost = (event: H3Event): string => {
  const rawHost = String(getHeader(event, 'host') || '').trim().toLowerCase()
  if (rawHost.startsWith('[')) {
    const closingBracket = rawHost.indexOf(']')
    return closingBracket > 0 ? rawHost.slice(1, closingBracket) : rawHost
  }
  return rawHost.split(':')[0] || ''
}

/**
 * Use Secure only when the browser really reaches the app over HTTPS.
 * Nuxt preview runs with NODE_ENV=production, but is commonly opened over
 * http://127.0.0.1; a Secure cookie is then silently omitted by the browser.
 */
export const isSecureRequest = (event: H3Event): boolean => {
  const [rawForwardedProto = ''] = String(getHeader(event, 'x-forwarded-proto') || '').split(',')
  const forwardedProto = rawForwardedProto.trim().toLowerCase()

  if (forwardedProto === 'https') return true
  if (forwardedProto === 'http') return false

  const encrypted = (event.node.req.socket as { encrypted?: boolean } | undefined)?.encrypted
  if (encrypted) return true

  const host = getRequestHost(event)
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.startsWith('127.')) {
    return false
  }

  return process.env.NODE_ENV === 'production'
}

export const getAuthCookieOptions = (event: H3Event, maxAge: number): AuthCookieOptions => {
  const secure = isSecureRequest(event)
  const host = getRequestHost(event)
  const isTunnel = host.endsWith('.devtunnels.ms') || host === 'devtunnels.ms'

  return {
    path: '/',
    maxAge,
    sameSite: secure && isTunnel ? 'none' : 'lax',
    secure,
  }
}
