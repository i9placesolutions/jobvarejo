import { assertWorkOAuthEnabled, WORK_OAUTH_SCOPE, workOAuthEndpoints } from '../../utils/work-design/oauth'
export default defineEventHandler(() => {
  assertWorkOAuthEnabled()
  const { issuer, resource } = workOAuthEndpoints()
  return { resource, authorization_servers: [issuer], scopes_supported: [WORK_OAUTH_SCOPE] }
})
