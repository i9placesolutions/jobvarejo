// Client HTTP para a Canva Connect REST API
// Documentacao: https://www.canva.dev/docs/connect/

import { readCanvaTokenCache, writeCanvaTokenCache } from './canva-token-cache'

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

let _accessToken: string | null = null
let _tokenExpiresAt: number = 0

const parseCanvaErrorBody = (raw: string) => {
  const text = String(raw || '').trim()
  if (!text) return { raw: '' }

  try {
    const parsed = JSON.parse(text) as Record<string, any>
    const rootError = (parsed?.error && typeof parsed.error === 'object') ? parsed.error as Record<string, any> : null
    const message =
      String(
        rootError?.message ||
        parsed?.message ||
        parsed?.detail ||
        parsed?.error_description ||
        ''
      ).trim() || null
    const code =
      String(
        rootError?.code ||
        parsed?.code ||
        parsed?.error ||
        ''
      ).trim() || null

    return {
      raw: text,
      parsed,
      message,
      code,
    }
  } catch {
    return {
      raw: text,
      message: text,
      code: null,
    }
  }
}

const getTokenExpiryMs = (token: string): number | null => {
  const raw = String(token || '').trim()
  if (!raw) return null

  const parts = raw.split('.')
  if (parts.length < 2 || !parts[1]) return null

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padLength = (4 - (normalized.length % 4)) % 4
    const padded = `${normalized}${'='.repeat(padLength)}`
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, any>
    const exp = Number(payload?.exp || 0)
    if (!Number.isFinite(exp) || exp <= 0) return null
    return exp * 1000
  } catch {
    return null
  }
}

const isAccessTokenUsable = (token: string): boolean => {
  const raw = String(token || '').trim()
  if (!raw) return false

  const expMs = getTokenExpiryMs(raw)
  if (!expMs) return true

  return expMs > (Date.now() + 60_000)
}

const getCanvaAuthConfig = async () => {
  let config: Record<string, any> = {}
  const cache = await readCanvaTokenCache()
  try {
    config = useRuntimeConfig() as Record<string, any>
  } catch {
    // useRuntimeConfig pode falhar fora de um event handler.
  }

  return {
    cachedAccessToken: String(cache?.access_token || '').trim(),
    cachedRefreshToken: String(cache?.refresh_token || '').trim(),
    accessToken: String(
      config.canvaAccessToken ||
      process.env.CANVA_ACCESS_TOKEN ||
      process.env.NUXT_CANVA_ACCESS_TOKEN ||
      ''
    ).trim(),
    refreshToken: String(
      config.canvaRefreshToken ||
      process.env.CANVA_REFRESH_TOKEN ||
      ''
    ).trim(),
    clientId: String(
      config.canvaClientId ||
      process.env.CANVA_CLIENT_ID ||
      ''
    ).trim(),
    clientSecret: String(
      config.canvaClientSecret ||
      process.env.CANVA_CLIENT_SECRET ||
      ''
    ).trim(),
  }
}

/**
 * Obter access token do Canva.
 * Se o token expirou, tenta renovar automaticamente via refresh_token.
 */
const getAccessToken = async (): Promise<string> => {
  // Se o token ainda e valido, retorna
  if (_accessToken && Date.now() < _tokenExpiresAt) {
    return _accessToken
  }

  const {
    cachedAccessToken,
    cachedRefreshToken,
    accessToken,
    refreshToken,
    clientId,
    clientSecret,
  } = await getCanvaAuthConfig()
  let refreshError: any = null
  const effectiveRefreshToken = cachedRefreshToken || refreshToken

  // Preferir sempre refresh token quando disponivel.
  // Isso evita depender de um CANVA_ACCESS_TOKEN estatico ja expirado/invalido.
  if (effectiveRefreshToken && clientId && clientSecret) {
    try {
      const newToken = await refreshAccessToken(effectiveRefreshToken, clientId, clientSecret)
      if (newToken) return newToken
    } catch (err) {
      refreshError = err
      console.error('Falha ao renovar token do Canva:', err)
    }
  }

  const fallbackAccessToken = cachedAccessToken || accessToken
  if (isAccessTokenUsable(fallbackAccessToken)) {
    _accessToken = fallbackAccessToken
    _tokenExpiresAt = getTokenExpiryMs(fallbackAccessToken) || (Date.now() + (14400 * 1000))
    return fallbackAccessToken
  }

  if (refreshError) {
    throw createError({
      statusCode: refreshError?.statusCode || 502,
      statusMessage:
        refreshError?.data?.canvaCode === 'invalid_grant' ||
        /revoked/i.test(String(refreshError?.data?.canvaMessage || ''))
          ? 'Canva OAuth revogado ou expirado. Gere um novo access token e refresh token.'
          : refreshError?.statusMessage || 'Falha ao renovar token da Canva.',
      data: refreshError?.data || null,
    })
  }

  if (!accessToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CANVA_ACCESS_TOKEN nao configurado. Adicione ao .env ou configure CANVA_REFRESH_TOKEN/CANVA_CLIENT_ID/CANVA_CLIENT_SECRET.',
    })
  }

  throw createError({
    statusCode: 502,
    statusMessage: 'CANVA_ACCESS_TOKEN expirado e refresh token indisponivel. Gere uma nova autorizacao Canva.',
  })
}

