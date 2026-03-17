---
name: wasabi-s3-storage-expert
description: "Especialista em Wasabi S3 storage do JobVarejo. Use quando Codex precisar criar ou modificar upload/download de arquivos, presigned URLs, proxy de storage, compressao gzip de canvas, circuit breaker, thumbnails, historico de versoes, recuperacao de dados, gestao de assets, ou resolver problemas de CORS, permissao e performance de storage."
---

# Wasabi S3 Storage Expert

## Objetivo

Operar sobre a camada de armazenamento do JobVarejo: Wasabi S3-compatible com proxy server-side.
Preservar os padroes de seguranca, circuit breaker e fallback ja estabelecidos.

## Inicio rapido

1. Ler o arquivo alvo e [references/storage-architecture.md](references/storage-architecture.md).
2. Classificar o pedido:
   - Upload/download: ler [references/upload-pipeline.md](references/upload-pipeline.md).
   - Assets/proxy: ler [references/proxy-assets.md](references/proxy-assets.md).
   - Historico/recovery: ler [references/history-recovery.md](references/history-recovery.md).
3. Validar seguranca (scope, rate limit, ownership).

## Regras de operacao

- S3Client e singleton lazy. Nao criar instancias novas (exceto presigned que cria por request).
- Bucket: `jobvarejo`. Endpoint: `s3.wasabisys.com`. Path-style (`forcePathStyle: true`).
- Keys privados: `projects/{userId}/{projectId}/...`. Somente owner acessa.
- Keys publicos: `imagens/`, `uploads/`, `logo/`. Acessiveis via proxy por qualquer usuario.
- Canvas JSON e comprimido com gzip (browser CompressionStream) antes de upload.
- Circuit breaker client-side: 2 falhas consecutivas = 5min cooldown. Nao desabilitar.
- Presigned URLs PUT em keys publicos incluem ACL `public-read`.
- Presigned GET URLs sao cacheadas 30min client, 55min server.
- Proxy retorna 1x1 PNG transparente para imagens nao encontradas (previne quebra de canvas).
- Path traversal bloqueado: `..`, backslash, control chars, query strings.
- Rate limits rigorosos em todos endpoints de storage.

## Estrutura de keys S3

```
projects/{userId}/{projectId}/page_{pageId}.json      # Canvas gzip
projects/{userId}/{projectId}/thumb_{pageId}.png       # Thumbnail
projects/{userId}/{projectId}/history/page_{pageId}/v{1-3}.json  # Ring buffer
imagens/{hash}-{safeName}.{ext}                        # Uploads de produto
imagens/smart-{name}-{hash}-{version}.webp             # AI-processed
imagens/bg-removed-{timestamp}.webp                    # Background removed
imagens/manual-{name}-{hash}-{version}.{ext}           # Manual uploads
uploads/{filename}                                     # Legacy uploads
logo/{filename}                                        # Brand logos
```

## Trilhas de uso

### Upload de canvas

1. Client comprime JSON com gzip (CompressionStream).
2. Tier 1: presigned PUT direto (browser -> Wasabi). Skip se CORS bloqueado.
3. Tier 2: FormData via server proxy (browser -> Nitro -> Wasabi). Timeout 25s.
4. Circuit breaker: 2 falhas = 5min em DB-only mode.
5. Sucesso: trigger history snapshot (fire-and-forget).

### Download de canvas

1. Presigned GET (cache 30min).
2. fetchJsonWithRetry: ArrayBuffer -> detecta gzip (magic bytes) -> decompress -> JSON.parse.
3. Fallback: proxy URL.
4. 404 retorna null (nao e erro).

### Upload de asset (imagem)

1. Sharp: resize 2400x2400, convert WebP q88.
2. SHA-256 hash do buffer para dedup de key.
3. HeadObject antes de upload para pular duplicatas.
4. ACL: `public-read` para keys publicos.

### Historico e recovery

1. Ring buffer de 3 slots com CopyObject S3.
2. Throttle 30s entre snapshots por pagina.
3. Restore: valida objectCount > 0, copia de volta.
4. Recover: 3 estagios (exact key versions -> project prefix -> history prefix).

## Entregas obrigatorias

### Para mudancas de codigo

1. Key S3 afetado (prefixo, formato)
2. Estrategia de upload (presigned vs proxy)
3. Impacto em circuit breaker
4. Seguranca (ownership, rate limit)
5. Como validar (upload, download, proxy, fallback)

### Para analise sem codigo

1. Diagnostico de storage/CORS
2. Key e endpoint afetados
3. Acao recomendada
4. Risco de perda de dados

## Referencias

- [references/storage-architecture.md](references/storage-architecture.md): config, S3 client, bucket.
- [references/upload-pipeline.md](references/upload-pipeline.md): upload canvas, assets, thumbnails.
- [references/proxy-assets.md](references/proxy-assets.md): proxy, CORS, cache, URLs.
- [references/history-recovery.md](references/history-recovery.md): ring buffer, restore, recover.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual key S3 foi afetado
- se ownership e rate limiting estao corretos
- se circuit breaker e fallbacks foram preservados
- se nao ha risco de perda de dados
