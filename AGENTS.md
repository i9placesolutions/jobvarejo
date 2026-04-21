# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Comandos de Desenvolvimento

```bash
# Instalar dependencias
npm install

# Servidor de desenvolvimento (porta 80)
npm run dev

# Build de producao
npm run build

# Typecheck (Nuxt integrado com vue-tsc)
npm run typecheck

# Verificar tamanho do bundle client
npm run check:client-chunk

# Build + check client chunk (CI gate)
npm run check

# Validar variaveis de ambiente (dev)
npm run env:check

# Validar variaveis de ambiente (build/deploy)
npm run env:check:full

# Preview de producao local
npm run preview
```

Nao ha framework de teste configurado (sem jest/vitest/playwright). Validacao e feita via typecheck + build.

## Stack Tecnica

- **Framework**: Nuxt 4 (Vue 3 Composition API, Nitro server)
- **Canvas**: Fabric.js 7 (editor grafico vetorial/raster)
- **Styling**: Tailwind CSS 4 (plugin Vite)
- **Database**: PostgreSQL nativo (driver `pg`, sem ORM)
- **Storage**: Wasabi S3 (compativel AWS SDK v3)
- **Cache/Realtime**: Redis (ioredis) + LISTEN/NOTIFY PostgreSQL
- **AI**: OpenAI SDK (parsing de produtos, geracao de imagens com gpt-image-1)
- **PDF**: pdf-lib (geracao), pdf2json (parsing)
- **Auth**: JWT customizado (scrypt hashing, sem Supabase Auth)
- **Deploy**: Coolify (Docker, node-server preset) / Vercel (fallback)

## Arquitetura de Alto Nivel

### Client-side (CSR)

O editor roda **sem SSR** (`ssr: false` para `/editor/**` e `/builder/**`). Paginas publicas (index, auth) usam SSR.

```
pages/
  index.vue              # Dashboard com ProjectManager
  editor/[id].vue        # Editor principal (Fabric.js canvas)
  builder/               # Builder de encartes (sistema separado)
    [id].vue             # Editor do builder
    index.vue            # Lista de projetos builder
    products.vue         # Gestao de produtos builder
  auth/                  # Login/Register/Forgot/Reset
  admin/                 # Painel admin (requer role admin)
  profile.vue            # Perfil do usuario
```

### Composables Principais

| Composable | Responsabilidade |
|---|---|
| `useProject` | Estado global singleton do projeto (pages, save/load, autosave, drafts locais, realtime) |
| `useStorage` | Upload/download Wasabi S3 com gzip, presigned URLs, circuit breaker, proxy fallback |
| `useProductZone` | Estado da zona de produtos (grid, splashes, estilos globais, undo/redo interno) |
| `useAuth` | Sessao do usuario (cookie httpOnly + flag `authenticated`) |
| `useApiAuth` | Headers de autenticacao para chamadas fetch ao server |
| `useAiImageStudio` | Modal de geracao/edicao de imagens com IA |
| `useFigmaCrop` | Overlay de crop estilo Figma |

### EditorCanvas.vue (~40.000 linhas)

Componente monolitico que contem toda a logica do editor Fabric.js:

- **Frames**: Sistema de containers Figma-like (`isFrame`, `parentFrameId`, clipping recursivo)
- **Product Zones**: Zonas de grid para encarte (renderiza produtos como cards Fabric)
- **Label Templates**: Etiquetas de preco (splash) customizaveis, persistidas no banco e no JSON do projeto
- **History (Undo/Redo)**: Stack local por pagina, serializa/deserializa canvas JSON
- **Export**: PNG, PDF (multi-pagina), ZIP; via `editorExportPipeline.ts`
- **Persistence**: autosave com debounce, gzip antes de upload, fingerprint para evitar saves inuteis
- **Lazy Frames**: Frames invisives tem filhos removidos do loadFromJSON e restaurados on-demand

### Utils do Editor (`utils/editor*.ts`)

Logica extraida do EditorCanvas para reutilizacao e testabilidade:

| Arquivo | Funcao |
|---|---|
| `editorCanvasState.ts` | Fingerprint do canvas, viewport transform |
| `editorCanvasSerialize.ts` | Serializa canvas para JSON (com extra props) |
| `editorCanvasPreSerialize.ts` | Pre-processamento antes de serializar |
| `editorExportPipeline.ts` | Export PNG/PDF/ZIP com multiplier e qualidade |
| `editorHistoryState.ts` | Estado do undo/redo |
| `editorHistoryListeners.ts` | Listeners Fabric que disparam history save |
| `editorHistoryApply.ts` | Aplica estado do history ao canvas |
| `editorHistoryNavigation.ts` | Navega no stack de history |
| `editorPagePersistence.ts` | Persiste estado serializado de uma pagina |
| `editorSavePolicy.ts` | Regras de quando permitir/pular autosave |
| `editorRenderScheduler.ts` | Coalesced RAF para evitar renders duplicados |
| `editorSelectionRuntime.ts` | Sync de selecao com UI (floating toolbar, etc.) |
| `editorThumbnail.ts` | Gera thumbnails offscreen |

