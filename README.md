# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Environment variables

Crie um arquivo `.env` com base no `.env.example`:

```bash
cp .env.example .env
```

Nunca versione o arquivo `.env` com segredos. Versione apenas `.env.example`.

Valide antes de subir/deploy:

```bash
# valida variáveis essenciais (dev)
npm run env:check

# valida stack completa (build/deploy)
npm run env:check:full
```

Sincronizar secrets para o GitHub (sem commitar `.env`):

```bash
# requer GitHub CLI autenticado (gh auth login)
npm run env:sync:github -- i9placesolutions/jobvarejo
```

Obrigatórias para rodar o editor sem 500 em rotas principais:
- `POSTGRES_DATABASE_URL` (camada de dados server-side)
- `AUTH_JWT_SECRET` (assinatura de sessão/auth)
- `WASABI_ENDPOINT`
- `WASABI_BUCKET`
- `WASABI_ACCESS_KEY`
- `WASABI_SECRET_KEY`
- `WASABI_REGION`
- `NUXT_OPENAI_API_KEY` (ou `OPENAI_API_KEY`) para `/api/parse-products` e rotas de IA

Para recuperacao de senha em producao:
- `APP_BASE_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- opcionais de branding do e-mail: `EMAIL_BRAND_NAME`, `EMAIL_LOGO_URL`, `EMAIL_SUPPORT_EMAIL`, `EMAIL_SIGNATURE_NAME`
- se `EMAIL_LOGO_URL` estiver vazio e `APP_BASE_URL` definido, a logo usada no e-mail sera `APP_BASE_URL/logo.png`

Para busca externa de imagens de produto:
- `NUXT_SERPER_API_KEY` (ou `SERPER_API_KEY`)

## Migracao para PostgreSQL (operacao)

Scripts disponiveis:
- `npm run db:smoke`
- `npm run db:sync:data`
- `bash scripts/db/set-user-password.sh` (bootstrap de senha local para usuario migrado)

Variaveis de ambiente usadas por esses scripts:
- `SOURCE_DATABASE_URL` (origem Supabase)
- `TARGET_DATABASE_URL` (destino PostgreSQL/Coolify)

Exemplo:
```bash
export SOURCE_DATABASE_URL='postgresql://postgres:...@db.<project-ref>.supabase.co:5432/postgres?sslmode=require'
export TARGET_DATABASE_URL='postgresql://postgres:...@<host>:<port>/postgres?sslmode=disable'
npm run db:smoke
npm run db:sync:data
```

Runbook completo: `database/POSTGRES_CUTOVER.md`.

Observacao: os endpoints server-side de `auth`, `projects`, `folders`, `notifications`, `profile(s)`, `asset_names`, `asset_folders`, `label_templates`, `product_image_cache` e rotas de historico/restore (`/api/storage/history*`, `/api/storage/restore`, `/api/storage/recover-latest-non-empty`) usam PostgreSQL nativo.

Para auth local (sem Supabase Auth), aplique tambem:
- `database/auth_local_password_migration.sql`
- se necessario, defina senha local por usuario com `scripts/db/set-user-password.sh`

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
