// Client HTTP para a Canva Connect REST API
// Documentacao: https://www.canva.dev/docs/connect/

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

let _accessToken: string | null = null
let _tokenExpiresAt: number = 0

/**
 * Obter access token do Canva.
 * Se o token expirou, tenta renovar automaticamente via refresh_token.
 */
const getAccessToken = async (): Promise<string> => {
  // Se o token ainda e valido, retorna
  if (_accessToken && Date.now() < _tokenExpiresAt) {
    return _accessToken
  }

  const config = useRuntimeConfig()

  // Tentar refresh se temos refresh_token
  const refreshToken = process.env.CANVA_REFRESH_TOKEN || ''
  const clientId = process.env.CANVA_CLIENT_ID || ''
  const clientSecret = process.env.CANVA_CLIENT_SECRET || ''

  if (_accessToken && refreshToken && clientId && clientSecret) {
    try {
      const newToken = await refreshAccessToken(refreshToken, clientId, clientSecret)
      if (newToken) return newToken
    } catch (err) {
      console.error('Falha ao renovar token do Canva:', err)
    }
  }

  // Fallback: usar token do .env
  const token = config.canvaAccessToken
    || process.env.CANVA_ACCESS_TOKEN
    || process.env.NUXT_CANVA_ACCESS_TOKEN
    || ''

  if (!token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CANVA_ACCESS_TOKEN nao configurado. Adicione ao .env ou rode: node scripts/canva-get-token.js',
    })
  }

  _accessToken = token
  // Token do .env - assumir 4h de validade a partir de agora
  _tokenExpiresAt = Date.now() + (14400 * 1000)
  return token
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
    console.error('Erro ao renovar token Canva:', await response.text())
    return null
  }

  const data = await response.json() as { access_token: string; expires_in: number }
  _accessToken = data.access_token
  _tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000 // 1min de margem
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
const canvaFetch = async <T = any>(
  path: string,
  options: {
    method?: string
    body?: any
    query?: Record<string, string | number | undefined>
  } = {}
): Promise<T> => {
  const token = await getAccessToken()
  const url = new URL(`${CANVA_API_BASE}${path}`)

  if (options.query) {
    for (const [key, val] of Object.entries(options.query)) {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val))
      }
    }
  }

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

  const response = await fetch(url.toString(), fetchOptions)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erro desconhecido')
    console.error(`Canva API error [${response.status}]: ${errorText}`)
    throw createError({
      statusCode: response.status,
      statusMessage: `Canva API: ${response.statusText}`,
      data: { canvaError: errorText },
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

interface CanvaEditingTransactionResponse {
  transaction: {
    id: string
    design: {
      id: string
      pages: Array<{
        id: string
        index: number
        elements: Array<{
          id: string
          type: string
          text?: string
          asset_id?: string
          dimensions?: { width: number; height: number; top: number; left: number }
        }>
        thumbnail?: { url: string }
      }>
    }
  }
}

export const canvaStartEditingTransaction = async (designId: string): Promise<CanvaEditingTransactionResponse> => {
  return canvaFetch<CanvaEditingTransactionResponse>('/editing-sessions', {
    method: 'POST',
    body: { design_id: designId },
  })
}

interface CanvaEditingOperation {
  type: string
  [key: string]: any
}

export const canvaPerformEditingOperations = async (
  transactionId: string,
  operations: CanvaEditingOperation[],
  pageIndex: number = 1
): Promise<any> => {
  return canvaFetch(`/editing-sessions/${transactionId}/operations`, {
    method: 'POST',
    body: { operations, page_index: pageIndex },
  })
}

export const canvaCommitEditingTransaction = async (transactionId: string): Promise<any> => {
  return canvaFetch(`/editing-sessions/${transactionId}/commit`, {
    method: 'POST',
  })
}

export const canvaCancelEditingTransaction = async (transactionId: string): Promise<any> => {
  return canvaFetch(`/editing-sessions/${transactionId}`, {
    method: 'DELETE',
  })
}

// ── Content ─────────────────────────────────────────────────────────────────

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

export const canvaGetDesignContent = async (
  designId: string,
  contentTypes: string[] = ['richtexts']
): Promise<CanvaDesignContentResponse> => {
  return canvaFetch<CanvaDesignContentResponse>(`/designs/${designId}/content`, {
    query: { content_types: contentTypes.join(',') },
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
  return canvaFetch<CanvaAssetUploadResponse>('/asset-uploads', {
    method: 'POST',
    body: { url, name },
  })
}

export const canvaGetAssetUploadJob = async (jobId: string): Promise<CanvaAssetUploadResponse> => {
  return canvaFetch<CanvaAssetUploadResponse>(`/asset-uploads/${jobId}`)
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
