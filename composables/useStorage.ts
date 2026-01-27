import { ref } from 'vue'

/**
 * Contabo Storage Composable
 *
 * Armazena dados pesados do canvas na Contabo Storage via API.
 * Isso reduz drasticamente o uso do banco de dados e custos.
 *
 * Contabo Object Storage é compatível com AWS S3.
 *
 * Estrutura de arquivos:
 * - projects/{userId}/{projectId}/page_{pageId}.json  → Canvas JSON
 * - projects/{userId}/{projectId}/thumb_{pageId}.png   → Thumbnail
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const saveStatus = ref<SaveStatus>('idle')
const lastSavedAt = ref<Date | null>(null)
const saveError = ref<string | null>(null)

/**
 * Configuração da Contabo Storage
 * Estas credenciais devem estar nas variáveis de ambiente
 */
interface ContaboConfig {
  endpoint: string      // e.g., 'eu2.contabostorage.com' ou endpoint personalizado
  bucket: string        // Nome do bucket
  accessKey: string     // S3 Access Key
  secretKey: string     // S3 Secret Key
  region: string        // e.g., 'eu-2'
}

/**
 * Gera assinatura AWS Signature V2 para autenticação S3
 */
function generateSignature(
  method: string,
  contentType: string,
  date: string,
  resource: string,
  secretKey: string
): string {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`
  const signature = crypto.subtle
    .importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    .then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign)))
    .then(buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))))
  return signature as any
}

/**
 * Upload simples para Contabo via presigned URL ou direto
 * Para simplificar, vamos usar fetch com auth headers
 */
async function uploadToContabo(
  file: Blob | File,
  key: string,
  contentType: string,
  config: ContaboConfig
): Promise<string> {
  // URL do endpoint
  const url = `https://${config.bucket}.${config.endpoint}/${key}`

  // Para upload simples, usamos presigned URL gerada no backend
  // OU enviamos diretamente com as credenciais S3

  // Opção 1: Upload via presigned URL (requisitar do backend)
  const presignedUrl = await getPresignedUrl(key, contentType, 'put')

  if (presignedUrl) {
    // Upload usando presigned URL
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': contentType
      }
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    return `https://${config.bucket}.${config.endpoint}/${key}`
  }

  throw new Error('Failed to get presigned URL')
}

/**
 * Obtém presigned URL do backend para upload/download
 * Isso evita expor credenciais S3 no frontend
 */
async function getPresignedUrl(
  key: string,
  contentType?: string,
  operation: 'put' | 'get' = 'put'
): Promise<string | null> {
  try {
    const data = await $fetch('/api/storage/presigned', {
      method: 'POST',
      body: { key, contentType, operation }
    })
    return data.url
  } catch (error) {
    console.error('Error getting presigned URL:', error)
    return null
  }
}

