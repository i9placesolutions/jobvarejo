import { createHash, timingSafeEqual } from 'node:crypto'
import { createError, getHeader, getRequestURL, setResponseHeader, type H3Event } from 'h3'
import { verifyWorkOAuthAccess, workOAuthEndpoints, WORK_OAUTH_SCOPE } from './oauth'
import { requireAuthenticatedUser } from '../auth'
import { getProfileById } from '../auth-db'
import { enforceRateLimit } from '../rate-limit'

export function workPilotConfig() {
  return { enabled: process.env.WORK_DESIGN_ENABLED === 'true',
    owners: (process.env.WORK_DESIGN_PILOT_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
    workerOwner: process.env.WORK_DESIGN_WORKER_OWNER_ID || '',
    n8nToken: process.env.WORK_DESIGN_N8N_TOKEN || '',
    token: process.env.WORK_DESIGN_WORKER_TOKEN || '' }
}
export function pilotIdentityAllowed(config: ReturnType<typeof workPilotConfig>, actor: string, account: string) {
  return config.enabled && config.owners.includes(actor) && actor === account
}
export function workerTokenMatches(expected: string, supplied: string) {
  return expected.length >= 32 && supplied.length >= 32 && timingSafeEqual(
    createHash('sha256').update(expected).digest(), createHash('sha256').update(supplied).digest())
}
export async function requireWorkPilot(event: H3Event) {
  const user = await requireAuthenticatedUser(event)
  if (!pilotIdentityAllowed(workPilotConfig(), user.actorId, user.id))
    throw createError({ statusCode: 403, statusMessage: 'Área experimental não liberada para esta conta.' })
  await enforceRateLimit(event, `work-design-panel:${user.id}`, 120, 60_000)
  return user
}
export async function requireWorkConsumer(event: H3Event, kind: 'work' | 'n8n' = 'work') {
  const config = workPilotConfig()
  if (!config.enabled || !config.owners.includes(config.workerOwner))
    throw createError({ statusCode: 503, statusMessage: 'Consumidor Work desativado.' })
  const origin = getHeader(event, 'origin')
  const accepted = [getRequestURL(event).origin, 'https://chatgpt.com', 'https://chat.openai.com']
  if (origin && !accepted.includes(origin)) throw createError({ statusCode: 403, statusMessage: 'Origem não autorizada.' })
  const supplied = (getHeader(event, 'authorization') || '').replace(/^Bearer /, '')
  const oauthOwner = kind === 'work' ? await verifyWorkOAuthAccess(supplied) : null
  if (oauthOwner !== config.workerOwner && !workerTokenMatches(kind === 'work' ? config.token : config.n8nToken, supplied)) {
    if (kind === 'work') setResponseHeader(event, 'WWW-Authenticate', `Bearer resource_metadata="${workOAuthEndpoints().metadata}", scope="${WORK_OAUTH_SCOPE}"`)
    throw createError({ statusCode: 401, statusMessage: 'Credencial do consumidor inválida.' })
  }
  await enforceRateLimit(event, `work-design-consumer:${config.workerOwner}`, 180, 60_000)
  const profile = await getProfileById(config.workerOwner)
  if (!profile || profile.is_active === false) throw createError({ statusCode: 403, statusMessage: 'Conta piloto indisponível.' })
  return config.workerOwner
}
