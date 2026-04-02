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

  // Fallback: usar token do .env (process.env e mais confiavel em server/utils)
  let token = ''
  try {
    token = config.canvaAccessToken || ''
  } catch {
    // useRuntimeConfig pode falhar fora de event handler
  }
  if (!token) {
    token = process.env.CANVA_ACCESS_TOKEN
      || process.env.NUXT_CANVA_ACCESS_TOKEN
      || ''
  }

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
export const canvaFetch = async <T = any>(
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

// Resposta completa da transacao de edicao (inclui richtexts, fills, thumbnails, pages)
export const canvaStartEditingTransaction = async (designId: string): Promise<any> => {
  return canvaFetch<any>('/editing-sessions', {
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

// ── Duplicar Pagina ────────────────────────────────────────────────────────

/**
 * Tentar duplicar uma pagina de um design via editing transaction.
 * A Canva Connect API nao possui operacao nativa de "duplicate_page",
 * entao tentamos via editing operations. Se falhar, retorna fallback
 * com link para edicao manual no Canva.
 */
export const canvaDuplicatePage = async (
  designId: string,
  pageIndex: number = 1
): Promise<{
  success: boolean
  manual_required: boolean
  edit_url: string
  message: string
  transaction_id?: string
}> => {
  try {
    // 1. Iniciar sessao de edicao
    const session = await canvaStartEditingTransaction(designId)
    const transactionId = session.id || session.editing_session?.id

    if (!transactionId) {
      throw new Error('Nao foi possivel obter ID da sessao de edicao')
    }

    // 2. Tentar operacao de duplicar pagina
    try {
      await canvaPerformEditingOperations(transactionId, [
        { type: 'duplicate_page', page_index: pageIndex },
      ], pageIndex)

      // 3. Commit da transacao
      await canvaCommitEditingTransaction(transactionId)

      return {
        success: true,
        manual_required: false,
        edit_url: `https://www.canva.com/design/${designId}/edit`,
        message: 'Pagina duplicada com sucesso via API.',
        transaction_id: transactionId,
      }
    } catch (opError: any) {
      // Operacao nao suportada - cancelar transacao e retornar fallback
      try {
        await canvaCancelEditingTransaction(transactionId)
      } catch {
        // Ignora erro ao cancelar - transacao pode ja ter expirado
      }

      // Fallback: orientar duplicacao manual
      return {
        success: false,
        manual_required: true,
        edit_url: `https://www.canva.com/design/${designId}/edit`,
        message: 'A Canva Connect API nao suporta duplicacao de paginas programaticamente. Abra o design no Canva, duplique a pagina desejada e volte para re-analisar.',
      }
    }
  } catch (err: any) {
    // Fallback geral - se nem a sessao de edicao abrir
    return {
      success: false,
      manual_required: true,
      edit_url: `https://www.canva.com/design/${designId}/edit`,
      message: 'Nao foi possivel duplicar via API. Abra o design no Canva, duplique a pagina desejada e volte para re-analisar.',
    }
  }
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

// ── Copiar Design (via export+import) ───────────────────────────────────────

/**
 * Copiar um design do Canva criando uma nova copia.
 * Estrategia: exportar como PDF e reimportar como novo design.
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
      throw new Error('Falha ao exportar design original')
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  if (!exportUrl) {
    throw new Error('Timeout ao exportar design original')
  }

  // 3. Importar como novo design
  const importResponse = await canvaFetch<any>('/imports', {
    method: 'POST',
    body: { url: exportUrl, title: newTitle },
  })

  const importJobId = importResponse.job?.id
  if (!importJobId) {
    throw new Error('Falha ao iniciar importacao')
  }

  // 4. Polling ate import terminar
  for (let i = 0; i < 20; i++) {
    const status = await canvaFetch<any>(`/imports/${importJobId}`)
    if (status.job?.status === 'completed' || status.job?.status === 'success') {
      const designId = status.job?.design?.id || status.job?.result?.design?.id
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
      throw new Error('Falha ao importar design copiado')
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  throw new Error('Timeout ao importar design copiado')
}
