import { ref } from 'vue'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

// ── Gzip helpers (browser CompressionStream API) ─────────────────────────────
// Using Response wrapper to avoid ArrayBufferLike / SharedArrayBuffer TS issues.

const compressGzip = async (text: string): Promise<ArrayBuffer> => {
  const stream = new CompressionStream('gzip')
  const writer = stream.writable.getWriter()
  const encoded = new TextEncoder().encode(text)
  // slice() produces a plain ArrayBuffer (not SharedArrayBuffer) — required by the type
  await writer.write(encoded.buffer.slice(0) as ArrayBuffer)
  await writer.close()
  return new Response(stream.readable).arrayBuffer()
}

const decompressGzip = async (data: ArrayBuffer): Promise<string> => {
  const stream = new DecompressionStream('gzip')
  const writer = stream.writable.getWriter()
  await writer.write(data)
  await writer.close()
  return new Response(stream.readable).text()
}

const isGzipBuffer = (buf: Uint8Array): boolean =>
  buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b

// Cache: se presigned URL falhar por CORS, pular pelo resto da sessão.
// CORS é uma configuração do servidor, não um erro transiente — não faz sentido
// tentar novamente a cada 10 minutos e adicionar falhas desnecessárias ao circuito.
let _presignedCorsBlockedUntil = 0
const _PRESIGNED_CORS_BLOCK_MS = 24 * 60 * 60_000 // 24h (efetivamente sessão inteira)
const isPresignedCorsBlocked = () => Date.now() < _presignedCorsBlockedUntil
const setPresignedCorsBlocked = () => { _presignedCorsBlockedUntil = Date.now() + _PRESIGNED_CORS_BLOCK_MS }

// ── Circuit breaker para Wasabi uploads ──────────────────────────────────────
// Após N falhas consecutivas, pula Wasabi por um período (saves via DB-only).
const WASABI_CB_MAX_FAILURES = 8  // tolerância maior — erros transientes não devem abrir o circuito
const WASABI_CB_COOLDOWN_MS = 60_000 // 60s (era 3min) — recupera mais rápido
let _wasabiConsecutiveFailures = 0
let _wasabiCircuitOpenUntil = 0 // timestamp até quando o circuit está aberto

const isWasabiCircuitOpen = (): boolean => {
  if (_wasabiConsecutiveFailures < WASABI_CB_MAX_FAILURES) return false
  if (Date.now() >= _wasabiCircuitOpenUntil) {
    // Cooldown expirou — permitir 1 tentativa (half-open)
    console.log('🔄 Wasabi circuit breaker half-open: tentando 1 upload...')
    return false
  }
  return true
}

const recordWasabiSuccess = () => {
  if (_wasabiConsecutiveFailures > 0) {
    console.log('✅ Wasabi circuit breaker reset (upload bem-sucedido)')
  }
  _wasabiConsecutiveFailures = 0
  _wasabiCircuitOpenUntil = 0
}

const recordWasabiFailure = () => {
  _wasabiConsecutiveFailures++
  if (_wasabiConsecutiveFailures >= WASABI_CB_MAX_FAILURES) {
    _wasabiCircuitOpenUntil = Date.now() + WASABI_CB_COOLDOWN_MS
    console.warn(
      `🔴 Wasabi circuit breaker ABERTO: ${_wasabiConsecutiveFailures} falhas consecutivas. ` +
      `Pulando Wasabi por ${WASABI_CB_COOLDOWN_MS / 60_000}min (saves via DB-only).`
    )
  }
}

