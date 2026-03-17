# Proxy e Assets

## Proxy Server (server/api/storage/proxy.get.ts)

```
GET /api/storage/proxy?key={key}&bucket={bucket}&v={version}
GET /api/storage/p?key={key}  (alias, evita adblocker pattern "proxy")
```

### Autenticacao
- `projects/` + `.json`: requer auth + ownership check
- Keys publicos (`imagens/`, `uploads/`, `logo/`): por rate limit IP (1800/60s)

### Cache-Control
- JSON: `no-store`
- Com versao (`v` param): `public, max-age=31536000, immutable`
- Sem versao: `public, max-age=60, must-revalidate`

### Missing image fallback
Retorna 1x1 PNG transparente (base64 constante) em vez de 404 para imagens.
Previne quebra de renderizacao do canvas.

### Headers
- `Access-Control-Allow-Origin: *`

### Resolucao de key
Tenta multiplas combinacoes:
1. Key exato
2. Strip prefixo do bucket
3. Adiciona prefixos legacy (`imagens/`, `uploads/`, `logo/`)

## Proxy URL Builder (utils/storageProxy.ts)

```ts
toWasabiProxyUrl(input, options)  // Qualquer formato -> proxy URL
toWasabiDirectUrl(input, options) // Presigned -> proxy para persistencia
```

### toWasabiProxyUrl
1. LRU cache (2048 entradas)
2. Reconhece: raw keys, bare filenames, legacy proxy URLs, full Wasabi URLs
3. Extrai versao de URL params (v, version, versionId, X-Amz-*)
4. Gera: `/api/storage/p?key={key}&bucket={bucket}&v={version}`

### toWasabiDirectUrl
- Presigned URLs (X-Amz-Algorithm) -> proxy URL para persistencia
- Public keys -> proxy URL
- blob:, data:, about: -> pass-through

## Storage Key Extraction (utils/storageRef.ts)

```ts
extractStorageKeyFromRef(rawValue, opts)
```
- Extrai S3 key de: raw key, proxy URL, full Wasabi URL, path-style
- Reconhece prefixos: `projects/`, `imagens/`, `uploads/`, `logo/`

## Signed Read URL Cache (server/utils/project-storage-refs.ts)

```ts
getCachedSignedReadUrl(key, userId)      // Signed GET com cache 55min
resolveStorageReadUrl(value, userId)      // Key ou URL -> signed URL
```
- Map com max 1024 entradas (LRU eviction)
- TTL: 55 min (presigned valid 1h)
- Usado para resolver thumbnailUrl nos projetos

## S3 Object Cache (server/utils/s3-object-cache.ts)

```ts
getCachedS3Objects(opts)
```
- Cache in-memory de ListObjectsV2
- TTL: 120s (2 min)
- Dedup de requests concorrentes (inFlight promise)
- Stale-while-error: 15s
- Usado por assets.get.ts para listar eficientemente

## Listagem de Assets

### assets.get.ts (514 linhas)
- Busca paralela: S3 list + product_image_cache DB + asset_names DB
- Cache S3 via s3-object-cache (2min TTL)
- Filtro por texto com match em key, display_name
- AI search expansion opcional (gpt-4o-mini, 2min memo)
- Paginacao e sort (nome, data)

### uploads.get.ts
- Lista `uploads/`, exclui `bg-removed-*`, sort newest-first

### brands.get.ts
- Lista `logo/`, sort alfabetico

## Delecao

### assets/delete.post.ts
- Key unico com scope check

### storage/delete.post.ts
- Batch delete por prefixo (para delecao de projeto)
- ListObjectsV2 paginado + DeleteObjectsCommand
