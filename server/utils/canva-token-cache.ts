import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface CanvaTokenCache {
  access_token: string
  refresh_token: string
  expires_at: number
  updated_at: string
}

const getCachePath = () =>
  resolve(process.cwd(), process.env.CANVA_TOKEN_CACHE_FILE || '.canva-oauth.json')

export const readCanvaTokenCache = (): CanvaTokenCache | null => {
  const file = getCachePath()
  if (!existsSync(file)) return null

  try {
    const raw = readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CanvaTokenCache>
    if (!parsed?.access_token || !parsed?.refresh_token) return null
    return {
      access_token: String(parsed.access_token),
      refresh_token: String(parsed.refresh_token),
      expires_at: Number(parsed.expires_at || 0),
      updated_at: String(parsed.updated_at || ''),
    }
  } catch (error) {
    console.warn('[canva-auth] Falha ao ler cache local de token:', error)
    return null
  }
}

export const writeCanvaTokenCache = (payload: {
  accessToken: string
  refreshToken: string
  expiresAt: number
}) => {
  const file = getCachePath()

  try {
    writeFileSync(file, JSON.stringify({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
      expires_at: payload.expiresAt,
      updated_at: new Date().toISOString(),
    }, null, 2))
  } catch (error) {
    console.warn('[canva-auth] Falha ao escrever cache local de token:', error)
  }
}