/**
 * Wasabi Storage Composable
 *
 * Armazena dados pesados do canvas na Wasabi Cloud Storage via API.
 * Isso reduz drasticamente o uso do banco de dados e custos.
 *
 * Wasabi é compatível com AWS S3.
 *
 * Estrutura de arquivos no bucket jobvarejo:
 * - projects/{userId}/{projectId}/page_{pageId}.json  → Canvas JSON
 * - projects/{userId}/{projectId}/thumb_{pageId}.png   → Thumbnail
 * - imagens/{filename} → Uploads de imagens
 * - logo/{filename} → Logos de marcas
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type RecoverLatestNonEmptyOptions = {
  projectId: string
  pageId: string
  preferredKey?: string | null
}

export type RecoverLatestNonEmptyResult = {
  key: string
  versionId: string
  objectCount: number
  recoveredAt: string
  json: any
}

type HistorySnapshotResponse = {
  ok: boolean
  sourceKey: string
  historyKey: string
  copiedAt: string
}

const saveStatus = ref<SaveStatus>('idle')
const lastSavedAt = ref<Date | null>(null)
const saveError = ref<string | null>(null)
const HISTORY_SNAPSHOT_INTERVAL_MS = 30_000
const THUMBNAIL_UPLOAD_TIMEOUT_MS = 15_000
const THUMBNAIL_UPLOAD_RETRIES = 2
const lastHistorySnapshotAtByPage = new Map<string, number>()
const historySnapshotInFlightByPage = new Map<string, Promise<void>>()

// Cache de presigned URLs de leitura (GET) — válidas por ~55min no servidor, cache por 30min
const _presignedGetCache = new Map<string, { url: string; expiresAt: number }>()
const PRESIGNED_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutos

/**
 * Obtém presigned URL do backend para upload/download
 * Isso evita expor credenciais S3 no frontend
 */
async function getPresignedUrl(
  key: string,
  contentType?: string,
  operation: 'put' | 'get' = 'put',
  retries = 2,
  headers?: Record<string, string> | null
): Promise<string | null> {
  // Cache hit para GET (leitura): evita roundtrip extra ao servidor
  if (operation === 'get') {
    const cached = _presignedGetCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url
    }
    _presignedGetCache.delete(key)
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000) // 6s timeout

      try {
        const data = await $fetch('/api/storage/presigned', {
          method: 'POST',
          ...(headers ? { headers } : {}),
          body: { key, contentType, operation },
          signal: controller.signal as any
        })

        clearTimeout(timeoutId)

        if (!data?.url) {
          if (attempt === retries) {
            console.error('❌ Presigned URL API retornou resposta inválida:', data)
            return null
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        // Cachear URLs de GET
        if (operation === 'get') {
          _presignedGetCache.set(key, { url: data.url, expiresAt: Date.now() + PRESIGNED_CACHE_TTL_MS })
        }
        return data.url
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          if (attempt === retries) {
            console.error('❌ Timeout ao obter presigned URL')
            return null
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        // Se for 401, não adianta fazer retry — sessão expirada
        const statusCode = Number(fetchError?.statusCode ?? fetchError?.response?.status ?? 0)
        if (statusCode === 401) {
          console.error('❌ Sessão expirada (401) ao obter presigned URL — não será feito retry.')
          return null
        }
        throw fetchError
      }
    } catch (error: any) {
      const statusCode = Number(error?.statusCode ?? error?.response?.status ?? 0)
      if (statusCode === 401) {
        console.error('❌ Sessão expirada (401) ao obter presigned URL.')
        return null
      }
      if (attempt === retries) {
        console.error('❌ Erro ao obter presigned URL da Wasabi:', error)
        console.error('   Verifique se as variáveis de ambiente WASABI_* estão configuradas no servidor')
        console.error('   Erro detalhado:', error?.message || error)
        return null
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  return null
}

const fetchJsonWithRetry = async (
  url: string,
  retries = 3,
  headers?: Record<string, string> | null
): Promise<any | null> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        ...(headers ? { headers } : {})
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) return null
        if (attempt === retries) {
          throw new Error(`Falha ao carregar JSON (${response.status})`)
        }
      } else {
        // Detect gzip (magic bytes 0x1f 0x8b) and decompress before parsing
        const arrayBuf = await response.arrayBuffer()
        const header = new Uint8Array(arrayBuf, 0, Math.min(2, arrayBuf.byteLength))
        if (isGzipBuffer(header)) {
          const text = await decompressGzip(arrayBuf)
          return JSON.parse(text)
        }
        return JSON.parse(new TextDecoder().decode(arrayBuf))
      }
    } catch (error: any) {
      const msg = String(error?.message || '')
      const isTransient =
        error?.name === 'AbortError' ||
        msg.includes('ERR_NETWORK_CHANGED') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError')

      if (attempt === retries || !isTransient) {
        throw error
      }
    }

    await new Promise(resolve => setTimeout(resolve, attempt * 700))
  }

  return null
}

