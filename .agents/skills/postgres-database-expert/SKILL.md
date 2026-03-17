---
name: postgres-database-expert
description: "Especialista em PostgreSQL para o projeto JobVarejo. Use quando Codex precisar criar ou modificar migracoes SQL, queries parametrizadas, transacoes, LISTEN/NOTIFY realtime, connection pooling, caching em camadas (memory/Redis/DB), JSONB, operacoes de banco, ou resolver problemas de performance e integridade de dados."
---

# PostgreSQL Database Expert

## Objetivo

Operar sobre a camada de dados do JobVarejo: PostgreSQL nativo via driver `pg` sem ORM.
Preservar os padroes de query, caching e seguranca ja estabelecidos.

## Inicio rapido

1. Ler o arquivo alvo e [references/schema.md](references/schema.md).
2. Classificar o pedido:
   - Query/endpoint: ler [references/query-patterns.md](references/query-patterns.md).
   - Migracao: ler [references/migrations.md](references/migrations.md).
   - Realtime/cache: ler [references/caching-realtime.md](references/caching-realtime.md).
3. Validar com SQL parametrizado e testar manualmente.

## Regras de operacao

- 100% raw SQL parametrizado com `$1, $2, ...`. Nao usar ORM, Prisma, Drizzle ou Knex.
- Tres funcoes cobrem tudo: `pgQuery`, `pgOneOrNull`, `pgTx`.
- Pool singleton lazy com max 10-30 conexoes, idle 30s, connect timeout 10s.
- JSONB deve ser sanitizado via `stringifyJsonbParam()` (remove NUL bytes e lone surrogates).
- Upserts usam `ON CONFLICT ... DO UPDATE`. Nao usar `INSERT ... SELECT ... WHERE NOT EXISTS`.
- Queries dinamicas usam pattern `pushParam()` para SET clauses seguros.
- Missing table detection: capturar error code `42P01` para degradacao graceful.
- Migracoes sao arquivos SQL em `database/`. Nao usar migration framework.
- Trigger `prevent_empty_canvas_overwrite` protege contra perda de dados. Nao desabilitar.

## Trilhas de uso

### Criar endpoint com query

1. `requireAuthenticatedUser(event)` para autenticacao.
2. `enforceRateLimit(event, key, limit, windowMs)` para rate limiting.
3. Query via `pgQuery<T>(sql, params)` ou `pgOneOrNull<T>(sql, params)`.
4. JSONB via `stringifyJsonbParam()` e `parseAndStringifyJsonbParam()`.
5. Erros com `createError({ statusCode, statusMessage })`.

### Criar migracao SQL

1. Criar arquivo em `database/nome_descritivo_migration.sql`.
2. Incluir `CREATE TABLE IF NOT EXISTS` ou `ALTER TABLE`.
3. Adicionar indices para colunas filtradas.
4. Incluir RLS policies se aplicavel.
5. Incluir triggers de `updated_at` se necessario.
6. Testar manualmente com `psql`.

### Modificar realtime

1. Canal unico: `project_changes`.
2. Publicar via `pgQuery('SELECT pg_notify($1, $2)', [channel, payload])`.
3. Listener usa `PoolClient` dedicado com auto-reconnect.
4. SSE endpoint filtra por userId, projectId, clientId.

### Adicionar cache

1. Nivel 1: in-memory Map com TTL (5min perfil, 2min S3 objects).
2. Nivel 2: Redis com TTL (24h para imagens).
3. Nivel 3: tabela PostgreSQL (product_image_cache, product_image_registry).
4. Todos sao best-effort: falha de cache nao bloqueia operacao.

## Entregas obrigatorias

### Para mudancas de codigo

1. SQL exato com parametros
2. Indices necessarios
3. Impacto em tabelas existentes
4. Caching afetado
5. Como validar (query manual, endpoint test)

### Para migracoes

1. SQL completo
2. Rollback strategy
3. Impacto em dados existentes
4. RLS e triggers necessarios
5. Teste de idempotencia

## Referencias

- [references/schema.md](references/schema.md): tabelas, colunas e relacoes.
- [references/query-patterns.md](references/query-patterns.md): padroes de query obrigatorios.
- [references/migrations.md](references/migrations.md): migracoes existentes e runbook.
- [references/caching-realtime.md](references/caching-realtime.md): camadas de cache e LISTEN/NOTIFY.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual tabela e colunas foram afetadas
- se o SQL e parametrizado e seguro
- se caching e indices estao adequados
- como validar os dados
