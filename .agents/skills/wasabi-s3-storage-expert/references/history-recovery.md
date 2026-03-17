# Historico e Recovery

## Ring Buffer (history-snapshot.post.ts)

### Estrutura
```
projects/{userId}/{projectId}/history/page_{pageId}/v1.json
projects/{userId}/{projectId}/history/page_{pageId}/v2.json
projects/{userId}/{projectId}/history/page_{pageId}/v3.json
```

### Config
- HISTORY_MAX_SNAPSHOTS = 3
- HISTORY_SNAPSHOT_INTERVAL_MS = 30000 (30s entre snapshots por pagina)

### Fluxo
1. Trigger client-side apos cada saveCanvasData() sucesso
2. Throttle: 30s minimo entre snapshots da mesma pagina
3. Guard de concorrencia: Map `historySnapshotInFlightByPage`
4. Safety timeout: 60s para limpar in-flight
5. Valida source nao-vazio (> 2 bytes)
6. CopyObjectCommand (S3 copy server-side, sem download)
7. Slot: primeiro vazio, ou mais antigo se todos usados

## Listagem (history.get.ts)

- Lista prefixo `history/page_{pageId}/`
- Download e parse de cada JSON para contar objectCount
- Sort: newest-first
- Retorna: `{ source: 'history', key, lastModified, size, objectCount }`

## Restore (restore.post.ts)

1. Le source escolhido (snapshot ou versioned object)
2. Valida `objectCount > 0` (recusa restore vazio)
3. PutObject no key target
4. Atualiza DB `canvas_data` array

## Recover Latest Non-Empty (recover-latest-non-empty.post.ts)

Anti-blank-canvas safety net. 3 estagios de busca:

### Estagio 1: Versoes do key exato
- `ListObjectVersionsCommand` no key principal
- Para cada versao: download -> parse -> check objects.length > 0

### Estagio 2: Todas versoes do prefixo do projeto
- Todos `page_*.json` sob `projects/{userId}/{projectId}/`
- Mesma validacao

### Estagio 3: Snapshots do historico
- `ListObjectsV2` no prefixo `history/page_{pageId}/`
- Download e validacao

### Apos encontrar
- Escreve versao recuperada como current (PutObject)
- Sincroniza com DB (atualiza canvas_data)

## Protecoes contra perda de dados

### Trigger SQL
- `prevent_empty_canvas_overwrite`: impede UPDATE que troca JSONB array nao-vazio por vazio

### Circuit breaker
- 2 falhas = 5min em DB-only mode (canvas persiste no Postgres)

### Fingerprint dedup
- Nao sobrescreve se fingerprint identico ao salvo

### Local draft
- localStorage como backup: `jobvarejo:draft:page:{projectId}:{pageId}`
- Reconciliacao por timestamp e fingerprint

### Beacon save
- `navigator.sendBeacon` no page unload (emergency save)

### Save watchdog
- Timeout de 60s no save completo
- Re-save automatico se mudancas ocorreram durante save anterior
