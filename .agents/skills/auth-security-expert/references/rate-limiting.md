# Rate Limiting

## Engine (server/utils/rate-limit.ts)

### Funcao principal
```ts
enforceRateLimit(event: H3Event, key: string, limit: number, windowMs: number): void
```

> Sincrona — nao retorna Promise. `await` e aceito mas desnecessario.

### Estrategia: in-memory only (por instancia de servidor)

- `Map<string, { count, resetAt }>`
- Max 5000 buckets (FIFO eviction em overflow)
- Auto-prune a cada 30s
- Per-process (nao compartilhado entre instancias)

### Response headers (sempre)
- `X-RateLimit-Limit`: limite
- `X-RateLimit-Remaining`: restante
- `X-RateLimit-Reset`: epoch de reset

### 429 Too Many Requests
- `Retry-After` header (segundos ate reset)
- `createError({ statusCode: 429 })`

## Redis Client (server/utils/redis.ts)

```ts
getRedis(): Redis | null     // Singleton lazy, null se nao configurado
pingRedis(): Promise<boolean>
redisGet(key): Promise<string | null>
redisSetex(key, ttl, value): Promise<void>
redisRateLimit(key, windowSeconds): Promise<{ count, ttl }>
```

Config:
- `connectTimeout: 4000ms`
- `commandTimeout: 2000ms`
- `maxRetriesPerRequest: 1`
- Retry: 3x com backoff exponencial
- `enableOfflineQueue: false`
- **Best-effort**: nunca throw, retorna null/false

## Valores por endpoint

### Auth (por IP)
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| Login | `auth-login:<ip>` | 30 | 60s |
| Register | `auth-register:<ip>` | 20 | 60s |
| Logout | `auth-logout:<ip>` | 120 | 60s |
| Forgot Password | `auth-forgot-password:<ip>` | 15 | 60s |
| Reset Password | `auth-reset-password:<ip>` | 20 | 60s |
| First User | `auth-first-user:<ip>` | 120 | 60s |

### Auth (por userId)
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| Session | `auth-session:<userId>` | 300 | 60s |

### Storage (por userId)
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| Presigned | `storage-presigned:<userId>` | 360 | 60s |
| Upload | `storage-upload:<userId>` | 120 | 60s |
| Delete | `storage-delete:<userId>` | 20 | 60s |
| History | `storage-history:<userId>` | 60 | 60s |
| History Snapshot | `storage-snapshot:<userId>` | 120 | 60s |
| Restore | `storage-restore:<userId>` | 30 | 60s |
| Recover | `storage-recover:<userId>` | 30 | 60s |
| Stats (admin) | `storage-stats:<userId>` | 10 | 60s |

### Storage (por IP)
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| Proxy | `storage-proxy:<ip>` | 1800 | 60s |

### AI (por userId)
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| Canvas Generate | `ai-canvas:<userId>` | 8 | 60s |
| Image Generate | `ai-image-gen:<userId>` | 20 | 60s |
| Image Edit | `ai-image-edit:<userId>` | 20 | 60s |
| Site Describe | `ai-site:<userId>` | 40 | 60s |
| BG Removal | `bg-remove:<userId>` | 20 | 60s |

### Outros (por userId)
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| Profile | `profile-get:<userId>` | 240 | 60s |
| Upload geral | `upload:<userId>` | 40 | 60s |
| Brands upload | `brands-upload:<userId>` | 30 | 60s |
| Assets delete | `assets-delete:<userId>` | 60 | 60s |