/**
 * Renovar access token usando refresh_token
 */
const refreshAccessToken = async (
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> => {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erro desconhecido')
    const parsedError = parseCanvaErrorBody(errorText)
    console.error('Erro ao renovar token Canva:', parsedError.message || parsedError.raw || response.statusText)
    throw createError({
      statusCode: response.status,
      statusMessage: `Canva OAuth: ${parsedError.message || response.statusText}`,
      data: {
        canvaError: parsedError.parsed || parsedError.raw || null,
        canvaMessage: parsedError.message,
        canvaCode: parsedError.code,
      },
    })
  }

  const data = await response.json() as { access_token: string; expires_in: number; refresh_token?: string }
  _accessToken = data.access_token
  _tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000 // 1min de margem
  const nextRefreshToken = String(data.refresh_token || refreshToken).trim()
  if (_accessToken && nextRefreshToken) {
    await writeCanvaTokenCache({
      accessToken: _accessToken,
      refreshToken: nextRefreshToken,
      expiresAt: _tokenExpiresAt,
    })
  }
  console.log('Token do Canva renovado com sucesso')
  return _accessToken
}

/**
 * Resetar token (util ao renovar manualmente)
 */
export const resetCanvaToken = () => {
  _accessToken = null
  _tokenExpiresAt = 0
}

/**
 * Requisicao generica para a Canva API
 */
export const canvaFetch = async <T = any>(
  path: string,
  options: {
    method?: string
    body?: any
    query?: Record<string, string | number | undefined>
  } = {}
): Promise<T> => {
  const url = new URL(`${CANVA_API_BASE}${path}`)

  if (options.query) {
    for (const [key, val] of Object.entries(options.query)) {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val))
      }
    }
  }

  const executeRequest = async (token: string) => {
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body)
    }

    return fetch(url.toString(), fetchOptions)
  }

  let token = await getAccessToken()
  let response = await executeRequest(token)

  if (response.status === 401) {
    console.warn(`Canva API retornou 401 para ${options.method || 'GET'} ${path}; tentando renovar token...`)
    resetCanvaToken()
    token = await getAccessToken()
    response = await executeRequest(token)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erro desconhecido')
    const parsedError = parseCanvaErrorBody(errorText)
    console.error(`Canva API error [${response.status}]: ${parsedError.message || parsedError.raw || response.statusText}`)
    throw createError({
      statusCode: response.status,
      statusMessage: `Canva API: ${parsedError.message || response.statusText}`,
      data: {
        canvaError: parsedError.parsed || parsedError.raw || null,
        canvaMessage: parsedError.message,
        canvaCode: parsedError.code,
      },
    })
  }

  // Algumas respostas podem ser 204 (No Content)
  if (response.status === 204) {
    return {} as T
  }

  return response.json() as Promise<T>
}

// ── Designs ─────────────────────────────────────────────────────────────────

export interface CanvaApiDesign {
  id: string
  title: string
  owner: { user_id: string; team_id?: string }
  thumbnail?: { width: number; height: number; url: string }
  urls: { edit_url: string; view_url: string }
  created_at: number
  updated_at: number
  page_count: number
}

interface CanvaListDesignsResponse {
  items: CanvaApiDesign[]
  continuation?: string
}

