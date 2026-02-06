import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  nitro: {
    preset: 'vercel',

    // Minificar o output
    minify: true,

    // Comprimir assets
    compressPublicAssets: {
      brotli: true,
      gzip: true
    },

    // CRÍTICO: Externalizar bibliotecas pesadas - NÃO incluir no bundle
    externals: {
      external: [
        'sharp',
        '@imgly/background-removal-node',
        '@imgly/background-removal',
        'canvas',
        'pngjs',
        'onnxruntime-node',
        '@onnxruntime/node',
      ]
    },

    // Rollup config para externalizar no build
    rollupConfig: {
      external: [
        'sharp',
        '@imgly/background-removal-node',
        '@imgly/background-removal',
        'canvas',
        'pngjs',
        'onnxruntime-node',
        '@onnxruntime/node',
      ]
    }
  },

  runtimeConfig: {
    // Private keys (server-side only) - WASABI
    wasabiEndpoint: process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || 's3.wasabisys.com',
    wasabiRegion: process.env.WASABI_REGION || process.env.NUXT_WASABI_REGION || 'us-east-1',
    wasabiBucket: process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo',
    wasabiAccessKey: process.env.WASABI_ACCESS_KEY || process.env.NUXT_WASABI_ACCESS_KEY || '',
    wasabiSecretKey: process.env.WASABI_SECRET_KEY || process.env.NUXT_WASABI_SECRET_KEY || '',

    // Legado - manter para compatibilidade temporária
    contaboEndpoint: process.env.CONTABO_ENDPOINT || process.env.NUXT_CONTABO_ENDPOINT || 'usc1.contabostorage.com',
    contaboRegion: process.env.CONTABO_REGION || process.env.NUXT_CONTABO_REGION || 'default',
    contaboBucket: process.env.CONTABO_BUCKET || process.env.NUXT_CONTABO_BUCKET || '475a29e42e55430abff00915da2fa4bc:jobupload',
    contaboAccessKey: process.env.CONTABO_ACCESS_KEY || process.env.NUXT_CONTABO_ACCESS_KEY || '',
    contaboSecretKey: process.env.CONTABO_SECRET_KEY || process.env.NUXT_CONTABO_SECRET_KEY || '',
    contaboBrandsBucket: process.env.CONTABO_BRANDS_BUCKET || process.env.NUXT_CONTABO_BRANDS_BUCKET || '',

    openaiApiKey: process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    serperApiKey: process.env.NUXT_SERPER_API_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

    public: {
      // Public keys (exposed to client)
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY,

      // Wasabi public config (needed for client-side URL construction)
      // IMPORTANT: These are not secrets, but they end up in the client bundle.
      // Keep access/secret keys ONLY in private runtimeConfig.
      wasabi: {
        endpoint:
          process.env.NUXT_PUBLIC_WASABI_ENDPOINT ||
          process.env.WASABI_ENDPOINT ||
          process.env.NUXT_WASABI_ENDPOINT ||
          's3.wasabisys.com',
        bucket:
          process.env.NUXT_PUBLIC_WASABI_BUCKET ||
          process.env.WASABI_BUCKET ||
          process.env.NUXT_WASABI_BUCKET ||
          'jobvarejo',
        region:
          process.env.NUXT_PUBLIC_WASABI_REGION ||
          process.env.WASABI_REGION ||
          process.env.NUXT_WASABI_REGION ||
          'us-east-1',
      }
    }
  },

  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  // Otimizações de build
  experimental: {
    payloadExtraction: false,
  },

  vite: {
    plugins: [
      tailwindcss(),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        }
      }
    }
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
