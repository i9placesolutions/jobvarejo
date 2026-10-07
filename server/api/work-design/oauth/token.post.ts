import { z } from 'zod'
import { assertWorkOAuthEnabled, exchangeWorkOAuthCode, refreshWorkOAuthTokens, workOAuthEndpoints } from '../../../utils/work-design/oauth'
import { enforceRateLimit } from '../../../utils/rate-limit'
const base = { client_id: z.string().max(250), resource: z.literal('https://jobvarejo.com.br/api/work-design/mcp') }
export default defineEventHandler(async event => {
  assertWorkOAuthEnabled()
  await enforceRateLimit(event, 'work-oauth-token', 60, 60_000)
  setResponseHeader(event, 'Cache-Control', 'no-store'); setResponseHeader(event, 'Pragma', 'no-cache')
  const body = z.discriminatedUnion('grant_type', [
    z.object({ ...base, resource: z.literal(workOAuthEndpoints().resource), grant_type: z.literal('authorization_code'),
      code: z.string().min(30).max(256), redirect_uri: z.string().url().max(500), code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) }),
    z.object({ ...base, resource: z.literal(workOAuthEndpoints().resource), grant_type: z.literal('refresh_token'), refresh_token: z.string().min(30).max(256) })
  ]).safeParse(await readBody(event))
  if (!body.success) { setResponseStatus(event, 400); return { error: 'invalid_request' } }
  try { return body.data.grant_type === 'authorization_code' ? await exchangeWorkOAuthCode(body.data) : await refreshWorkOAuthTokens(body.data) }
  catch (error: any) { setResponseStatus(event, error.statusCode === 503 ? 503 : 400); return { error: error.statusCode === 503 ? 'temporarily_unavailable' : 'invalid_grant' } }
})