export const canvaListDesigns = async (options: {
  query?: string
  continuation?: string
  sort_by?: string
  ownership?: string
} = {}): Promise<CanvaListDesignsResponse> => {
  const queryParams: Record<string, string | undefined> = {}

  if (options.query) {
    queryParams.query = options.query
    queryParams.sort_by = 'relevance'
  } else {
    queryParams.sort_by = options.sort_by || 'modified_descending'
  }

  if (options.continuation) {
    queryParams.continuation = options.continuation
  }

  if (options.ownership) {
    queryParams.ownership = options.ownership
  }

  return canvaFetch<CanvaListDesignsResponse>('/designs', { query: queryParams })
}

export const canvaGetDesign = async (designId: string): Promise<CanvaApiDesign> => {
  const response = await canvaFetch<{ design: CanvaApiDesign }>(`/designs/${designId}`)
  return response.design
}

// ── Editing Transactions ────────────────────────────────────────────────────
// DEPRECATED: Os endpoints /editing-sessions NAO existem na Canva Connect REST API.
// Essas funcoes estao mantidas apenas para referencia. Requerem MCP ou Canva Enterprise Autofill.

// Resposta completa da transacao de edicao (inclui richtexts, fills, thumbnails, pages)
/** @deprecated Endpoint /editing-sessions nao existe na Canva Connect REST API */
export const canvaStartEditingTransaction = async (_designId: string): Promise<any> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Funcionalidade nao disponivel via Canva Connect REST API. Requer MCP ou Canva Enterprise Autofill.',
  })
}

interface CanvaEditingOperation {
  type: string
  [key: string]: any
}

/** @deprecated Endpoint /editing-sessions nao existe na Canva Connect REST API */
export const canvaPerformEditingOperations = async (
  _transactionId: string,
  _operations: CanvaEditingOperation[],
  _pageIndex: number = 1
): Promise<any> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Funcionalidade nao disponivel via Canva Connect REST API. Requer MCP ou Canva Enterprise Autofill.',
  })
}

/** @deprecated Endpoint /editing-sessions nao existe na Canva Connect REST API */
export const canvaCommitEditingTransaction = async (_transactionId: string): Promise<any> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Funcionalidade nao disponivel via Canva Connect REST API. Requer MCP ou Canva Enterprise Autofill.',
  })
}

/** @deprecated Endpoint /editing-sessions nao existe na Canva Connect REST API */
export const canvaCancelEditingTransaction = async (_transactionId: string): Promise<any> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Funcionalidade nao disponivel via Canva Connect REST API. Requer MCP ou Canva Enterprise Autofill.',
  })
}

// ── Content ─────────────────────────────────────────────────────────────────
// DEPRECATED: O endpoint /designs/{id}/content NAO existe na Canva Connect REST API.

interface CanvaDesignContentResponse {
  pages: Array<{
    id: string
    index: number
    elements: Array<{
      id: string
      type: string
      text?: string
      asset_id?: string
    }>
  }>
}

/** @deprecated Endpoint /designs/{id}/content nao existe na Canva Connect REST API */
export const canvaGetDesignContent = async (
  _designId: string,
  _contentTypes: string[] = ['richtexts']
): Promise<CanvaDesignContentResponse> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Funcionalidade nao disponivel via Canva Connect REST API. Requer MCP ou Canva Enterprise Autofill.',
  })
}

// ── Exports ─────────────────────────────────────────────────────────────────

interface CanvaExportResponse {
  job: {
    id: string
    status: string
    urls?: string[]
  }
}

export const canvaExportDesign = async (
  designId: string,
  format: { type: string; [key: string]: any }
): Promise<CanvaExportResponse> => {
  return canvaFetch<CanvaExportResponse>('/exports', {
    method: 'POST',
    body: { design_id: designId, format },
  })
}

export const canvaGetExportJob = async (jobId: string): Promise<CanvaExportResponse> => {
  return canvaFetch<CanvaExportResponse>(`/exports/${jobId}`)
}

// ── Assets ──────────────────────────────────────────────────────────────────

interface CanvaAssetUploadResponse {
  job: {
    id: string
    status: string
    asset?: { id: string; name: string }
  }
}

export const canvaUploadAssetFromUrl = async (
  url: string,
  name: string
): Promise<CanvaAssetUploadResponse> => {
  return canvaFetch<CanvaAssetUploadResponse>('/asset-uploads-url', {
    method: 'POST',
    body: { url, name },
  })
}

