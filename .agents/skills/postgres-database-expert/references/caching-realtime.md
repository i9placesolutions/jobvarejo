# Camadas de Cache e Realtime

## Camadas de cache (da mais rapida para a mais persistente)

### L1: In-Memory Profile Cache (server/utils/auth.ts)
- `Map<userId, { profile, expiresAt }>`
- TTL: 5 minutos
- Usado em todo `requireAuthenticatedUser()` (toda request)

### L2: In-Memory S3 Object Cache (server/utils/s3-object-cache.ts)
- `Map<cacheKey, { data, expiresAt, inFlight }>`
- TTL: 120 segundos
- Dedup de requests concorrentes via inFlight promise
- Stale-while-error: serve dados velhos por 15s em caso de falha
- Usado por `assets.get.ts` para listar prefixos S3

### L3: In-Memory Product Memos (server/api/process-product-image.post.ts)
- `userAssetNamesMemo`: Map com TTL para nomes de assets por usuario
- `aiVariantsMemo`: Map com TTL 120s para variantes AI de busca

### L4: In-Memory Schema-Ready Flags
- `authColumnsEnsured` (boolean) em auth-db.ts
- `registrySchemaReady` / `registryDisabled` em product-image-registry.ts
- Evitam DDL checks repetidos

### L5: Redis (server/utils/redis.ts)
- Singleton ioredis com lazy-connect
- `connectTimeout: 4000ms`, `commandTimeout: 2000ms`, `maxRetriesPerRequest: 1`
- Keys de cache: `img:{normalizedTerm}` com TTL 86400s (24h)
- Keys de rate-limit: `rl:{key}` com INCR + EXPIRE pipeline
- **Best-effort**: nunca lanca excecao, retorna null em falha
- Fallback: rate limiting in-memory

### L6: PostgreSQL - product_image_cache
- Tabela persistente de imagens resolvidas
- `usage_count` para popularidade
- Query: `WHERE search_term = $1 ORDER BY usage_count DESC`

### L7: PostgreSQL - product_image_registry
- Imagens curadas/validadas
- Status workflow: review_pending -> approved/rejected
- Consultada antes de fontes externas

## LISTEN/NOTIFY Realtime

### Canal
- `project_changes`

### Publicacao
```ts
await pgQuery('SELECT pg_notify($1, $2)', ['project_changes', JSON.stringify(payload)])
```

### Payload
```ts
{
  projectId: string,
  userId: string,
  action: 'created' | 'updated' | 'deleted',
  updatedAt: string,
  actorClientId?: string
}
```

### Listener (server/utils/project-realtime.ts)
- `PoolClient` dedicado mantido aberto para `LISTEN`
- EventEmitter (`projectChangesBus`, max 250 listeners)
- Auto-reconnect em 1500ms apos erro
- Lifecycle lazy: inicia no primeiro subscribe, para quando todos desconectam

### SSE Endpoint (server/api/projects/realtime.get.ts)
- `createEventStream()` do h3
- Filtra por userId, projectId opcional, clientId (ignora proprias acoes)
- Heartbeat de 10 segundos
- Cleanup: clearInterval + unsubscribe + stream.close

### Transporte client
- SSE (padrao local) via `new EventSource('/api/projects/realtime?...')`
- Polling (Vercel) - configuravel via `projectRealtimeTransport: 'poll'`
