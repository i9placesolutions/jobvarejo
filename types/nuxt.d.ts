// Nuxt Runtime Config Types
interface NuxtRuntimeConfig {
  contaboAccessKey?: string
  contaboSecretKey?: string
  contaboBrandsBucket?: string
  openaiApiKey?: string
  serperApiKey?: string
  supabaseServiceRoleKey?: string
}

interface NuxtRuntimeConfigPublic {
  supabaseUrl?: string
  supabaseKey?: string
  contabo: {
    endpoint: string
    bucket: string
    region: string
  }
}
