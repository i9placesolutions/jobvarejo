# Pipeline de Upload

## Canvas JSON (saveCanvasData)

### Compressao gzip
```ts
compressGzip(text)    // CompressionStream('gzip') -> ArrayBuffer
decompressGzip(data)  // DecompressionStream('gzip') -> string
isGzipBuffer(buf)     // Magic bytes 0x1f 0x8b
```
- Content-Type: `application/octet-stream`
- Fallback para JSON plain se CompressionStream indisponivel
- Log de ratio: "Canvas comprimido: 150KB -> 30KB"

### Two-tier upload

**Tier 1: Presigned PUT direto**
- Skip se `_presignedCorsBlocked === true`
- Timeout: 20s
- Sucesso: recordWasabiSuccess() + triggerHistorySnapshot()
- CORS/TypeError: seta `_presignedCorsBlocked = true`, fallthrough

**Tier 2: Server proxy FormData**
- `POST /api/storage/upload?key={key}&contentType={ct}`
- FormData com blob do arquivo
- Timeout: 25s
- 401: retorna null (sessao expirou)

### Retry com backoff
- Default 3 tentativas (1 se half-open)
- Backoff: min(2^attempt * 1000, 8000) ms

## Asset (imagem geral) - server/api/upload.post.ts

1. Multipart, max 15MB
2. Sharp: resize 2400x2400, WebP q88
3. SVG/GIF passam sem processamento
4. SHA-256 hash -> key: `imagens/{hash16}-{safeName}.{ext}`
5. HeadObject para dedup (skip se ja existe)
6. PutObject com ACL `public-read`

## Brand logo - server/api/brands/upload.post.ts

1. Max 10MB, apenas imagens
2. Key: `logo/{sanitizedFilename}`
3. ACL: `public-read`

## Thumbnail (saveThumbnail)

1. `fetch(dataUrl)` -> Blob
2. Upload via proxy only (FormData)
3. Key: `projects/{userId}/{projectId}/thumb_{pageId}.png`
4. 2 retries, backoff 2^attempt * 1000 ms
5. Retorna proxy URL

## Presigned URL Generation

### Client (composables/useStorage.ts)
```ts
getPresignedUrl(key, contentType?, operation = 'put', retries = 2)
```
- Chama `POST /api/storage/presigned`
- Cache GET: Map com TTL 30min
- Timeout: 6s por tentativa
- Backoff: 1000 * attempt ms
- Skip retry em 401

### Server (server/api/storage/presigned.post.ts)
- Rate limit: 360/60s
- Valida key format, user scope, content-type
- PUT em keys publicos: ACL `public-read`
- Sign com expiresIn: 3600 (1 hora)
- Retorna: `{ url, bucket, region, endpoint }`

## Product Image Upload - server/api/upload-product-image.post.ts

- Uploads com key deterministic para dedup
- Fire-and-forget `saveProductImageCache()`
- Usa `uploadBufferToStorage()` helper
