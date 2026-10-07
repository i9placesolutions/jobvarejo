import { assertWorkOAuthEnabled, WORK_OAUTH_SCOPE, workOAuthEndpoints } from '../../utils/work-design/oauth'
export default defineEventHandler(() => {
  assertWorkOAuthEnabled()
  const e = workOAuthEndpoints()
  return { issuer: e.issuer, authorization_endpoint: e.authorize, token_endpoint: e.token,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'], scopes_supported: [WORK_OAUTH_SCOPE],
    token_endpoint_auth_methods_supported: ['none'], client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true }
})
