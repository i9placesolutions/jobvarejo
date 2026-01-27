import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    // Private keys (server-side only)
    contaboEndpoint: process.env.CONTABO_ENDPOINT,
    contaboRegion: process.env.CONTABO_REGION,
    contaboBucket: process.env.CONTABO_BUCKET,
    contaboAccessKey: process.env.CONTABO_ACCESS_KEY,
    contaboSecretKey: process.env.CONTABO_SECRET_KEY,
    contaboBrandsBucket: process.env.CONTABO_BRANDS_BUCKET,
    openaiApiKey: process.env.NUXT_OPENAI_API_KEY,
    serperApiKey: process.env.NUXT_SERPER_API_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    public: {
      // Public keys (exposed to client)
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY,

      // Contabo public config (needed for client-side URL construction)
      contabo: {
        endpoint: process.env.CONTABO_ENDPOINT || 'usc1.contabostorage.com',
        bucket: process.env.CONTABO_BUCKET || 'jobupload',
        region: process.env.CONTABO_REGION || 'us-east-1',
      }
    }
  },
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  css: ['~/assets/css/main.css'],
  srcDir: '.',
  routeRules: {
    '/**': {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
  },
})
