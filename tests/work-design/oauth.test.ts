import { createServer, type Server } from 'node:http'
import { createHash } from 'node:crypto'
import * as h3 from 'h3'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { owner, other } from './fixtures'
const store = vi.hoisted(() => new Map<string, { value: string; until: number }>())
vi.mock('../../server/utils/redis', () => ({ getRedis: () => ({
  setex: async (key: string, ttl: number, value: string) => { store.set(key, { value, until: Date.now() + ttl * 1000 }); return 'OK' },
  get: async (key: string) => { const entry = store.get(key); return entry && entry.until > Date.now() ? entry.value : null },
  getdel: async (key: string) => { const entry = store.get(key); store.delete(key); return entry && entry.until > Date.now() ? entry.value : null }
}) }))
vi.mock('../../server/utils/auth', async importOriginal => ({ ...(await importOriginal<typeof import('../../server/utils/auth')>()), requireAuthenticatedUser: async (event: h3.H3Event) => {
  const id = h3.getHeader(event, 'x-test-user')
  if (!id) throw h3.createError({ statusCode: 401 })
  return { id, actorId: id }
} }))
vi.mock('../../server/utils/auth-db', () => ({ getProfileById: async () => ({ id: owner, is_active: true }) }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: async () => {} }))
import { exchangeWorkOAuthCode, issueWorkOAuthCode, oauthAuthorizationSchema, refreshWorkOAuthTokens,
  validateWorkOAuthClient, verifyWorkOAuthAccess, WORK_OAUTH_SCOPE } from '../../server/utils/work-design/oauth'
