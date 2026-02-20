import { ref } from 'vue'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

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
const lastHistorySnapshotAtByPage = new Map<string, number>()
const historySnapshotInFlightByPage = new Map<string, Promise<void>>()

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
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

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
        throw fetchError
      }
    } catch (error: any) {
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
        return await response.json()
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
    retries = 3
  ): Promise<string | null> => {
    // Não executar no servidor (SSR)
    if (import.meta.server) {
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

    // Converter JSON para Blob
    const jsonString = JSON.stringify(canvasJson)
    const blob = new Blob([jsonString], { type: 'application/json' })

    // Retry logic: tenta até N vezes com backoff exponencial
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Obter presigned URL para upload (com retry interno)
        const presignedUrl = await getPresignedUrl(key, 'application/json', 'put', 2, authHeaders)
        if (!presignedUrl) {
          if (attempt === retries) {
            const errorMsg = 'Failed to get upload URL from Wasabi after multiple attempts.'
            console.error('❌', errorMsg)
            throw new Error(errorMsg)
          }
          // Aguardar antes de tentar novamente (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          continue
        }

        // Upload para Wasabi com timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

        try {
          const response = await fetch(presignedUrl, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText)
            if (attempt === retries) {
              const errorMsg = `Wasabi upload failed (${response.status}): ${errorText}`
              console.error('❌', errorMsg)
              throw new Error(errorMsg)
            }
            // Aguardar antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
            continue
          }

          // Sucesso!
          lastSavedAt.value = new Date()
          saveStatus.value = 'saved'
          console.log(`✅ Canvas salvo na Wasabi (tentativa ${attempt}/${retries}):`, key)
          // Snapshot histórico assíncrono e com throttle para não impactar a UX.
          void triggerHistorySnapshot({
            userId,
            projectId,
            pageId,
            key
          })
          return key

        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            if (attempt === retries) {
              throw new Error('Upload timeout após 30 segundos')
            }
            console.warn(`⚠️ Timeout na tentativa ${attempt}, tentando novamente...`)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
            continue
          }
          throw fetchError
        }

      } catch (error: any) {
        if (attempt === retries) {
          // Última tentativa falhou
          console.error(`❌ Erro ao salvar na Wasabi após ${retries} tentativas:`, error)
          saveStatus.value = 'error'
          saveError.value = error?.message || 'Erro desconhecido'
          return null
        }
        // Aguardar antes de tentar novamente
        console.warn(`⚠️ Tentativa ${attempt} falhou, tentando novamente em ${Math.pow(2, attempt)}s...`)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
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
      const proxyUrl = resolveProxyGetUrl(canvasDataPath)
      if (proxyUrl) {
        const headers = await tryGetApiAuthHeaders()
        if (!headers) return null
        const canvasJson = await fetchJsonWithRetry(proxyUrl, 3, headers)
        if (canvasJson) {
          console.log('✅ JSON carregado via proxy, objetos:', canvasJson?.objects?.length || 0)
          return canvasJson
        }
        return null
      }

      // Fallback legado: presigned GET
      const headers = await tryGetApiAuthHeaders()
      if (!headers) return null
      const presignedUrl = await getPresignedUrl(canvasDataPath, undefined, 'get', 2, headers)
      if (!presignedUrl) {
        console.log('⚠️ Presigned URL não retornada')
        return null
      }
      const canvasJson = await fetchJsonWithRetry(presignedUrl, 2)
      if (canvasJson) {
        console.log('✅ JSON carregado via presigned URL, objetos:', canvasJson?.objects?.length || 0)
      }
      return canvasJson
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
      const proxyUrl = resolveProxyGetUrl(key)
      if (proxyUrl) {
        const headers = await tryGetApiAuthHeaders()
        if (!headers) return null
        return await fetchJsonWithRetry(proxyUrl, 3, headers)
      }

      // Fallback legado: presigned GET
      const headers = await tryGetApiAuthHeaders()
      if (!headers) return null
      const presignedUrl = await getPresignedUrl(key, undefined, 'get', 2, headers)
      if (!presignedUrl) return null
      return await fetchJsonWithRetry(presignedUrl, 2)
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

      // Obter presigned URL
      const presignedUrl = await getPresignedUrl(key, 'image/png', 'put', 2, authHeaders)
      if (!presignedUrl) {
        throw new Error('Failed to get upload URL')
      }

      // Upload
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/png'
        }
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`)
      }

      // Return a same-origin proxy URL so thumbnails work even when the bucket is private.
      return `/api/storage/p?key=${encodeURIComponent(key)}`
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
