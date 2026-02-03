// Nuxt Runtime Config Types
interface NuxtRuntimeConfig {
  contaboEndpoint?: string
  contaboRegion?: string
  contaboBucket?: string
  contaboImportBucket?: string
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
    importBucket?: string
    region: string
  }
}