export const canvaGetAssetUploadJob = async (jobId: string): Promise<CanvaAssetUploadResponse> => {
  return canvaFetch<CanvaAssetUploadResponse>(`/asset-uploads-url/${jobId}`)
}

// ── Duplicar Pagina ────────────────────────────────────────────────────────

/**
 * @deprecated Duplicacao de pagina nao e possivel via Canva Connect REST API.
 * Os endpoints /editing-sessions nao existem. Requer MCP ou Canva Enterprise Autofill.
 */
export const canvaDuplicatePage = async (
  _designId: string,
  _pageIndex: number = 1
): Promise<{
  success: boolean
  manual_required: boolean
  edit_url: string
  message: string
  transaction_id?: string
}> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Funcionalidade nao disponivel via Canva Connect REST API. Requer MCP ou Canva Enterprise Autofill.',
  })
}

// ── Design Pages (thumbnails) ───────────────────────────────────────────────

interface CanvaDesignPagesResponse {
  items: Array<{
    index: number
    thumbnail?: { url: string; width: number; height: number }
  }>
}

export const canvaGetDesignPages = async (
  designId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<CanvaDesignPagesResponse> => {
  return canvaFetch<CanvaDesignPagesResponse>(`/designs/${designId}/pages`, {
    query: {
      offset: options.offset,
      limit: options.limit,
    },
  })
}

// ── Copiar Design (via export+URL import) ───────────────────────────────────

/**
 * Copiar um design do Canva criando uma nova copia.
 * Estrategia: exportar como PDF e importar a URL publica temporaria como novo design.
 */
export const canvaCopyDesign = async (
  sourceDesignId: string,
  newTitle: string
): Promise<{ design_id: string; title: string; edit_url: string; view_url: string }> => {
  // 1. Exportar o design original como PDF
  const exportResponse = await canvaExportDesign(sourceDesignId, { type: 'pdf' })
  const exportJobId = exportResponse.job.id

  // 2. Polling ate export terminar
  let exportUrl: string | null = null
  for (let i = 0; i < 20; i++) {
    const status = await canvaGetExportJob(exportJobId)
    if (status.job.status === 'completed' || status.job.status === 'success') {
      exportUrl = status.job.urls?.[0] || null
      break
    }
    if (status.job.status === 'failed') {
      const reason = (status as any)?.job?.error?.message || 'Falha ao exportar design original'
      throw new Error(reason)
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  if (!exportUrl) {
    throw new Error('Timeout ao exportar design original')
  }

  // 3. Baixar o PDF e importar como binário via POST /imports
  const token = await getAccessToken()
  const pdfResponse = await fetch(exportUrl)
  if (!pdfResponse.ok) {
    throw new Error('Falha ao baixar PDF exportado')
  }
  const pdfBuffer = await pdfResponse.arrayBuffer()

  const importUrl = new URL(`${CANVA_API_BASE}/imports`)
  const importRes = await fetch(importUrl.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Import-Metadata': JSON.stringify({
        title_base64: Buffer.from(newTitle).toString('base64'),
        mime_type: 'application/pdf',
      }),
    },
    body: pdfBuffer,
  })

  if (!importRes.ok) {
    const errText = await importRes.text().catch(() => '')
    throw new Error(`Falha ao importar design: ${importRes.status} ${errText.slice(0, 200)}`)
  }

  const importResponse = await importRes.json() as any
  const importJobId = importResponse.job?.id
  if (!importJobId) {
    throw new Error('Falha ao iniciar importacao')
  }

  // 4. Polling ate import terminar
  for (let i = 0; i < 20; i++) {
    const status = await canvaFetch<any>(`/imports/${importJobId}`)
    if (status.job?.status === 'completed' || status.job?.status === 'success') {
      const designId =
        status.job?.result?.design?.id ||
        status.job?.result?.designs?.[0]?.id ||
        status.job?.design?.id ||
        status.design?.id ||
        status.result?.design?.id
      if (!designId) throw new Error('Design ID nao encontrado na resposta')

      // Obter info completa do novo design
      const newDesign = await canvaGetDesign(designId)
      return {
        design_id: newDesign.id,
        title: newDesign.title,
        edit_url: newDesign.urls.edit_url,
        view_url: newDesign.urls.view_url,
      }
    }
    if (status.job?.status === 'failed') {
      const reason = status.job?.error?.message || 'Falha ao importar design copiado'
      throw new Error(reason)
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  throw new Error('Timeout ao importar design copiado')
}
