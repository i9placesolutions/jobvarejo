import Redis from 'ioredis'

let client: Redis | null = null
let lastError: string | null = null
let lastErrorAt = 0

/**
 * Retorna o cliente Redis singleton.
 * Se REDIS_URL não estiver configurado, retorna null silenciosamente.
 * Erros de conexão são logados mas não propagam para não quebrar a API.
 */
export const getRedis = (): Redis | null => {
  const url = String(process.env.REDIS_URL || useRuntimeConfig?.()?.redisUrl || '').trim()
  if (!url) return null

  if (client) return client

  client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 4000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      // Tenta reconectar até 3 vezes com backoff exponencial, depois desiste
      if (times > 3) return null
      return Math.min(times * 500, 2000)
    }
  })

  client.on('error', (err: Error) => {
    const msg = String(err?.message || err || '')
    const now = Date.now()
    if (!lastError || now - lastErrorAt > 30_000) {
      console.warn('[redis] Erro de conexão:', msg)
      lastError = msg
      lastErrorAt = now
    }
  })

  client.on('connect', () => {
    lastError = null
    console.log('[redis] Conectado com sucesso')
  })

  return client
}

/**
 * Testa se o Redis está acessível.
 */
export const pingRedis = async (): Promise<{ ok: boolean; latencyMs: number | null; error: string | null }> => {
  const r = getRedis()
  if (!r) return { ok: false, latencyMs: null, error: 'REDIS_URL não configurado' }
  try {
    const start = Date.now()
    await r.ping()
    return { ok: true, latencyMs: Date.now() - start, error: null }
  } catch (err: any) {
    return { ok: false, latencyMs: null, error: String(err?.message || err || 'unknown') }
  }
}

/**
 * Get com fallback silencioso (nunca lança exceção).
 */
export const redisGet = async (key: string): Promise<string | null> => {
  try {
    return await getRedis()?.get(key) ?? null
  } catch {
    return null
  }
}

/**
 * Set com TTL em segundos, fallback silencioso.
 */
export const redisSetex = async (key: string, ttlSeconds: number, value: string): Promise<void> => {
  try {
    await getRedis()?.setex(key, ttlSeconds, value)
  } catch {
    // ignora — cache é melhor-esforço
  }
}

/**
 * Incrementa contador e define TTL na primeira vez (para rate limiting).
 * Retorna o valor atual ou null se Redis indisponível.
 */
export const redisRateLimit = async (
  key: string,
  windowSeconds: number
): Promise<number | null> => {
  const r = getRedis()
  if (!r) return null
  try {
    const pipeline = r.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, windowSeconds, 'NX')
    const results = await pipeline.exec()
    const count = results?.[0]?.[1]
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}
