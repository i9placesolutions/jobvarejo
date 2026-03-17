# Mapa de Arquivos por Area

## Framework / Config
- `nuxt.config.ts` - configuracao central (Nitro, Vite, runtime, routeRules)
- `app.vue` - root component (NuxtLayout > NuxtPage)
- `vercel.json` - deploy Vercel
- `Dockerfile` - deploy Docker
- `assets/css/main.css` - CSS global
- `lib/utils.ts` - cn() helper (clsx + tailwind-merge)

## Pages
- `pages/index.vue` - dashboard
- `pages/editor/[id].vue` - editor canvas
- `pages/profile.vue` - perfil usuario
- `pages/auth/*.vue` - fluxo de autenticacao
- `pages/admin/storage.vue` - admin storage

## Composables (auto-imported)
- `composables/useAuth.ts` - auth state
- `composables/useApiAuth.ts` - auth headers SSR
- `composables/useProject.ts` - estado projeto (1816 linhas)
- `composables/useStorage.ts` - Wasabi S3 (804 linhas)
- `composables/useFolder.ts` - pastas
- `composables/useProductZone.ts` - zonas de produto (722 linhas)
- `composables/useProductProcessor.ts` - pipeline imagens (1042 linhas)
- `composables/useProductLayout.ts` - cards Fabric.js (649 linhas)
- `composables/useUpload.ts` - upload
- `composables/useProgressivePreviewLoader.ts` - lazy loading (405 linhas)
- `composables/useFigmaCrop.ts` - crop Figma
- `composables/useAiImageStudio.ts` - modal AI
- `composables/useResponsive.ts` - breakpoints

## Middleware
- `middleware/auth.ts` - protecao de rota client
- `middleware/admin.ts` - protecao admin client

## Server Utils (auto-imported no server)
- `server/utils/postgres.ts` - pool PG, pgQuery, pgOneOrNull, pgTx
- `server/utils/auth.ts` - requireAuthenticatedUser, requireAdminUser
- `server/utils/auth-db.ts` - operacoes auth no DB
- `server/utils/session-token.ts` - JWT/HMAC
- `server/utils/password.ts` - scrypt hashing
- `server/utils/rate-limit.ts` - rate limiting Redis+memory
- `server/utils/redis.ts` - ioredis singleton
- `server/utils/s3.ts` - S3Client singleton
- `server/utils/email.ts` - nodemailer SMTP
- `server/utils/storage-scope.ts` - autorizacao storage
- `server/utils/jsonb.ts` - sanitizacao JSONB
- `server/utils/url-safety.ts` - SSRF protection
- `server/utils/openai-images.ts` - OpenAI image gen/edit
- `server/utils/product-image-*.ts` - pipeline de imagem de produto

## Server API
- `server/api/auth/*.ts` - 7 endpoints auth
- `server/api/ai/**/*.ts` - 4 endpoints AI
- `server/api/storage/*.ts` - 10 endpoints storage
- `server/api/projects*.ts` - CRUD projetos
- `server/api/projects/realtime.get.ts` - SSE
- `server/api/folders*.ts` - CRUD pastas
- `server/api/assets*.ts` - gestao assets
- `server/api/notifications*.ts` - notificacoes
- `server/api/label-templates*.ts` - templates etiqueta
- `server/api/parse-products.post.ts` - parsing AI
- `server/api/process-product-image.post.ts` - pipeline imagem
- `server/api/remove-image-bg.post.ts` - remocao fundo

## Componentes
- `components/EditorCanvas.vue` - editor principal (37K linhas)
- `components/ui/*.vue` - componentes base (Button, Dialog, Input, etc)
- `components/ProjectManager.vue` - CRUD projetos UI
- `components/SplashRenderer.vue` - etiquetas de preco
- `components/AiImageStudioModal.vue` - modal AI (658 linhas)

## Utils Client
- `utils/editorCanvas*.ts` - serializacao, estado, pre-serialize
- `utils/editorHistory*.ts` - undo/redo
- `utils/editorPage*.ts` - multi-pagina
- `utils/editorSave*.ts` - politica de save
- `utils/editorExportPipeline.ts` - export PNG/PDF/ZIP
- `utils/editorSelection*.ts` - selecao, snapshot, text ops
- `utils/product-zone-*.ts` - helpers zona de produto
- `utils/storageProxy.ts` - proxy URLs Wasabi
- `utils/canvasAssetUrls.ts` - normalizacao URLs canvas

## AI
- `src/ai/aiTypes.ts` - tipos AI
- `src/ai/aiPrompt.ts` - builder de prompts
- `src/ai/aiZodSchemas.ts` - validacao Zod
- `src/ai/aiGenerateCanvasData.ts` - geracao canvas
- `src/ai/aiApplyToProject.ts` - aplicacao ao projeto

## Types
- `types/auth.ts` - user roles, profile
- `types/project.ts` - project, page, canvas
- `types/product-zone.ts` - product, splash, zone (1126 linhas)
- `types/folder.ts` - folder
- `types/label-template.ts` - label template

## Database
- `database/*.sql` - 11 migracoes
- `database/POSTGRES_CUTOVER.md` - runbook migracao

## Scripts
- `scripts/db/*.sh` - smoke-test, sync, set-password
- `scripts/check-*.sh` - bundle size checks