### Server-side (Nitro)

```
server/
  api/                   # Endpoints REST
    auth/                # Login, register, session, forgot/reset password
    projects/            # CRUD projetos, realtime SSE, revision polling
    storage/             # Upload/download/presigned, historico, restore
    builder/             # CRUD builder (produtos, temas, layouts, cards)
    ai/                  # Endpoints de IA
    parse-products.post  # Parser de listas de oferta (GPT streaming)
  utils/
    postgres.ts          # Pool singleton, pgQuery, pgOneOrNull, pgTx
    auth.ts              # requireAuthenticatedUser, requireAdminUser
    s3.ts                # Client S3 (Wasabi)
    redis.ts             # Conexao Redis
    rate-limit.ts        # Rate limiting (Redis + memory fallback)
    session-token.ts     # JWT sign/verify (HMAC)
    password.ts          # scrypt hash/verify
    email.ts             # Nodemailer SMTP
    product-image-*.ts   # Pipeline de busca/cache de imagens de produto
  middleware/
    vercel-skew-protection.ts
```

### Database

Migracoes SQL em `database/`. Nao ha migration runner automatico — scripts sao aplicados manualmente.

Tabelas principais: `profiles`, `projects`, `folders`, `notifications`, `label_templates`, `asset_names`, `asset_folders`, `product_image_cache`, `builder_*` (card_templates, flyers, themes, etc.)

### Modelo de Dados do Projeto

```typescript
interface Project {
  id: string           // UUID
  name: string
  pages: Page[]        // Multi-pagina
  activePageIndex: number
}

interface Page {
  id: string
  name: string
  width: number        // Tipicamente 1080
  height: number       // Tipicamente 1350
  type: 'RETAIL_OFFER' | 'FREE_DESIGN'
  canvasData: any      // JSON Fabric.js (em memoria)
  canvasDataPath?: string  // Caminho no S3 (salvo no banco)
}
```

O `canvasData` e comprimido com gzip antes do upload para Wasabi. O banco armazena apenas `canvasDataPath` (referencia S3), nao o JSON cru.

### Fluxo de Persistencia

1. Usuario edita canvas → `triggerAutoSave()` (debounce 3-5s)
2. `saveProjectDB()`:
   - Serializa canvas com props extras
   - Comprime JSON com gzip (browser CompressionStream)
   - Upload para Wasabi (presigned URL → fallback proxy)
   - Gera thumbnail offscreen → upload thumbnail
   - PATCH `/api/projects` com metadata + paths
3. Fallback: draft local em localStorage (sobrevive falha de rede)
4. Circuit breaker: apos N falhas consecutivas, pula Wasabi temporariamente

### Realtime

- Primeira tentativa: SSE (`/api/projects/realtime`)
- Fallback: polling (`/api/projects/revision`) a cada 20s
- Configuravel via `NUXT_PUBLIC_PROJECT_REALTIME_TRANSPORT` (auto|sse|poll)

## Variaveis de Ambiente Obrigatorias

Para desenvolvimento minimo funcional:
- `POSTGRES_DATABASE_URL`
- `AUTH_JWT_SECRET`
- `WASABI_ENDPOINT`, `WASABI_BUCKET`, `WASABI_ACCESS_KEY`, `WASABI_SECRET_KEY`, `WASABI_REGION`
- `NUXT_OPENAI_API_KEY` (para parsing de produtos e IA)

## Convencoes do Projeto

- **Idioma do codigo**: Variaveis/funcoes em ingles, comentarios e mensagens de usuario em portugues
- **Commits**: Em portugues
- **Sem ORM**: Queries SQL parametrizadas diretas via `pgQuery`/`pgTx`
- **Sem framework de teste**: Validacao via typecheck + build
- **Fabric.js 7**: Usa monkey-patches e propriedades customizadas (`isFrame`, `parentFrameId`, `_customId`, `isSmartObject`, `_zoneGlobalStyles`)
- **Autoimports Nuxt**: `$fetch`, `useRuntimeConfig`, `defineEventHandler`, `createError`, `getCookie`, `getHeader`, `navigateTo`, `useState`, `useRoute` etc. estao disponiveis sem import explicito
- **Storage**: Arquivos no Wasabi seguem pattern `{userId}/{projectId}/pages/{pageId}/canvas.json.gz`
- **Code splitting**: Chunks manuais em `nuxt.config.ts` (vendor-fabric, vendor-aws, editor-canvas, etc.)
