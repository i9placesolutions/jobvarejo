import { Pool, type PoolClient, type QueryResultRow } from 'pg'

let poolCache: Pool | null = null

const isSslRequired = (connectionString: string): boolean => {
  try {
    const parsed = new URL(connectionString)
    const sslMode = String(parsed.searchParams.get('sslmode') || '').toLowerCase()
    if (sslMode === 'disable') return false
    if (sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full') return true
  } catch {
    // Ignore invalid URL parsing; fallback to explicit env below.
  }
  return String(process.env.POSTGRES_SSL || '').toLowerCase() === 'true'
}

const getDatabaseUrl = (): string => {
  const config = useRuntimeConfig()
  const value = String((config as any).postgresDatabaseUrl || '').trim()
  if (value) return value

  const fallbackFromEnv = String(
    process.env.POSTGRES_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.NUXT_POSTGRES_DATABASE_URL ||
      process.env.TARGET_DATABASE_URL ||
      ''
  ).trim()
  if (fallbackFromEnv) return fallbackFromEnv

  throw createError({
    statusCode: 500,
    statusMessage:
      'Missing database URL runtime configuration. Set POSTGRES_DATABASE_URL (or DATABASE_URL / NUXT_POSTGRES_DATABASE_URL / TARGET_DATABASE_URL) in .env and restart "npm run dev".'
  })
}

export const getPostgresPool = (): Pool => {
  if (poolCache) return poolCache

  const connectionString = getDatabaseUrl()
  const max = Math.min(30, Math.max(1, Number.parseInt(String(process.env.POSTGRES_POOL_MAX || '10'), 10) || 10))
  const ssl = isSslRequired(connectionString) ? { rejectUnauthorized: false } : undefined

  poolCache = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl
  })

  poolCache.on('error', (err: Error) => {
    console.error('Postgres pool error:', err)
  })

  return poolCache
}

export const pgQuery = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
) => {
  const pool = getPostgresPool()
  return pool.query<T>(text, params)
}

export const pgOneOrNull = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
): Promise<T | null> => {
  const result = await pgQuery<T>(text, params)
  return result.rows[0] || null
}

export const pgTx = async <T>(
  run: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getPostgresPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const output = await run(client)
    await client.query('COMMIT')
    return output
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // no-op
    }
    throw error
  } finally {
    client.release()
  }
}