const resolveProxyGetUrl = (keyOrUrl: string): string | null => {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null
  const trimmed = keyOrUrl.trim()
  if (!trimmed) return null

  const proxied = toWasabiProxyUrl(trimmed)
  if (proxied && proxied !== trimmed) return proxied

  if (
    trimmed.startsWith('projects/') ||
    trimmed.startsWith('imagens/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('logo/')
  ) {
    return `/api/storage/p?key=${encodeURIComponent(trimmed.replace(/^\/+/, ''))}`
  }

  return null
}

export const useStorage = () => {
  const auth = useAuth()
  const { tryGetApiAuthHeaders } = useApiAuth()

  const triggerHistorySnapshot = async (opts: {
    userId: string
    projectId: string
    pageId: string
    key: string
  }): Promise<void> => {
    if (import.meta.server) return

    const pageScope = `${opts.userId}:${opts.projectId}:${opts.pageId}`
    const now = Date.now()
    const lastRun = Number(lastHistorySnapshotAtByPage.get(pageScope) || 0)
    if (now - lastRun < HISTORY_SNAPSHOT_INTERVAL_MS) {
      return
    }
    if (historySnapshotInFlightByPage.has(pageScope)) {
      return
    }
    // Evita flood de tentativas mesmo se a chamada de snapshot falhar.
    lastHistorySnapshotAtByPage.set(pageScope, now)

    const run = (async () => {
      // Safety timeout: garante que a entrada do Map é sempre limpa,
      // mesmo que $fetch nunca responda (ex.: servidor travado).
      const safetyTimer = setTimeout(() => {
        historySnapshotInFlightByPage.delete(pageScope)
      }, 60_000)
      try {
        const headers = await tryGetApiAuthHeaders()
        if (!headers) return
        const result = await $fetch<HistorySnapshotResponse>('/api/storage/history-snapshot', {
          method: 'POST',
          headers,
          body: {
            projectId: opts.projectId,
            pageId: opts.pageId,
            key: opts.key
          }
        })
        if (result?.ok) {
          lastHistorySnapshotAtByPage.set(pageScope, Date.now())
        }
      } catch (error: any) {
        console.warn(
          `⚠️ Snapshot histórico não salvo (${opts.projectId}/${opts.pageId}):`,
          error?.message || error
        )
      } finally {
        clearTimeout(safetyTimer)
        historySnapshotInFlightByPage.delete(pageScope)
      }
    })()

    historySnapshotInFlightByPage.set(pageScope, run)
    await run
  }

  /**
   * Salva dados JSON na Wasabi Storage com retry automático (3 tentativas)
   */
  const saveCanvasData = async (
    projectId: string,
    pageId: string,
    canvasJson: any,
    retries = 2,
    preSerializedJson?: string | null
  ): Promise<string | null> => {
    // Não executar no servidor (SSR)
    if (import.meta.server) {
      return null
    }

    // Circuit breaker: pular Wasabi se muitas falhas consecutivas
    if (isWasabiCircuitOpen()) {
      console.warn(`⚡ Wasabi circuit breaker ABERTO — pulando upload, save via DB-only (retry em ${Math.ceil((_wasabiCircuitOpenUntil - Date.now()) / 60_000)}min)`)
      return null
    }

    const userId = auth.user.value?.id
    if (!userId) {
      saveStatus.value = 'error'
      saveError.value = 'Usuário não autenticado'
      return null
    }

    saveStatus.value = 'saving'
    saveError.value = null
    const authHeaders = await tryGetApiAuthHeaders()
    if (!authHeaders) {
      saveStatus.value = 'error'
      saveError.value = 'Sessão expirada. Faça login novamente.'
      return null
    }

    // Caminho do arquivo: projects/{userId}/{projectId}/page_{pageId}.json
    const key = `projects/${userId}/${projectId}/page_${pageId}.json`

    // Comprimir JSON com gzip antes de fazer upload (reduz ~80% do tamanho)
    const jsonString = typeof preSerializedJson === 'string'
      ? preSerializedJson
      : JSON.stringify(canvasJson)
    let blob: Blob
    let contentType: string
    const rawSizeKB = (jsonString.length / 1024).toFixed(0)
    try {
      const compressedBuf = await compressGzip(jsonString)
      blob = new Blob([compressedBuf], { type: 'application/octet-stream' })
      contentType = 'application/octet-stream'
      const compressedSizeKB = (compressedBuf.byteLength / 1024).toFixed(0)
      const ratio = ((1 - compressedBuf.byteLength / jsonString.length) * 100).toFixed(0)
      console.log(`🗜️ Canvas comprimido: ${rawSizeKB}KB → ${compressedSizeKB}KB (${ratio}% redução)`)
    } catch (gzipErr) {
      // Fallback para JSON puro caso CompressionStream não esteja disponível
      blob = new Blob([jsonString], { type: 'application/json' })
      contentType = 'application/json'
      console.warn(`⚠️ Gzip falhou, upload como JSON puro (${rawSizeKB}KB):`, gzipErr)
    }

    // Half-open: se já teve falhas anteriores, usar apenas 1 tentativa rápida
    const isHalfOpen = _wasabiConsecutiveFailures >= WASABI_CB_MAX_FAILURES
    const effectiveRetries = isHalfOpen ? 1 : retries

    // Estratégia: presigned URL direto (rápido, pula se CORS bloqueou antes) → fallback proxy servidor
    // Timeouts reduzidos: presigned 20s, proxy 30s. Se ambos falharem numa tentativa,
    // o pior caso por tentativa é ~50s (presigned timeout + proxy timeout em sequência),
    // o que cabe no soft timeout de 75s do saveProjectDB, evitando o loop infinito anterior.
    for (let attempt = 1; attempt <= effectiveRetries; attempt++) {
      const uploadStart = Date.now()
      try {
        // ── Tentativa 1: Presigned URL direto (browser → Wasabi) ──
        if (!isPresignedCorsBlocked()) {
          try {
            const presignedUrl = await getPresignedUrl(key, contentType, 'put', 1, authHeaders)
            if (presignedUrl) {
              const presignedController = new AbortController()
              const presignedTimeout = setTimeout(() => presignedController.abort(), 10_000)
              try {
                const response = await fetch(presignedUrl, {
                  method: 'PUT',
                  body: blob,
                  headers: { 'Content-Type': contentType },
                  signal: presignedController.signal
                })
                clearTimeout(presignedTimeout)

                if (response.ok) {
                  lastSavedAt.value = new Date()
                  saveStatus.value = 'saved'
                  recordWasabiSuccess()
                  console.log(`✅ Canvas salvo via presigned URL (tentativa ${attempt}/${effectiveRetries}, ${Date.now() - uploadStart}ms):`, key)
                  void triggerHistorySnapshot({ userId, projectId, pageId, key })
                  return key
                }
                console.warn(`⚠️ Presigned upload HTTP ${response.status}, fallback para proxy...`)
              } catch (fetchErr: any) {
                clearTimeout(presignedTimeout)
                // CORS ou TypeError = browser bloqueou cross-origin PUT → cachear e pular
                if (fetchErr?.name === 'TypeError' || fetchErr?.message?.includes('CORS') || fetchErr?.message?.includes('Failed to fetch')) {
                  setPresignedCorsBlocked()
                  console.warn('⚠️ CORS bloqueou presigned upload; usando proxy pelo resto da sessão.')
                } else if (fetchErr?.name === 'AbortError') {
                  console.warn('⚠️ Presigned upload timeout (10s), fallback para proxy...')
                } else {
                  console.warn(`⚠️ Presigned upload erro (${fetchErr?.message}), fallback para proxy...`)
                }
              }
            }
          } catch (presignedSetupErr: any) {
            console.warn(`⚠️ Não conseguiu obter presigned URL (${presignedSetupErr?.message}), usando proxy...`)
          }
        }

        // ── Tentativa 2 (ou única se CORS bloqueado): Proxy servidor via FormData ──
        // Timeout de 45s: dá margem para o S3 (requestTimeout=55s no servidor) dentro do soft timeout de 60s.
        const proxyController = new AbortController()
        const proxyTimeoutId = setTimeout(() => proxyController.abort(), 45_000)

        try {
          // FormData é mais compatível com Vite proxy e Nitro readMultipartFormData
          const formData = new FormData()
          formData.append('file', blob, 'canvas.json.gz')

          const result = await $fetch<{ key: string; size: number }>('/api/storage/upload', {
            method: 'POST',
            query: { key, contentType },
            body: formData,
            signal: proxyController.signal as any
          })

          clearTimeout(proxyTimeoutId)

          if (!result?.key) {
            throw new Error('Upload proxy retornou resposta inválida')
          }

          lastSavedAt.value = new Date()
          saveStatus.value = 'saved'
          recordWasabiSuccess()
          console.log(`✅ Canvas salvo via proxy (tentativa ${attempt}/${effectiveRetries}, ${Date.now() - uploadStart}ms):`, result.key)
          void triggerHistorySnapshot({ userId, projectId, pageId, key })
          return result.key

        } catch (proxyErr: any) {
          clearTimeout(proxyTimeoutId)
          const statusCode = Number(proxyErr?.statusCode ?? proxyErr?.response?.status ?? 0)
          if (statusCode === 401) {
            saveStatus.value = 'error'
            saveError.value = 'Sessão expirada. Faça login novamente.'
            return null
          }
          throw proxyErr
        }

      } catch (error: any) {
        const elapsed = Date.now() - uploadStart
        if (attempt === effectiveRetries) {
          recordWasabiFailure()
          console.error(`❌ Wasabi upload falhou após ${effectiveRetries} tentativas (${elapsed}ms, blob=${(blob.size / 1024).toFixed(0)}KB, cors_blocked=${isPresignedCorsBlocked()}):`, error?.message || error)
          saveStatus.value = 'error'
          saveError.value = error?.message || 'Erro desconhecido'
          return null
        }
        const backoffMs = Math.min(Math.pow(2, attempt) * 1000, 8000)
        console.warn(`⚠️ Tentativa ${attempt}/${effectiveRetries} falhou após ${elapsed}ms (${error?.message}), retry em ${backoffMs / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }

    return null
  }

  /**
   * Carrega dados JSON da Wasabi Storage usando o caminho completo
   */
  const loadCanvasDataFromPath = async (
    canvasDataPath: string
  ): Promise<any | null> => {
    // Não executar no servidor (SSR)
    if (import.meta.server) {
      return null
    }

    try {
      console.log('📥 loadCanvasDataFromPath:', canvasDataPath)
      const headers = await tryGetApiAuthHeaders()
      if (!headers) return null

      const presignedUrl = await getPresignedUrl(canvasDataPath, undefined, 'get', 2, headers)
      if (presignedUrl) {
        const canvasJson = await fetchJsonWithRetry(presignedUrl, 2)
        if (canvasJson) {
          console.log('✅ JSON carregado via presigned URL direta, objetos:', canvasJson?.objects?.length || 0)
          return canvasJson
        }
      }

      const proxyUrl = resolveProxyGetUrl(canvasDataPath)
      if (proxyUrl) {
        const canvasJson = await fetchJsonWithRetry(proxyUrl, 3, headers)
        if (canvasJson) {
          console.log('✅ JSON carregado via proxy, objetos:', canvasJson?.objects?.length || 0)
          return canvasJson
        }
        return null
      }

      if (!presignedUrl) {
        console.log('⚠️ Presigned URL não retornada')
      }
      return null
    } catch (error: any) {
      console.error('❌ Erro ao carregar da Wasabi:', error)
      return null
    }
  }

  /**
   * Recupera automaticamente a versão mais recente não-vazia para uma página.
   * Utilizado como fallback anti-tela-em-branco quando o payload atual foi sobrescrito vazio.
   */
  const recoverLatestNonEmptyCanvasData = async (
    opts: RecoverLatestNonEmptyOptions
  ): Promise<RecoverLatestNonEmptyResult | null> => {
    if (import.meta.server) return null
    if (!opts?.projectId || !opts?.pageId) return null

    try {
      const headers = await tryGetApiAuthHeaders()
      if (!headers) return null
      const result = await $fetch<RecoverLatestNonEmptyResult>('/api/storage/recover-latest-non-empty', {
        method: 'POST',
        headers,
        body: {
          projectId: opts.projectId,
          pageId: opts.pageId,
          preferredKey: opts.preferredKey || undefined
        }
      })
      if (!result?.json || !result?.key) return null
      return result
    } catch (error: any) {
      console.warn('⚠️ Falha no recovery automático de versão não-vazia:', error?.message || error)
      return null
    }
  }

  /**
   * Carrega dados JSON da Wasabi Storage
   */
  const loadCanvasData = async (
    projectId: string,
    pageId: string
  ): Promise<any | null> => {
    // Não executar no servidor (SSR)
    if (import.meta.server) {
      return null
    }

    const userId = auth.user.value?.id
    if (!userId) {
      return null
    }

    try {
      const key = `projects/${userId}/${projectId}/page_${pageId}.json`
      const headers = await tryGetApiAuthHeaders()
      if (!headers) return null

      const presignedUrl = await getPresignedUrl(key, undefined, 'get', 2, headers)
      if (presignedUrl) {
        const json = await fetchJsonWithRetry(presignedUrl, 2)
        if (json) return json
      }

      const proxyUrl = resolveProxyGetUrl(key)
      if (proxyUrl) {
        return await fetchJsonWithRetry(proxyUrl, 3, headers)
      }
      return null
    } catch (error: any) {
      console.error('Erro ao carregar da Wasabi:', error)
      return null
    }
  }

  /**
   * Salva thumbnail na Wasabi Storage
   */
  const saveThumbnail = async (
    projectId: string,
    pageId: string,
    dataUrl: string
  ): Promise<string | null> => {
    // Não executar no servidor (SSR)
    if (import.meta.server) {
      return null
    }

    const userId = auth.user.value?.id
    if (!userId) {
      return null
    }

    try {
      const key = `projects/${userId}/${projectId}/thumb_${pageId}.png`
      const authHeaders = await tryGetApiAuthHeaders()
      if (!authHeaders) return null

      // Converter DataURL para Blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Upload via servidor (evita CORS) usando FormData
      for (let attempt = 1; attempt <= THUMBNAIL_UPLOAD_RETRIES; attempt++) {
        try {
          const formData = new FormData()
          formData.append('file', blob, 'thumb.png')

          const result = await $fetch<{ key: string }>('/api/storage/upload', {
            method: 'POST',
            query: { key, contentType: 'image/png' },
            body: formData,
          })

          if (!result?.key) {
            throw new Error('Thumbnail upload retornou resposta inválida')
          }

          return `/api/storage/p?key=${encodeURIComponent(key)}`
        } catch (uploadError: any) {
          const statusCode = Number(uploadError?.statusCode ?? uploadError?.response?.status ?? 0)
          if (statusCode === 401) return null
          if (attempt === THUMBNAIL_UPLOAD_RETRIES) {
            throw uploadError
          }
          console.warn(`⚠️ Falha ao salvar thumbnail (${pageId}) na tentativa ${attempt}; tentando novamente...`)
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }

      return null
    } catch (error: any) {
      console.error('Erro ao salvar thumbnail:', error)
      return null
    }
  }

  /**
   * Obtém URL pública para um arquivo
   * Wasabi usa path style: https://s3.wasabisys.com/bucket/key
   */
  const getPublicUrl = (key: string): string => {
    const config = useRuntimeConfig().public.wasabi || {}
    const endpoint = config.endpoint || 's3.wasabisys.com'
    const bucket = config.bucket || 'jobvarejo'
    return `https://${endpoint}/${bucket}/${key}`
  }

  /**
   * Obtém URL pública para arquivos de importação (bucket jobvarejo)
   */
  const getImportPublicUrl = (key: string): string => {
    const config = useRuntimeConfig().public.wasabi || {}
    const endpoint = config.endpoint || 's3.wasabisys.com'
    const bucket = config.bucket || 'jobvarejo'
    return `https://${endpoint}/${bucket}/${key}`
  }

  /**
   * Obtém URL para pasta de imagens
   */
  const getImagesPublicUrl = (key: string): string => {
    const config = useRuntimeConfig().public.wasabi || {}
    const endpoint = config.endpoint || 's3.wasabisys.com'
    const bucket = config.bucket || 'jobvarejo'
    return `https://${endpoint}/${bucket}/imagens/${key}`
  }

  /**
   * Obtém URL para pasta de logos
   */
  const getBrandsPublicUrl = (key: string): string => {
    const config = useRuntimeConfig().public.wasabi || {}
    const endpoint = config.endpoint || 's3.wasabisys.com'
    const bucket = config.bucket || 'jobvarejo'
    return `https://${endpoint}/${bucket}/logo/${key}`
  }

  /**
   * Deleta todos os arquivos de um projeto
   */
  const deleteProjectFiles = async (projectId: string): Promise<void> => {
    const userId = auth.user.value?.id
    if (!userId) return

    try {
      const authHeaders = await tryGetApiAuthHeaders()
      if (!authHeaders) return
      // Deletar via API backend
      await fetch('/api/storage/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          prefix: `projects/${userId}/${projectId}/`
        })
      })
    } catch (error: any) {
      console.error('Erro ao deletar arquivos do projeto:', error)
    }
  }

  /**
   * Salva múltiplas páginas de uma vez
   */
  const saveProjectPages = async (
    projectId: string,
    pages: Array<{ id: string; canvasData: any }>
  ): Promise<string[]> => {
    const paths: string[] = []

    for (const page of pages) {
      if (page.canvasData) {
        const path = await saveCanvasData(projectId, page.id, page.canvasData)
        if (path) paths.push(path)
      }
    }

    return paths
  }

  /**
   * Carrega múltiplas páginas de uma vez
   */
  const loadProjectPages = async (
    projectId: string,
    pageIds: string[]
  ): Promise<Map<string, any>> => {
    const pagesMap = new Map<string, any>()

    // Carregar em paralelo para melhor performance
    const promises = pageIds.map(async (pageId) => {
      const data = await loadCanvasData(projectId, pageId)
      return { pageId, data }
    })

    const results = await Promise.all(promises)
    for (const { pageId, data } of results) {
      if (data) {
        pagesMap.set(pageId, data)
      }
    }

    return pagesMap
  }

  return {
    // Estado
    saveStatus: readonly(saveStatus),
    lastSavedAt: readonly(lastSavedAt),
    saveError: readonly(saveError),

    // Métodos
    saveCanvasData,
    loadCanvasData,
    loadCanvasDataFromPath,
    recoverLatestNonEmptyCanvasData,
    saveThumbnail,
    deleteProjectFiles,
    saveProjectPages,
    loadProjectPages,
    getPublicUrl,
    getImportPublicUrl,
    getImagesPublicUrl,
    getBrandsPublicUrl
  }
}


// HMR: resetar estado de upload e limpar caches ao substituir o módulo em dev.
// Sem isso, _wasabiConsecutiveFailures e _presignedCorsBlockedUntil da instância
// antiga persistem, fazendo a nova instância achar que o circuit breaker está aberto.
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        _wasabiConsecutiveFailures = 0
        _wasabiCircuitOpenUntil = 0
        _presignedCorsBlockedUntil = 0
        lastHistorySnapshotAtByPage.clear()
        historySnapshotInFlightByPage.clear()
        _presignedGetCache.clear()
        saveStatus.value = 'idle'
        saveError.value = null
    })
}
