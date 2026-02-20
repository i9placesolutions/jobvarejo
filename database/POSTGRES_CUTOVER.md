# Cutover Supabase -> PostgreSQL (Coolify)

## Premissas
- O schema já foi migrado para o destino.
- O app já usa PostgreSQL nativo para dados e auth local (JWT + `public.profiles`).
- Este roteiro cobre sincronizacao de dados e validacao.

## Variaveis necessarias
Defina no shell:

```bash
export SOURCE_DATABASE_URL='postgresql://postgres:...@db.<project-ref>.supabase.co:5432/postgres?sslmode=require'
export TARGET_DATABASE_URL='postgresql://postgres:...@<coolify-host>:<coolify-port>/postgres?sslmode=disable'
```

## 1) Smoke test inicial
```bash
bash scripts/db/smoke-test.sh
```

## 2) Janela de corte (downtime curto)
1. Coloque o app em modo manutencao (ou bloqueie escrita).
2. Rode sync incremental de dados:

```bash
bash scripts/db/incremental-sync-data.sh
```

3. Confirme no output que os diffs ficaram vazios.

## 3) Pos-corte
1. Execute smoke test novamente:

```bash
bash scripts/db/smoke-test.sh
```

2. Valide fluxos criticos da aplicacao (login, upload, listagens).

3. Aplique migration de auth local (se ainda nao aplicou):

```bash
psql "$TARGET_DATABASE_URL" -f database/auth_local_password_migration.sql
```

4. Defina senha local para contas migradas que ainda estao sem `password_hash`:

```bash
export EMAIL='admin@empresa.com'
export PASSWORD='SenhaForteAqui'
bash scripts/db/set-user-password.sh
```

Observacao: se voce rodar `db:sync:data` novamente, ele pode sobrescrever `public.profiles`.
Nesse caso, execute o passo 4 novamente no final do corte.

## Observacao importante
- O reset de senha via `/auth/forgot-password` atualmente gera link de reset em modo desenvolvimento.
- Para producao, integre envio de e-mail (SMTP/transacional) no endpoint `server/api/auth/forgot-password.post.ts`.
