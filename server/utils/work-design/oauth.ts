import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
import { getRedis } from '../redis'
import { assertSafeExternalHttpUrl } from '../url-safety'

export const WORK_OAUTH_SCOPE = 'work-design:compose'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const oauthEqual = (a: string, b: string) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)))
export function workOAuthEndpoints() {
  const url = new URL(process.env.WORK_DESIGN_PUBLIC_ORIGIN || 'https://jobvarejo.com.br')
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw createError({ statusCode: 503, statusMessage: 'Origem OAuth inválida.' })
  const issuer = url.origin
  return { issuer, resource: `${issuer}/api/work-design/mcp`, metadata: `${issuer}/.well-known/oauth-protected-resource`,
    authorize: `${issuer}/api/work-design/oauth/authorize`, token: `${issuer}/api/work-design/oauth/token` }
}
export function assertWorkOAuthEnabled() {
  if (process.env.WORK_DESIGN_ENABLED !== 'true' || process.env.WORK_DESIGN_OAUTH_ENABLED !== 'true')
    throw createError({ statusCode: 503, statusMessage: 'Conexão Work desativada.' })
}
async function redisOperation<T>(action: (redis: NonNullable<ReturnType<typeof getRedis>>) => Promise<T>): Promise<T> {
  try {
    const redis = getRedis()
    if (!redis) throw new Error('unavailable')
    return await action(redis)
  } catch { throw createError({ statusCode: 503, statusMessage: 'Autorização temporariamente indisponível.' }) }
}
async function put(kind: string, value: unknown, ttl: number, prefix = '') {
  const token = prefix + randomBytes(32).toString('base64url')
  await redisOperation(redis => redis.setex(`work-design:oauth:${kind}:${hash(token)}`, ttl, JSON.stringify(value)))
  return token
}
async function read(kind: string, token: string, consume = false) {
  if (token.length > 256) return null
  const value = await redisOperation(redis => consume
    ? redis.getdel(`work-design:oauth:${kind}:${hash(token)}`)
    : redis.get(`work-design:oauth:${kind}:${hash(token)}`))
  return value ? JSON.parse(value) : null
}
export const oauthAuthorizationSchema = z.object({
  response_type: z.literal('code'), client_id: z.string().max(250), redirect_uri: z.string().url().max(500),
  state: z.string().min(1).max(1000), resource: z.string().url(), scope: z.literal(WORK_OAUTH_SCOPE).default(WORK_OAUTH_SCOPE),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal('S256')
})
export type OAuthAuthorization = z.infer<typeof oauthAuthorizationSchema>
/** CIMD somente da OpenAI, sem buscar URLs arbitrárias fornecidas pelo cliente. */
export async function validateWorkOAuthClient(request: OAuthAuthorization) {
  const client = new URL(request.client_id), callback = new URL(request.redirect_uri)
  const stable = client.pathname === '/oauth/client.json' && callback.pathname === '/connector_platform_oauth_redirect'
  const match = client.pathname.match(/^\/oauth\/([A-Za-z0-9_-]+)\/client\.json$/)
  const legacy = match && callback.pathname === `/connector/oauth/${match[1]}`
  const nativeMatch = client.pathname.match(/^\/oauth\/codex\/([A-Za-z0-9_-]+)\/client\.json$/)
  const nativePath = client.pathname === '/oauth/codex/client.json' && callback.pathname === '/callback'
    || nativeMatch && callback.pathname === `/callback/${nativeMatch[1]}`
  const native = Boolean(nativePath && callback.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(callback.hostname) && callback.port)
  const web = callback.origin === client.origin && (stable || legacy)
  if (client.origin !== 'https://chatgpt.com' || client.search || client.hash ||
      client.username || client.password || callback.search || callback.hash || callback.username || callback.password || (!web && !native))
    throw createError({ statusCode: 400, statusMessage: 'Cliente ou retorno OAuth não autorizado.' })
  if (request.resource !== workOAuthEndpoints().resource)
    throw createError({ statusCode: 400, statusMessage: 'Recurso OAuth inválido.' })
  let metadata: any
  try {
    const response = await fetch(assertSafeExternalHttpUrl(client.href), { redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('metadata')
    const body = await response.text()
    if (body.length > 20_000) throw new Error('metadata')
    metadata = JSON.parse(body)
  } catch { throw createError({ statusCode: 503, statusMessage: 'Não foi possível verificar o cliente ChatGPT.' }) }
  // RFC 8252: o aplicativo escolhe a porta; host/caminho continuam vinculados ao CIMD oficial.
  const registeredCallback = new URL(callback.href)
  if (native) registeredCallback.port = ''
  if (metadata.client_id !== request.client_id || !metadata.redirect_uris?.includes(registeredCallback.href) ||
      !(metadata.token_endpoint_auth_methods_supported || [metadata.token_endpoint_auth_method]).includes('none'))
    throw createError({ statusCode: 400, statusMessage: 'Metadados do cliente OAuth incompatíveis.' })
}
// Synchronizer token vinculado à sessão autenticada: somente o hash fica no Redis.
export const storeWorkOAuthConsent = (request: OAuthAuthorization, owner: string, sessionToken: string) =>
  put('consent', { request, owner, sessionHash: hash(sessionToken) }, 600)
export const workOAuthConsentMatchesSession = (consent: { sessionHash?: string }, sessionToken: string) =>
  Boolean(consent.sessionHash && sessionToken && oauthEqual(consent.sessionHash, hash(sessionToken)))
export const consumeWorkOAuthConsent = (nonce: string) => read('consent', nonce, true)
export const issueWorkOAuthCode = (request: OAuthAuthorization, owner: string) => put('code', { request, owner }, 300)
export async function issueWorkOAuthTokens(grant: { owner: string; clientId: string; resource: string; scope: string }) {
  const access = await put('access', grant, 3600, 'wdo_')
  const refresh = await put('refresh', grant, 604800, 'wdr_')
  return { access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh, scope: grant.scope }
}
export async function exchangeWorkOAuthCode(input: { code: string; client_id: string; redirect_uri: string; resource: string; code_verifier: string }) {
  const code = await read('code', input.code, true)
  const challenge = createHash('sha256').update(input.code_verifier).digest('base64url')
  if (!code || code.request.client_id !== input.client_id || code.request.redirect_uri !== input.redirect_uri ||
      code.request.resource !== input.resource || !oauthEqual(challenge, code.request.code_challenge))
    throw createError({ statusCode: 400, statusMessage: 'Código OAuth inválido ou expirado.' })
  return issueWorkOAuthTokens({ owner: code.owner, clientId: input.client_id, resource: input.resource, scope: WORK_OAUTH_SCOPE })
}
export async function refreshWorkOAuthTokens(input: { refresh_token: string; client_id: string; resource: string }) {
  const grant = await read('refresh', input.refresh_token, true)
  if (!grant || grant.clientId !== input.client_id || grant.resource !== input.resource)
    throw createError({ statusCode: 400, statusMessage: 'Autorização OAuth inválida ou expirada.' })
  return issueWorkOAuthTokens(grant)
}
export async function verifyWorkOAuthAccess(token: string) {
  if (!token.startsWith('wdo_') || process.env.WORK_DESIGN_OAUTH_ENABLED !== 'true') return null
  const grant = await read('access', token)
  return grant?.scope === WORK_OAUTH_SCOPE && grant.resource === workOAuthEndpoints().resource ? grant.owner as string : null
}
