// Nuxt Runtime Config Types
interface NuxtRuntimeConfig {
  openaiApiKey?: string
  serperApiKey?: string
  googleCseApiKey?: string
  googleCseCx?: string
  postgresDatabaseUrl?: string
  authJwtSecret?: string
  authTokenTtlSeconds?: string | number
  authResetTokenTtlMinutes?: string | number
  appBaseUrl?: string
  smtpHost?: string
  smtpPort?: string | number
  smtpSecure?: string | boolean
  smtpUser?: string
  smtpPass?: string
  smtpFrom?: string
}

interface NuxtRuntimeConfigPublic {
  wasabi: {
    endpoint: string
    bucket: string
    region: string
  }
}
