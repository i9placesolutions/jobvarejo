import { requireAdminUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `debug-runtime-config:${user.id}`, 20, 60_000)

  const nodeEnv = process.env.NODE_ENV

  // Avoid exposing anything in prod
  if (nodeEnv && nodeEnv !== 'development') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const config = useRuntimeConfig()

  const openaiApiKey = String(config.openaiApiKey || '')
  const serperApiKey = String(config.serperApiKey || '')
  const authJwtSecret = String((config as any).authJwtSecret || '')
  const postgresUrl = String((config as any).postgresDatabaseUrl || '')

  return {
    ok: true,
    nodeEnv: nodeEnv || 'unknown',
    runtimeConfig: {
      openaiApiKeyPresent: openaiApiKey.length > 0,
      openaiApiKeyLength: openaiApiKey.length,
      serperApiKeyPresent: serperApiKey.length > 0,
      serperApiKeyLength: serperApiKey.length,
      authJwtSecretPresent: authJwtSecret.length > 0,
      authJwtSecretLength: authJwtSecret.length,
      postgresDatabaseUrlPresent: postgresUrl.length > 0,
      postgresDatabaseUrlLength: postgresUrl.length,
    },
    envPresence: {
      NUXT_OPENAI_API_KEY: Boolean(process.env.NUXT_OPENAI_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      NUXT_SERPER_API_KEY: Boolean(process.env.NUXT_SERPER_API_KEY),
      AUTH_JWT_SECRET: Boolean(process.env.AUTH_JWT_SECRET),
      POSTGRES_DATABASE_URL: Boolean(process.env.POSTGRES_DATABASE_URL),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      NUXT_POSTGRES_DATABASE_URL: Boolean(process.env.NUXT_POSTGRES_DATABASE_URL),
      TARGET_DATABASE_URL: Boolean(process.env.TARGET_DATABASE_URL),
    },
  }
})