export const useStorage = () => {
  const auth = useAuth()

  /**
   * Salva dados JSON na Contabo Storage
   */
  const saveCanvasData = async (
    projectId: string,
    pageId: string,
    canvasJson: any
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

    try {
      // Caminho do arquivo: projects/{userId}/{projectId}/page_{pageId}.json
      const key = `projects/${userId}/${projectId}/page_${pageId}.json`

      // Converter JSON para Blob
      const jsonString = JSON.stringify(canvasJson)
      const blob = new Blob([jsonString], { type: 'application/json' })

      // Obter presigned URL para upload
      const presignedUrl = await getPresignedUrl(key, 'application/json', 'put')
      if (!presignedUrl) {
        throw new Error('Failed to get upload URL')
      }

      // Upload para Contabo
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      // Retornar a chave do arquivo (para salvar no banco)
      lastSavedAt.value = new Date()
      saveStatus.value = 'saved'

      return key
    } catch (error: any) {
      console.error('Erro ao salvar na Contabo:', error)
      saveStatus.value = 'error'
      saveError.value = error?.message || 'Erro desconhecido'
      return null
    }
  }

  /**
   * Carrega dados JSON da Contabo Storage usando o caminho completo
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

      // Obter presigned URL para download
      const presignedUrl = await getPresignedUrl(canvasDataPath, undefined, 'get')
      if (!presignedUrl) {
        console.log('⚠️ Presigned URL não retornada')
        return null
      }

      // Buscar o JSON
      const response = await fetch(presignedUrl)
      if (!response.ok) {
        console.log('⚠️ Resposta não OK:', response.status)
        if (response.status === 404) {
          return null // Arquivo não existe ainda
        }
        throw new Error('Falha ao carregar dados do canvas')
      }

      const canvasJson = await response.json()
      console.log('✅ JSON carregado com sucesso, objetos:', canvasJson?.objects?.length || 0)
      return canvasJson
    } catch (error: any) {
      console.error('❌ Erro ao carregar da Contabo:', error)
      return null
    }
  }

  /**
   * Carrega dados JSON da Contabo Storage
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

      // Obter presigned URL para download
      const presignedUrl = await getPresignedUrl(key, undefined, 'get')
      if (!presignedUrl) {
        // Arquivo pode não existir
        return null
      }

      // Buscar o JSON
      const response = await fetch(presignedUrl)
      if (!response.ok) {
        if (response.status === 404) {
          return null // Arquivo não existe ainda
        }
        throw new Error('Falha ao carregar dados do canvas')
      }

      const canvasJson = await response.json()
      return canvasJson
    } catch (error: any) {
      console.error('Erro ao carregar da Contabo:', error)
      return null
    }
  }

  /**
   * Salva thumbnail na Contabo Storage
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

      // Converter DataURL para Blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Obter presigned URL
      const presignedUrl = await getPresignedUrl(key, 'image/png', 'put')
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

      // Retornar a URL pública completa
      return getPublicUrl(key)
    } catch (error: any) {
      console.error('Erro ao salvar thumbnail:', error)
      return null
    }
  }

  /**
   * Obtém URL pública para um arquivo
   * Contabo usa path style: https://endpoint/bucket/key
   */
  const getPublicUrl = (key: string): string => {
    const config = useRuntimeConfig().public.contabo || {}
    const endpoint = config.endpoint || 'usc1.contabostorage.com'
    const bucket = config.bucket || 'jobupload'
    return `https://${endpoint}/${bucket}/${key}`
  }

  /**
   * Deleta todos os arquivos de um projeto
   */
  const deleteProjectFiles = async (projectId: string): Promise<void> => {
    const userId = auth.user.value?.id
    if (!userId) return

    try {
      // Deletar via API backend
      await fetch('/api/storage/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
    saveThumbnail,
    deleteProjectFiles,
    saveProjectPages,
    loadProjectPages,
    getPublicUrl
  }
}

/**
 * ============================================================================
 * API ENDPOINT QUE PRECISA SER CRIADO NO BACKEND (Nuxt API Route)
 * ============================================================================
 *
 * Criar arquivo: server/api/storage/presigned.post.ts
 *
 * import crypto from 'crypto'
 *
 * export default defineEventHandler(async (event) => {
 *   const body = await readBody(event)
 *   const { key, contentType, operation = 'put' } = body
 *
 *   // Configurações da Contabo (variáveis de ambiente)
 *   const config = {
 *     endpoint: process.env.CONTABO_ENDPOINT || 'eu2.contabostorage.com',
 *     bucket: process.env.CONTABO_BUCKET || 'seu-bucket',
 *     accessKey: process.env.CONTABO_ACCESS_KEY,
 *     secretKey: process.env.CONTABO_SECRET_KEY,
 *     region: process.env.CONTABO_REGION || 'eu-2'
 *   }
 *
 *   if (!config.accessKey || !config.secretKey) {
 *     throw createError({
 *       status: 500,
 *       message: 'Storage not configured'
 *     })
 *   }
 *
 *   // Gerar presigned URL
 *   const expiration = Math.floor(Date.now() / 1000) + 3600 // 1 hora
 *   const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
 *
 *   // AWS Signature V4 (ou V2 dependendo da Contabo)
 *   // Simplificando: usar SDK AWS S3
 *
 *   const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
 *
 *   const s3Client = new S3Client({
 *     endpoint: `https://${config.endpoint}`,
 *     region: config.region,
 *     credentials: {
 *       accessKeyId: config.accessKey,
 *       secretAccessKey: config.secretKey
 *     },
 *     forcePathStyle: true // Importante para Contabo
 *   })
 *
 *   let command
 *   if (operation === 'put') {
 *     command = new PutObjectCommand({
 *       Bucket: config.bucket,
 *       Key: key,
 *       ContentType: contentType
 *     })
 *   } else {
 *     command = new GetObjectCommand({
 *       Bucket: config.bucket,
 *       Key: key
 *     })
 *   }
 *
 *   const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
 *
 *   return { url }
 * })
 *
 *
 * ============================================================================
 * ARQUIVO: .env (adicionar variáveis)
 * ============================================================================
 *
 * CONTABO_ENDPOINT=eu2.contabostorage.com
 * CONTABO_BUCKET=seu-nome-de-bucket
 * CONTABO_ACCESS_KEY=sua-access-key
 * CONTABO_SECRET_KEY=sua-secret-key
 * CONTABO_REGION=eu-2
 *
 *
 * ============================================================================
 * PARA INSTALAR: npm install @aws-sdk/client-s3
 * ============================================================================
 */
