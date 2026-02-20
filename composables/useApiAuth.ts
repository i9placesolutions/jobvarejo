const ACCESS_TOKEN_COOKIE = 'access-token'
const LEGACY_ACCESS_TOKEN_COOKIE = 'sb-access-token'

const parseCookieValue = (cookieHeader: string, key: string): string | null => {
  const parts = String(cookieHeader || '').split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${key}=`)) continue
    const raw = trimmed.slice(`${key}=`.length)
    try {
      return decodeURIComponent(raw).trim() || null
    } catch {
      return raw.trim() || null
    }
  }
  return null
}

const readTokenFromCookie = (): string | null => {
  if (process.server) {
    const headers = useRequestHeaders(['cookie'])
    const rawCookies = String(headers?.cookie || '')
    return (
      parseCookieValue(rawCookies, ACCESS_TOKEN_COOKIE) ||
      parseCookieValue(rawCookies, LEGACY_ACCESS_TOKEN_COOKIE)
    )
  }
  const cookieEntries = document.cookie
    .split(';')
    .map((entry) => entry.trim())
  const currentCookie = cookieEntries.find((entry) => entry.startsWith(`${ACCESS_TOKEN_COOKIE}=`))
  const legacyCookie = cookieEntries.find((entry) => entry.startsWith(`${LEGACY_ACCESS_TOKEN_COOKIE}=`))
  const match = currentCookie || legacyCookie
  if (!match) return null
  const prefix = currentCookie ? `${ACCESS_TOKEN_COOKIE}=` : `${LEGACY_ACCESS_TOKEN_COOKIE}=`
  const raw = match.slice(prefix.length)
  try {
    return decodeURIComponent(raw).trim() || null
  } catch {
    return raw.trim() || null
  }
}

export const useApiAuth = () => {
  const getApiAuthHeaders = async (): Promise<Record<string, string>> => {
    const token = readTokenFromCookie()
    if (!token) {
      throw new Error('Sessao expirada. Faca login novamente.')
    }
    return { Authorization: `Bearer ${token}` }
  }

  const tryGetApiAuthHeaders = async (): Promise<Record<string, string> | null> => {
    try {
      return await getApiAuthHeaders()
    } catch {
      return null
    }
  }

  return {
    getApiAuthHeaders,
    tryGetApiAuthHeaders
  }
}
