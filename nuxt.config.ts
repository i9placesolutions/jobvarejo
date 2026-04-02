import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devServer: {
    port: 80,
  },
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow:wght@100;200;300;400;500;600;700;800;900&display=swap'
        }
      ]
    }
  },

  nitro: {
    preset: 'node-server',

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
    },

    routeRules: {
      '/api/parse-products': {
        headers: { 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' }
      },
      '/api/projects': {
        headers: { 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' }
      },
      '/api/storage/upload': {
        headers: { 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' }
      },
      '/api/builder/storage/upload': {
        headers: { 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' }
      }
    }
  },

  runtimeConfig: {
    // Private keys (server-side only) - WASABI
    wasabiEndpoint: process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || 's3.wasabisys.com',
    wasabiRegion: process.env.WASABI_REGION || process.env.NUXT_WASABI_REGION || 'us-east-1',
    wasabiBucket: process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo',
    wasabiAccessKey: process.env.WASABI_ACCESS_KEY || process.env.NUXT_WASABI_ACCESS_KEY || '',
    wasabiSecretKey: process.env.WASABI_SECRET_KEY || process.env.NUXT_WASABI_SECRET_KEY || '',
    redisUrl: process.env.REDIS_URL || process.env.NUXT_REDIS_URL || '',

    // Canva Connect API
    canvaAccessToken: process.env.CANVA_ACCESS_TOKEN || process.env.NUXT_CANVA_ACCESS_TOKEN || '',
    canvaRefreshToken: process.env.CANVA_REFRESH_TOKEN || '',
    canvaClientId: process.env.CANVA_CLIENT_ID || '',
    canvaClientSecret: process.env.CANVA_CLIENT_SECRET || '',

    openaiApiKey: process.env.NUXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.NUXT_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    parseProductsTimeoutMs:
      process.env.PARSE_PRODUCTS_TIMEOUT_MS ||
      process.env.NUXT_PARSE_PRODUCTS_TIMEOUT_MS ||
      (process.env.VERCEL ? '55000' : '90000'),

    googleCseApiKey:
      process.env.NUXT_GOOGLE_CSE_API_KEY ||
      process.env.GOOGLE_CSE_API_KEY ||
      '',
    googleCseCx:
      process.env.NUXT_GOOGLE_CSE_CX ||
      process.env.GOOGLE_CSE_CX ||
      '',
    authJwtSecret: process.env.AUTH_JWT_SECRET || '',
    authTokenTtlSeconds: process.env.AUTH_TOKEN_TTL_SECONDS || '604800',
    authResetTokenTtlMinutes: process.env.AUTH_RESET_TOKEN_TTL_MINUTES || '60',
    appBaseUrl: process.env.APP_BASE_URL || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpSecure: process.env.SMTP_SECURE || 'false',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || '',
    postgresDatabaseUrl:
      process.env.POSTGRES_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.NUXT_POSTGRES_DATABASE_URL ||
      process.env.TARGET_DATABASE_URL ||
      '',

    public: {
      projectRealtimeTransport:
        process.env.NUXT_PUBLIC_PROJECT_REALTIME_TRANSPORT ||
        (process.env.VERCEL ? 'poll' : 'auto'),
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
  devtools: { enabled: process.env.NUXT_DEVTOOLS === 'true' },

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
          manualChunks(id) {
            // Keep Vite preload helper out of feature chunks to avoid
            // accidentally turning a lazy chunk into a global dependency.
            if (id.includes('vite/preload-helper')) return 'app-preload-helper'

            // Editor local code splitting (non-node_modules)
            if (id.includes('/components/EditorCanvas.vue')) return 'editor-canvas'
            if (
              id.includes('/types/product-zone.ts') ||
              id.includes('/composables/useProductZone.ts') ||
              id.includes('/utils/product-zone-helpers')
            ) return 'editor-product-zone'
            if (
              id.includes('/src/ai/') ||
              id.includes('/server/utils/ai-') ||
              id.includes('/server/utils/openai-')
            ) return 'editor-ai'
            if (
              id.includes('/composables/useProject.ts') ||
              id.includes('/composables/useStorage.ts')
            ) return 'editor-project-storage'

            if (!id.includes('node_modules')) return

            if (id.includes('/fabric/')) return 'vendor-fabric'
            if (id.includes('/lucide-vue-next/')) return 'vendor-icons'
            if (id.includes('/@aws-sdk/')) return 'vendor-aws'
            if (id.includes('/openai/')) return 'vendor-openai'
            if (id.includes('/xlsx/')) return 'vendor-xlsx'
            if (id.includes('/pdf-parse/')) return 'vendor-pdf'
            if (
              id.includes('/vue/') ||
              id.includes('/vue-router/') ||
              id.includes('/@vue/')
            ) return 'vendor-vue'
          },
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
    '/builder/**': {
      ssr: false,
    },
    '/api/storage/upload': {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    '/api/projects/**': {
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
