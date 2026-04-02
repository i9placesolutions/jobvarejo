// Redireciona o usuario para a tela de autorizacao do Canva
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const clientId = process.env.CANVA_CLIENT_ID || ''
  if (!clientId) {
    throw createError({ statusCode: 500, statusMessage: 'CANVA_CLIENT_ID nao configurado' })
  }

  // Gerar PKCE
  const codeVerifier = crypto.randomBytes(64).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  // Salvar code_verifier em cookie seguro para usar no callback
  setCookie(event, 'canva_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: false,
    maxAge: 600, // 10 minutos
    path: '/',
    sameSite: 'lax',
  })

  const redirectUri = process.env.CANVA_OAUTH_REDIRECT_URI
    || `${getRequestURL(event).origin}/api/canva/oauth/callback`

  const scopes = [
    'design:content:read', 'design:content:write', 'design:meta:read',
    'asset:read', 'asset:write', 'profile:read',
    'brandtemplate:meta:read', 'brandtemplate:content:read', 'folder:read',
  ].join(' ')

  const authUrl = new URL('https://www.canva.com/api/oauth/authorize')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  return sendRedirect(event, authUrl.toString())
})
