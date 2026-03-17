# Arquitetura Nuxt/Vue do JobVarejo

## Stack

- Nuxt 4.2.2 (Vue 3.5.27, Vue Router 4.6.4)
- Nitro (preset: node-server)
- Tailwind CSS 4.1.18 (via @tailwindcss/vite)
- TypeScript
- Fabric.js 7.1.0 (canvas editor)

## Estrutura de pastas

```
app.vue                   # Root: NuxtLayout > NuxtPage (page-key = fullPath)
nuxt.config.ts            # Config central (Nitro, Vite, runtime, routeRules)
vercel.json               # Deploy Vercel
Dockerfile                # Deploy Docker/Coolify

pages/
  index.vue               # Dashboard (ssr:false, middleware:auth)
  profile.vue             # Perfil (ssr:false, middleware:auth)
  editor/[id].vue         # Editor canvas (ssr:false, ClientOnly, defineAsyncComponent)
  auth/login.vue          # Login (SSR, layout:auth)
  auth/register.vue       # Registro (SSR, layout:auth)
  auth/forgot-password.vue
  auth/reset-password.vue
  admin/storage.vue       # Admin (middleware:[auth,admin])
  terms.vue, privacy.vue  # Legais (SSR, layout:auth)

composables/              # 13 composables (auto-imported)
  useAuth.ts              # Auth state (useState SSR-safe)
  useApiAuth.ts           # Auth headers SSR/client
  useProject.ts           # Estado do projeto (1816 linhas, singleton reactive)
  useStorage.ts           # Wasabi S3 (804 linhas, circuit breaker)
  useFolder.ts            # Pastas
  useProductZone.ts       # Zonas de produto
  useProductProcessor.ts  # Pipeline de imagens
  useProductLayout.ts     # Cards Fabric.js
  useUpload.ts            # Upload de arquivos
  useProgressivePreviewLoader.ts  # Lazy loading com IntersectionObserver
  useFigmaCrop.ts         # Crop estilo Figma
  useAiImageStudio.ts     # Modal AI Image
  useResponsive.ts        # Breakpoints responsivos

middleware/
  auth.ts                 # Protecao de rota (client-only)
  admin.ts                # Protecao admin (client-only)

server/
  api/                    # ~39 endpoints
    auth/                 # 7 endpoints (login, register, logout, session, etc)
    ai/                   # AI (canvas, image, site)
    storage/              # 10 endpoints (upload, presigned, proxy, etc)
    projects/             # Realtime, revision, beacon-save
  utils/                  # 27 utilidades server-side
  middleware/             # Vercel skew protection

components/               # 35+ componentes (auto-registrados)
  EditorCanvas.vue        # 37K linhas - editor Fabric.js
  ui/                     # Button, Dialog, Input, etc (shadcn-style)

utils/                    # 25 utilidades client-side (editor)
types/                    # TypeScript (auth, project, product-zone, folder, label-template)
src/ai/                   # Modulo AI compartilhado
```

## Nitro Config

- Preset: `node-server`
- Externals: sharp, @imgly/background-removal-node, canvas, pngjs, onnxruntime-node
- Compressao: brotli + gzip para assets publicos
- Minificacao: habilitada

## Runtime Config

### Server-only (privado)
- wasabi*: credenciais S3
- redisUrl: cache/rate-limit
- openaiApiKey: IA
- authJwtSecret, authTokenTtlSeconds
- smtp*: email
- postgresDatabaseUrl: banco

### Public (client)
- wasabi.endpoint/bucket/region: construcao de URLs
- projectRealtimeTransport: 'poll' (Vercel) ou 'auto'

## Route Rules

- `/editor/**`: ssr:false + COOP/COEP headers
- `/api/storage/upload`, `/api/projects/**`, `/**`: COOP + COEP headers

## Vite Manual Chunks

- editor-canvas, editor-product-zone, editor-ai, editor-project-storage
- vendor-fabric, vendor-icons, vendor-aws, vendor-openai, vendor-xlsx, vendor-pdf, vendor-vue
- app-preload-helper

## Deploy

- Vercel (primario): build com 4GB memoria, bundle otimizado
- Docker: multi-stage Node 22 Alpine (Coolify/Contabo)
- CI/CD: nenhum configurado (deploy manual)
