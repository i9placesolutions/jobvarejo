import { clearCanvaOAuthSession, exchangeCanvaAuthorizationCode, readCanvaOAuthSession } from '../../../../server/utils/canva-oauth-session'
import { writeCanvaTokenCache } from '../../../../server/utils/canva-token-cache'

const renderHtml = (title: string, body: string) => `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #0f0f0f; color: #fff; margin: 0; }
      .wrap { max-width: 720px; margin: 48px auto; padding: 24px; }
      .card { background: #18181b; border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 24px; }
      .ok { color: #86efac; }
      .err { color: #fca5a5; }
      code { background: #09090b; padding: 2px 6px; border-radius: 6px; }
      a { color: #c4b5fd; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        ${body}
      </div>
    </div>
  </body>
</html>`

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = String(query.code || '').trim()
  const state = String(query.state || '').trim()
  const error = String(query.error || '').trim()
  const errorDescription = String(query.error_description || '').trim()

  if (error) {
    return renderHtml(
      'Canva OAuth',
      `<h1 class="err">Autorizacao cancelada</h1><p>${errorDescription || error}</p>`
    )
  }

  const session = readCanvaOAuthSession()
  if (!session?.state || !session.codeVerifier || !session.redirectUri) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Sessao OAuth da Canva nao encontrada. Inicie novamente pelo endpoint /api/canva/oauth/start.',
    })
  }

  if (!code || !state || state !== session.state) {
    clearCanvaOAuthSession()
    throw createError({
      statusCode: 400,
      statusMessage: 'Callback OAuth invalido da Canva.',
    })
  }

  const config = useRuntimeConfig()
  const clientId = String(config.canvaClientId || process.env.CANVA_CLIENT_ID || '').trim()
  const clientSecret = String(config.canvaClientSecret || process.env.CANVA_CLIENT_SECRET || '').trim()

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CANVA_CLIENT_ID/CANVA_CLIENT_SECRET nao configurados.',
    })
  }

  const tokenData = await exchangeCanvaAuthorizationCode({
    clientId,
    clientSecret,
    code,
    codeVerifier: session.codeVerifier,
    redirectUri: session.redirectUri,
  })

  const expiresAt = Date.now() + ((Number(tokenData.expires_in) || 0) * 1000)
  writeCanvaTokenCache({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
  })
  clearCanvaOAuthSession()

  return renderHtml(
    'Canva OAuth',
    `<h1 class="ok">Autorizacao concluida</h1>
     <p>Os novos tokens foram salvos em <code>.canva-oauth.json</code> no servidor.</p>
     <p>Voce ja pode voltar ao app e testar novamente o fluxo de criacao do design.</p>`
  )
})
