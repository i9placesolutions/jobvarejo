import { z } from 'zod'
import type { H3Event } from 'h3'
import { requireWorkPilot } from '../../../utils/work-design/access'
import { getBearerToken } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { assertWorkOAuthEnabled, consumeWorkOAuthConsent, issueWorkOAuthCode, oauthAuthorizationSchema,
  storeWorkOAuthConsent, validateWorkOAuthClient, workOAuthConsentMatchesSession, workOAuthEndpoints } from '../../../utils/work-design/oauth'
const html = (message: string, form = '') => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Conectar JobVarejo ao Work</title><body><main><h1>Conectar JobVarejo ao ChatGPT Work</h1><p>${message}</p>${form}<p>O piloto permite ler os pedidos e fotos desta conta e criar novos projetos editáveis. Não concede acesso a outras contas, pagamentos ou envio de mensagens.</p></main></body></html>`
const consentCsp = (validatedCallback?: string) =>
  `default-src 'none'; form-action 'self'${validatedCallback ? ` ${new URL(validatedCallback).origin}` : ''}; frame-ancestors 'none'; base-uri 'none'`
export default defineEventHandler(async (event: H3Event) => {
  assertWorkOAuthEnabled()
  await enforceRateLimit(event, 'work-oauth-authorize', 30, 60_000)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  // Formulários POST precisam preservar Origin; o retorno externo continua sem Referer.
  setResponseHeader(event, 'Referrer-Policy', event.method === 'GET' ? 'same-origin' : 'no-referrer')
  setResponseHeader(event, 'Content-Security-Policy', consentCsp())
  const e = workOAuthEndpoints()
  let user
  try { user = await requireWorkPilot(event) } catch (error: any) {
    if (error.statusCode !== 401) throw error
    setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return html('Entre no JobVarejo em outra aba e depois recarregue esta página.', '<p><a href="/auth/login" target="_blank" rel="noopener">Entrar no JobVarejo</a></p>')
  }
  if (user.id !== process.env.WORK_DESIGN_WORKER_OWNER_ID) throw createError({ statusCode: 403, statusMessage: 'Conta fora do piloto.' })
  const sessionToken = getBearerToken(event)
  if (!sessionToken) throw createError({ statusCode: 401, statusMessage: 'Sessão de autorização indisponível.' })
  if (event.method === 'GET') {
    const request = oauthAuthorizationSchema.parse(getQuery(event))
    await validateWorkOAuthClient(request)
    // Safari também verifica o destino do redirecionamento após o POST.
    setResponseHeader(event, 'Content-Security-Policy', consentCsp(request.redirect_uri))
    const nonce = await storeWorkOAuthConsent(request, user.id, sessionToken)
    setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return html('Autorize somente se você iniciou esta conexão no ChatGPT.', `<form method="post"><input type="hidden" name="nonce" value="${nonce}"><button name="decision" value="allow">Autorizar piloto</button><button name="decision" value="deny">Cancelar</button></form>`)
  }
  if (event.method !== 'POST') throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
  if (getHeader(event, 'origin') !== e.issuer) throw createError({ statusCode: 403, statusMessage: 'Origem não autorizada.' })
  const body = z.object({ nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/), decision: z.enum(['allow', 'deny']) }).strict().parse(await readBody(event))
  const consent = await consumeWorkOAuthConsent(body.nonce)
  if (!consent || consent.owner !== user.id) throw createError({ statusCode: 400, statusMessage: 'Confirmação expirada.' })
  if (!workOAuthConsentMatchesSession(consent, sessionToken)) throw createError({ statusCode: 403, statusMessage: 'Confirmação inválida para esta sessão.' })
  setResponseHeader(event, 'Content-Security-Policy', consentCsp(consent.request.redirect_uri))
  const redirect = new URL(consent.request.redirect_uri)
  redirect.searchParams.set('state', consent.request.state); redirect.searchParams.set('iss', e.issuer)
  if (body.decision === 'deny') redirect.searchParams.set('error', 'access_denied')
  else redirect.searchParams.set('code', await issueWorkOAuthCode(consent.request, user.id))
  return sendRedirect(event, redirect.href, 303)
})
