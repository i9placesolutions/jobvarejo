# Pipeline de Serializacao

## Fluxo de Save (canvas -> storage)

```
1. prepareCanvasForSerialization()
   - Garante IDs persistentes em todo objeto
   - Marca frames com isFrame, layerName, stroke
   - Remove clipPaths de zones (runtime-only)
   
2. canvas.toObject(CANVAS_CUSTOM_PROPS)
   - Serializacao nativa Fabric com ~100+ props custom
   
3. finalizeSerializedCanvasJson()
   - syncCustomPropsTopLevel: copia props de objetos live para JSON
   - stripZoneClipPaths: remove clipPaths de zones
   - restoreFramePropsAndFilterInvalid: reinjeta frame props, filtra invalidos
   - normalizePersistedImageUrls: troca presigned/proxy/blob por __originalSrc
   
4. computeCanvasFingerprint()
   - Hash DJB2 ignorando keys volateis (__savedAt, crossOrigin, etc)
   - Normaliza proxy/blob src para __originalSrc
   - Retorna "empty" para null
   
5. persistSerializedPageState()
   - Resolve indice da pagina
   - Dedup por fingerprint
   - Grava no estado reactive + local draft (localStorage)
   
6. saveProjectDB()
   - Upload JSON gzip para Wasabi S3
   - Upload thumbnails para Wasabi
   - PUT metadata no Postgres via API
   - Watchdog 60s, soft timeouts por pagina
```

## Fluxo de Load (storage -> canvas)

```
1. loadCanvasData(key) ou loadCanvasDataFromPath(path)
   - Busca presigned GET URL (cache 30min)
   - fetchJsonWithRetry: download ArrayBuffer, detecta gzip (magic bytes), decompress, parse
   - Fallback: proxy URL
   
2. prepareCanvasDataForLoad(json)
   - Normaliza propriedades, migra formato antigo
   
3. canvas.loadFromJSON(state) [via loadFromJsonSafe]
   - Carrega objetos Fabric a partir do JSON
   
4. Pos-load:
   - sanitizeAllClipPaths()
   - rehydrateCanvasZones()
   - repairZoneCardsAfterHistoryRestore()
   - Restaura viewport (salvo ou zoom-to-fit)
   - Limpa cache de fontes Fabric
   - Recalcula dimensoes de texto (initDimensions)
```

## Fingerprinting

`computeCanvasFingerprint(canvasData)`:
- Hash DJB2 de JSON serializado
- Ignora: `__savedAt`, `crossOrigin`, `clipTo`, `_cacheCanvas`
- Normaliza URLs: presigned/proxy/blob -> `__originalSrc`
- Retorna `"empty"` para dados nulos/vazios
- Usado para dedup: nao salva se fingerprint nao mudou

## Normalizacao de URLs

`normalizePersistedImageUrls`:
- Walks todos os objetos (inclusive nested em groups e clipPaths)
- Para cada Image: se tem `__originalSrc`, substitui `src` por ele
- Remove query params de presigned URLs
- Converte blob: e proxy URLs para o key original

`canvasAssetUrls.ts`:
- `normalizeCanvasUrls()`: blob -> placeholder, Contabo -> proxy, Wasabi -> proxy
- Marca com flag de versao apos normalizar

## Local Draft

- `localStorage` key: `jobvarejo:draft:page:{projectId}:{pageId}`
- Flush via `requestIdleCallback` (180ms delay, 1200ms timeout)
- `resolveCanvasDataWithDraft()`: reconcilia remoto vs local por timestamp e fingerprint
- `pickBestRemoteCanvasData()`: escolhe entre Wasabi JSON e DB-embedded por object count

## Save Policy

`editorSavePolicy.ts` decide:
- `shouldSkipAutoSave()`: pula system saves, initial-history, post-load, viewport changes
- `shouldSkipByFingerprint()`: dedup
- `canAllowEmptyOverwrite()`: protege contra overwrite acidental
- `canGenerateThumbnailNow()`: min 600ms (3000ms para modified events)
- `getAdaptiveCoalesceDelayMs()`: 0ms (<300 objetos) ate 420ms (1200+)

## Gzip

- Canvas JSON comprimido com browser `CompressionStream('gzip')`
- Content-Type: `application/octet-stream`
- Deteccao: magic bytes `0x1f 0x8b`
- Fallback: JSON plain se CompressionStream indisponivel
