// Nuxt Runtime Config Types
interface NuxtRuntimeConfig {
  openaiApiKey?: string
  serperApiKey?: string
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
  emailBrandName?: string
  emailLogoUrl?: string
  emailSupportEmail?: string
  emailSignatureName?: string
}

interface NuxtRuntimeConfigPublic {
  wasabi: {
    endpoint: string
    bucket: string
    region: string
  }
}
