// Salvar/ler tokens do Canva no banco de dados PostgreSQL (persiste entre deploys)
import { pgOneOrNull, pgQuery } from './postgres'

interface CanvaTokenCache {
  access_token: string
  refresh_token: string
  expires_at: number
}

// Cache em memória para evitar query a cada request
let _memCache: CanvaTokenCache | null = null
let _memCacheAt: number = 0
const MEM_CACHE_TTL = 60_000 // 1 minuto

export const readCanvaTokenCache = async (): Promise<CanvaTokenCache | null> => {
  // Cache em memória
  if (_memCache && (Date.now() - _memCacheAt) < MEM_CACHE_TTL) {
    return _memCache
  }

  try {
    const row = await pgOneOrNull<any>(
      `SELECT access_token, refresh_token, expires_at FROM canva_oauth_tokens ORDER BY updated_at DESC LIMIT 1`
    )
    if (!row?.access_token) return null

    _memCache = {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expires_at: Number(row.expires_at || 0),
    }
    _memCacheAt = Date.now()
    return _memCache
  } catch (err) {
    console.warn('[canva-token-cache] Erro ao ler do banco:', err)
    return null
  }
}

export const writeCanvaTokenCache = async (payload: {
  accessToken: string
  refreshToken: string
  expiresAt: number
}) => {
  _memCache = {
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
    expires_at: payload.expiresAt,
  }
  _memCacheAt = Date.now()

  try {
    // Upsert - sempre manter apenas 1 registro
    await pgQuery(
      `INSERT INTO canva_oauth_tokens (id, access_token, refresh_token, expires_at, updated_at)
       VALUES ('singleton', $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         access_token = $1,
         refresh_token = $2,
         expires_at = $3,
         updated_at = NOW()`,
      [payload.accessToken, payload.refreshToken, payload.expiresAt]
    )
  } catch (err) {
    console.warn('[canva-token-cache] Erro ao salvar no banco:', err)
  }
}
