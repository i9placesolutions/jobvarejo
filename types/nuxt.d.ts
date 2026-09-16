// Nuxt Runtime Config Types
interface NuxtRuntimeConfig {
  openaiApiKey?: string
  geminiApiKey?: string
  musicgptApiKey?: string
  musicgptApiUrl?: string
  musicgptWebhookUrl?: string
  musicgptWebhookSecret?: string
  musicgptTtsUrl?: string
  musicgptDefaultVoiceId?: string
  musicgptDefaultVoiceGender?: string

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