let server: Server, base: string
const nativeFetch = globalThis.fetch
const verifier = 'a'.repeat(64)
const request = () => oauthAuthorizationSchema.parse({ response_type: 'code', client_id: 'https://chatgpt.com/oauth/client.json',
  redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect', state: 'test-state',
  resource: 'https://jobvarejo.com.br/api/work-design/mcp', scope: WORK_OAUTH_SCOPE,
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
beforeAll(async () => {
  for (const name of ['defineEventHandler', 'setResponseHeader', 'setResponseStatus', 'getHeader', 'readBody', 'createError',
    'getQuery', 'setCookie', 'getCookie', 'deleteCookie', 'sendRedirect'] as const) vi.stubGlobal(name, h3[name])
  vi.stubEnv('WORK_DESIGN_ENABLED', 'true'); vi.stubEnv('WORK_DESIGN_OAUTH_ENABLED', 'true')
  vi.stubEnv('WORK_DESIGN_PILOT_IDS', owner); vi.stubEnv('WORK_DESIGN_WORKER_OWNER_ID', owner)
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
    if (url === 'https://chatgpt.com/oauth/client.json') return new Response(JSON.stringify({ client_id: url,
      redirect_uris: [request().redirect_uri], token_endpoint_auth_methods_supported: ['none'] }))
    if (url === 'https://chatgpt.com/oauth/codex/client.json' || url === 'https://chatgpt.com/oauth/codex/server123/client.json')
      return new Response(JSON.stringify({ client_id: url, redirect_uris: [
        `http://127.0.0.1/callback${url.includes('/server123/') ? '/server123' : ''}`,
        `http://localhost/callback${url.includes('/server123/') ? '/server123' : ''}`
      ], token_endpoint_auth_methods_supported: ['none'] }))
    return nativeFetch(url, options)
  }))
  const app = h3.createApp().use('/authorize', (await import('../../server/api/work-design/oauth/authorize')).default)
    .use('/token', (await import('../../server/api/work-design/oauth/token.post')).default)
  server = createServer(h3.toNodeListener(app)); await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${(server.address() as any).port}`
})
afterAll(async () => { await new Promise<void>(done => server.close(() => done())); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('OAuth Work isolado por conta, recurso e PKCE', () => {
  it('aceita apenas CIMD e retorno oficial correspondente; não busca URL arbitrária', async () => {
    await expect(validateWorkOAuthClient(request())).resolves.toBeUndefined()
    await expect(validateWorkOAuthClient({ ...request(), client_id: 'https://127.0.0.1/client.json' })).rejects.toThrow(/autorizado/)
    await expect(validateWorkOAuthClient({ ...request(), redirect_uri: 'https://attacker.invalid' })).rejects.toThrow(/autorizado/)
    await expect(validateWorkOAuthClient({ ...request(), resource: 'https://another.invalid' })).rejects.toThrow(/Recurso/)
  })
  it('aceita CIMD nativo publicado com porta variável, mantendo host e caminho exatos', async () => {
    const input = { ...request(), client_id: 'https://chatgpt.com/oauth/codex/client.json', redirect_uri: 'http://127.0.0.1:62123/callback' }
    await expect(validateWorkOAuthClient(input)).resolves.toBeUndefined()
    await expect(validateWorkOAuthClient({ ...input, redirect_uri: 'http://localhost:54433/callback' })).resolves.toBeUndefined()
    await expect(validateWorkOAuthClient({ ...input, client_id: 'https://chatgpt.com/oauth/codex/server123/client.json',
      redirect_uri: 'http://127.0.0.1:54433/callback/server123' })).resolves.toBeUndefined()
    for (const redirect_uri of ['http://127.0.0.2:62123/callback', 'https://127.0.0.1:62123/callback',
      'http://attacker.invalid:62123/callback', 'http://127.0.0.1:62123/callback/wrong',
      'http://127.0.0.1:62123/callback?extra=1', 'http://127.0.0.1:62123/callback#extra',
      'http://user@127.0.0.1:62123/callback', 'http://127.0.0.1/callback'])
      await expect(validateWorkOAuthClient({ ...input, redirect_uri })).rejects.toThrow(/autorizado/)
  })
  it('vincula a troca nativa à porta original, ao cliente e ao PKCE', async () => {
    const input = { ...request(), client_id: 'https://chatgpt.com/oauth/codex/client.json', redirect_uri: 'http://127.0.0.1:62123/callback' }
    await validateWorkOAuthClient(input)
    await expect(exchangeWorkOAuthCode({ ...input, code: await issueWorkOAuthCode(input, owner),
      code_verifier: verifier, redirect_uri: 'http://127.0.0.1:54433/callback' })).rejects.toThrow(/inválido/)
    const tokens = await exchangeWorkOAuthCode({ ...input, code: await issueWorkOAuthCode(input, owner), code_verifier: verifier })
    expect(await verifyWorkOAuthAccess(tokens.access_token)).toBe(owner)
  })
  it('troca código uma única vez e emite acesso restrito e refresh rotativo', async () => {
    const code = await issueWorkOAuthCode(request(), owner)
    const input = { ...request(), code, code_verifier: verifier }
    const tokens = await exchangeWorkOAuthCode(input)
    expect(await verifyWorkOAuthAccess(tokens.access_token)).toBe(owner)
    await expect(exchangeWorkOAuthCode(input)).rejects.toThrow(/inválido/)
    const refresh = { refresh_token: tokens.refresh_token, client_id: input.client_id, resource: input.resource }
    const renewed = await refreshWorkOAuthTokens(refresh)
    expect(await verifyWorkOAuthAccess(renewed.access_token)).toBe(owner)
    await expect(refreshWorkOAuthTokens(refresh)).rejects.toThrow(/inválida/)
    expect([...store.keys()].some(key => key.includes(tokens.access_token))).toBe(false)
  })
  it.each(['verifier', 'resource', 'client', 'redirect'])('recusa troca com %s diferente', async field => {
    const input = { ...request(), code: await issueWorkOAuthCode(request(), owner), code_verifier: verifier }
    if (field === 'verifier') input.code_verifier = 'b'.repeat(64)
    if (field === 'resource') input.resource = 'https://wrong.invalid'
    if (field === 'client') input.client_id = 'https://wrong.invalid'
    if (field === 'redirect') input.redirect_uri = 'https://wrong.invalid'
    await expect(exchangeWorkOAuthCode(input)).rejects.toThrow(/inválido/)
  })
  it('não permite tokens expirados, de outro recurso ou OAuth desativado', async () => {
    const code = await issueWorkOAuthCode(request(), owner)
    const tokens = await exchangeWorkOAuthCode({ ...request(), code, code_verifier: verifier })
    const key = [...store.keys()].find(k => k.endsWith(createHash('sha256').update(tokens.access_token).digest('hex')))!
    store.get(key)!.until = Date.now() - 1
    expect(await verifyWorkOAuthAccess(tokens.access_token)).toBeNull()
    vi.stubEnv('WORK_DESIGN_OAUTH_ENABLED', 'false'); expect(await verifyWorkOAuthAccess(tokens.access_token)).toBeNull()
    vi.stubEnv('WORK_DESIGN_OAUTH_ENABLED', 'true')
  })
  it.each(['web', 'native'])('%s: exige sessão da conta piloto, origem e nonce antes da confirmação', async mode => {
    const input = mode === 'native' ? { ...request(), client_id: 'https://chatgpt.com/oauth/codex/client.json',
      redirect_uri: 'http://127.0.0.1:62123/callback' } : request()
    const url = base + '/authorize?' + new URLSearchParams(input).toString()
    expect(await (await nativeFetch(url)).text()).toContain('Entrar no JobVarejo')
    expect((await nativeFetch(url, { headers: { 'x-test-user': other } })).status).toBe(403)
    const auth = { 'x-test-user': owner, Authorization: 'Bearer test-session-a' }
    const response = await nativeFetch(url, { headers: auth })
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
    expect(response.headers.get('set-cookie')).toBeNull()
    const html = await response.text(), nonce = html.match(/name="nonce" value="([^"]+)"/)![1]!
    const post = (origin: string, value: string) => nativeFetch(base + '/authorize', { method: 'POST', redirect: 'manual',
      headers: { ...auth, Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ nonce: value, decision: 'allow' }) })
    expect((await post('https://attacker.invalid', nonce)).status).toBe(403)
    expect((await post('null', nonce)).status).toBe(403)
    expect((await nativeFetch(base + '/authorize', { method: 'POST', redirect: 'manual',
      headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ nonce, decision: 'allow' }) })).status).toBe(403)
    expect((await post('https://jobvarejo.com.br', 'q'.repeat(43))).status).toBe(400)
    const granted = await post('https://jobvarejo.com.br', nonce)
    expect(granted.status).toBe(303)
    expect(granted.headers.get('referrer-policy')).toBe('no-referrer')
    const callback = new URL(granted.headers.get('location')!)
    expect(callback.origin + callback.pathname).toBe(input.redirect_uri)
    expect(callback.searchParams.get('state')).toBe('test-state'); expect(callback.searchParams.get('iss')).toBe('https://jobvarejo.com.br')
    expect((await post('https://jobvarejo.com.br', nonce)).status).toBe(400)
    const token = await nativeFetch(base + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: input.client_id, resource: input.resource,
        redirect_uri: input.redirect_uri, code: callback.searchParams.get('code')!, code_verifier: verifier }) })
    expect(token.status).toBe(200); expect((await token.json() as any).token_type).toBe('Bearer')
  })
  it('vincula confirmação ao cookie de login existente, sem cookie adicional e sem conflito entre abas', async () => {
    const url = base + '/authorize?' + new URLSearchParams(request()).toString()
    const auth = { 'x-test-user': owner, Cookie: 'access-token=test-session-cookie' }
    const nonceFor = async (headers = auth) => {
      const response = await nativeFetch(url, { headers })
      expect(response.status).toBe(200)
      return (await response.text()).match(/name="nonce" value="([^"]+)"/)![1]!
    }
    const first = await nonceFor(), second = await nonceFor()
    const deny = (nonce: string, headers = auth) => nativeFetch(base + '/authorize', { method: 'POST', redirect: 'manual',
      headers: { ...headers, Origin: 'https://jobvarejo.com.br', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ nonce, decision: 'deny' }) })
    for (const nonce of [first, second]) {
      const response = await deny(nonce)
      expect(response.status).toBe(303)
      expect(new URL(response.headers.get('location')!).searchParams.get('error')).toBe('access_denied')
      expect((await deny(nonce)).status).toBe(400)
    }
    const swapped = await nonceFor()
    expect((await deny(swapped, { ...auth, Cookie: 'access-token=another-session' })).status).toBe(403)
    expect((await deny(swapped)).status).toBe(400)
    const expired = await nonceFor()
    const key = 'work-design:oauth:consent:' + createHash('sha256').update(expired).digest('hex')
    expect(store.get(key)!.value).not.toContain('test-session-cookie')
    store.get(key)!.until = Date.now() - 1
    expect((await deny(expired)).status).toBe(400)
    expect((await nativeFetch(url, { headers: { 'x-test-user': owner } })).status).toBe(401)
  })
})
