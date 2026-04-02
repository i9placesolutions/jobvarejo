import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface CanvaOAuthSession {
  state: string
  codeVerifier: string
  redirectUri: string
  createdAt: string
}

const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize'
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token'

export const CANVA_OAUTH_SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'asset:read',
  'asset:write',
  'profile:read',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
  'folder:read',
]

const getSessionFile = () =>
  resolve(process.cwd(), process.env.CANVA_OAUTH_SESSION_FILE || '.canva-oauth-session.json')

const encodeBase64Url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const buildCodeChallenge = (codeVerifier: string) =>
  encodeBase64Url(createHash('sha256').update(codeVerifier).digest())

export const createCanvaOAuthSession = (redirectUri: string) => {
  const state = randomBytes(24).toString('base64url')
  const codeVerifier = randomBytes(64).toString('base64url')
  const session: CanvaOAuthSession = {
    state,
    codeVerifier,
    redirectUri,
    createdAt: new Date().toISOString(),
  }

  writeFileSync(getSessionFile(), JSON.stringify(session, null, 2))

  return session
}

export const readCanvaOAuthSession = (): CanvaOAuthSession | null => {
  const file = getSessionFile()
  if (!existsSync(file)) return null

  try {
    return JSON.parse(readFileSync(file, 'utf8')) as CanvaOAuthSession
  } catch {
    return null
  }
}

export const clearCanvaOAuthSession = () => {
  const file = getSessionFile()
  if (!existsSync(file)) return
  try {
    rmSync(file)
  } catch {
    // ignore
  }
}

export const buildCanvaAuthorizeUrl = (params: {
  clientId: string
  redirectUri: string
  state: string
  codeVerifier: string
}) => {
  const url = new URL(CANVA_AUTH_URL)
  url.searchParams.set('code_challenge', buildCodeChallenge(params.codeVerifier))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('scope', CANVA_OAUTH_SCOPES.join(' '))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  return url.toString()
}

export const exchangeCanvaAuthorizationCode = async (params: {
  clientId: string
  clientSecret: string
  code: string
  codeVerifier: string
  redirectUri: string
}) => {
  const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')

  const response = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    }).toString(),
  })

  const text = await response.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Canva OAuth: ${data?.error_description || data?.message || response.statusText}`,
      data,
    })
  }

  return data as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope?: string
  }
}
