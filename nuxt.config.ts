import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    // Private keys (server-side only)
    contaboEndpoint: process.env.CONTABO_ENDPOINT || process.env.NUXT_CONTABO_ENDPOINT || 'usc1.contabostorage.com',
    contaboRegion: process.env.CONTABO_REGION || process.env.NUXT_CONTABO_REGION || 'default',
    contaboBucket: process.env.CONTABO_BUCKET || process.env.NUXT_CONTABO_BUCKET || '475a29e42e55430abff00915da2fa4bc:jobupload',
    contaboAccessKey: process.env.CONTABO_ACCESS_KEY || process.env.NUXT_CONTABO_ACCESS_KEY || '',
    contaboSecretKey: process.env.CONTABO_SECRET_KEY || process.env.NUXT_CONTABO_SECRET_KEY || '',
    contaboBrandsBucket: process.env.CONTABO_BRANDS_BUCKET || process.env.NUXT_CONTABO_BRANDS_BUCKET || '',
    contaboImportBucket: process.env.CONTABO_IMPORT_BUCKET || process.env.NUXT_CONTABO_IMPORT_BUCKET || '475a29e42e55430abff00915da2fa4bc:jobpsd',
    openaiApiKey: process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    serperApiKey: process.env.NUXT_SERPER_API_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

    public: {
      // Public keys (exposed to client)
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY,

      // Contabo public config (needed for client-side URL construction)
      // IMPORTANT: These are not secrets, but they end up in the client bundle.
      // Keep access/secret keys ONLY in private runtimeConfig.
      contabo: {
        endpoint:
          process.env.NUXT_PUBLIC_CONTABO_ENDPOINT ||
          process.env.CONTABO_ENDPOINT ||
          process.env.NUXT_CONTABO_ENDPOINT ||
          'usc1.contabostorage.com',
        bucket:
          process.env.NUXT_PUBLIC_CONTABO_BUCKET ||
          process.env.CONTABO_BUCKET ||
          process.env.NUXT_CONTABO_BUCKET ||
          '475a29e42e55430abff00915da2fa4bc:jobupload',
        importBucket:
          process.env.NUXT_PUBLIC_CONTABO_IMPORT_BUCKET ||
          process.env.CONTABO_IMPORT_BUCKET ||
          process.env.NUXT_CONTABO_IMPORT_BUCKET ||
          '475a29e42e55430abff00915da2fa4bc:jobpsd',
        region:
          process.env.NUXT_PUBLIC_CONTABO_REGION ||
          process.env.CONTABO_REGION ||
          process.env.NUXT_CONTABO_REGION ||
          'default',
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
