import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event)

  const nodeEnv = process.env.NODE_ENV

  // Avoid exposing anything in prod
  if (nodeEnv && nodeEnv !== 'development') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const config = useRuntimeConfig()

  const openaiApiKey = String(config.openaiApiKey || '')
  const serperApiKey = String(config.serperApiKey || '')
  const serviceRoleKey = String(config.supabaseServiceRoleKey || '')

  return {
    ok: true,
    nodeEnv: nodeEnv || 'unknown',
    runtimeConfig: {
      openaiApiKeyPresent: openaiApiKey.length > 0,
      openaiApiKeyLength: openaiApiKey.length,
      serperApiKeyPresent: serperApiKey.length > 0,
      serperApiKeyLength: serperApiKey.length,
      supabaseServiceRoleKeyPresent: serviceRoleKey.length > 0,
      supabaseServiceRoleKeyLength: serviceRoleKey.length,
    },
    envPresence: {
      NUXT_OPENAI_API_KEY: Boolean(process.env.NUXT_OPENAI_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      NUXT_SERPER_API_KEY: Boolean(process.env.NUXT_SERPER_API_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  }
})
