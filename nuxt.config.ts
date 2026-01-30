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
    contaboImportBucket: process.env.CONTABO_IMPORT_BUCKET,
    openaiApiKey: process.env.NUXT_OPENAI_API_KEY,
    serperApiKey: process.env.NUXT_SERPER_API_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    public: {
      // Public keys (exposed to client)
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY,

      // Contabo public config (needed for client-side URL construction)
      // IMPORTANT: These must match the actual values in .env since process.env vars
      // without NUXT_PUBLIC_ prefix are NOT exposed to the client
      contabo: {
        endpoint: 'usc1.contabostorage.com',
        bucket: '475a29e42e55430abff00915da2fa4bc:jobupload',
        importBucket: '475a29e42e55430abff00915da2fa4bc:jobpsd',
        region: 'default',
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
    '/editor/**': {
      ssr: false,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    '/**': {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
  },
})
