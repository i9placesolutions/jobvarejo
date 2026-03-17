# Arquitetura de Storage

## Config

- Bucket: `jobvarejo` (WASABI_BUCKET)
- Endpoint: `s3.wasabisys.com` (WASABI_ENDPOINT)
- Region: `us-east-1` (WASABI_REGION)
- Path-style: `forcePathStyle: true`
- maxAttempts: 2

## Credenciais

Server-only (nuxt.config.ts runtimeConfig):
- `wasabiAccessKey` (WASABI_ACCESS_KEY)
- `wasabiSecretKey` (WASABI_SECRET_KEY)

Public (client):
- `wasabi.endpoint`, `wasabi.bucket`, `wasabi.region` (para construcao de URLs)

## S3 Client (server/utils/s3.ts)

```ts
getS3Client()       // Singleton lazy
resetS3Client()     // Destroy e nullify
getPublicUrl(key)   // URL publica do bucket
getBrandsPublicUrl(key)  // logo/{key}
getImagesPublicUrl(key)  // imagens/{key}
```

## Prefixos e permissoes

| Prefixo | Escopo | ACL |
|---------|--------|-----|
| `projects/{userId}/` | Privado (owner only) | Default |
| `imagens/` | Publico | public-read no PUT |
| `uploads/` | Publico | public-read no PUT |
| `logo/` | Publico | public-read no PUT |

## Storage Scope (server/utils/storage-scope.ts)

```ts
normalizeStoragePath(value)           // Trim, strip leading /
isValidStoragePath(value)             // No .., \, ?, #, ctrl chars, max 1024
getUserProjectsPrefix(userId)         // projects/{userId}/
isUserProjectKey(key, userId)         // Verifica ownership
isPublicStorageKey(key)               // Prefixo publico?
isStorageKeyAllowedForUser(key, userId)  // Own projects OU publico
getProjectOwnerIdFromKey(key)         // Extrai userId do path
```

## Circuit Breaker (composables/useStorage.ts)

```
WASABI_CB_MAX_FAILURES = 2
WASABI_CB_COOLDOWN_MS = 300000 (5 min)

Estados:
  CLOSED (normal) -> 2 falhas -> OPEN (bloqueia)
  OPEN -> apos 5min -> HALF-OPEN (1 probe)
  HALF-OPEN -> sucesso -> CLOSED / falha -> OPEN

Quando OPEN:
  saveCanvasData() retorna null
  DB-only fallback (canvas fica no Postgres)
```

## Rate Limits

| Endpoint | Limite | Janela | Key |
|----------|--------|--------|-----|
| presigned | 360/min | userId | |
| upload | 120/min | userId | |
| proxy | 1800/min | IP | |
| delete | 20/min | userId | |
| history | 60/min | userId | |
| history-snapshot | 120/min | userId | |
| restore | 30/min | userId | |
| recover | 30/min | userId | |
| stats | 10/min | userId (admin) | |

## Arquivos

| Arquivo | Funcao |
|---------|--------|
| `composables/useStorage.ts` | Client: circuit breaker, upload, presigned, gzip |
| `server/api/storage/presigned.post.ts` | Gera presigned PUT/GET URLs |
| `server/api/storage/upload.post.ts` | Upload via proxy server |
| `server/api/storage/proxy.get.ts` | Proxy S3 para client |
| `server/api/storage/p.get.ts` | Alias do proxy |
| `server/api/storage/delete.post.ts` | Delete por prefixo |
| `server/api/storage/history.get.ts` | Lista snapshots |
| `server/api/storage/history-snapshot.post.ts` | Cria snapshot |
| `server/api/storage/restore.post.ts` | Restaura snapshot |
| `server/api/storage/recover-latest-non-empty.post.ts` | Recupera ultimo nao-vazio |
| `server/api/storage/stats.get.ts` | Stats admin |
| `server/utils/s3.ts` | S3Client singleton |
| `server/utils/s3-object-cache.ts` | Cache in-memory de ListObjects |
| `server/utils/storage-scope.ts` | Validacao e autorizacao |
| `server/utils/project-storage-refs.ts` | Normalizacao de refs |
| `utils/storageProxy.ts` | Builder de proxy URLs (client) |
| `utils/storageRef.ts` | Extracao de S3 key de qualquer formato |
