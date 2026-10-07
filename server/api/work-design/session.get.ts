import { requireAuthenticatedUser } from '../../utils/auth'
import { pilotIdentityAllowed, workPilotConfig } from '../../utils/work-design/access'
import { workDatabaseReady } from '../../utils/work-design/repository'
import { enforceRateLimit } from '../../utils/rate-limit'
export default defineEventHandler(async event => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `work-design-session:${user.id}`, 60, 60_000)
  const config = workPilotConfig(), allowed = pilotIdentityAllowed(config, user.actorId, user.id)
  return { allowed, databaseReady: allowed ? await workDatabaseReady() : false,
    consumerConfigured: allowed && config.workerOwner === user.id && (config.token.length >= 32 || process.env.WORK_DESIGN_OAUTH_ENABLED === 'true'),
    mode: 'batch', quickCompatible: false }
})
