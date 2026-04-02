import { buildCanvaAuthorizeUrl, createCanvaOAuthSession } from '../../../../server/utils/canva-oauth-session'
import { requireAdminUser } from '../../../../server/utils/auth'

const normalizeRedirectUri = (value: string): string | null => {
  const raw = String(value || '').trim()
  if (!raw) return null

  try {
    const parsed = new URL(raw)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}

const getFirstHeaderValue = (event: any, name: string): string => {
  return String(getHeader(event, name) || '')
    .split(',')
    .map(part => part.trim())
    .find(Boolean) || ''
}

const resolveCanvaRedirectUri = (event: any): string => {
  const config = useRuntimeConfig()
  const configured = normalizeRedirectUri(
    String((config as any).canvaOauthRedirectUri || process.env.CANVA_OAUTH_REDIRECT_URI || '')
  )
  if (configured) {
    return configured
  }

  const forwardedHost = getFirstHeaderValue(event, 'x-forwarded-host')
  const forwardedProto = getFirstHeaderValue(event, 'x-forwarded-proto')
  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    return `${proto}://${forwardedHost}/api/canva/oauth/callback`
  }

  const host = getFirstHeaderValue(event, 'host')
  if (host) {
    const proto = forwardedProto || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}/api/canva/oauth/callback`
  }

  return `${getRequestURL(event).origin}/api/canva/oauth/callback`
}

export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const config = useRuntimeConfig()
  const clientId = String(config.canvaClientId || process.env.CANVA_CLIENT_ID || '').trim()

  if (!clientId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CANVA_CLIENT_ID nao configurado.',
    })
  }

  const redirectUri = resolveCanvaRedirectUri(event)
  const session = createCanvaOAuthSession(redirectUri)
  const authUrl = buildCanvaAuthorizeUrl({
    clientId,
    redirectUri,
    state: session.state,
    codeVerifier: session.codeVerifier,
  })

  console.info('[canva/oauth/start]', {
    redirectUri,
    host: getFirstHeaderValue(event, 'host') || null,
    forwardedHost: getFirstHeaderValue(event, 'x-forwarded-host') || null,
    forwardedProto: getFirstHeaderValue(event, 'x-forwarded-proto') || null,
  })

  return sendRedirect(event, authUrl, 302)
})
