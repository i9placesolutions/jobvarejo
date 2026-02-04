import { ref, readonly } from 'vue'
import { useAuth } from './useAuth'
import { useStorage } from './useStorage'

/**
 * Composable para importação de arquivos PSD, PDF, AI
 *
 * Fluxo:
 * 1. Upload arquivo para API de conversão
 * 2. Converter para formato Fabric.js
 * 3. Salvar como design no dashboard
 */

export type ImportStatus = 'idle' | 'uploading' | 'converting' | 'saving' | 'success' | 'error'

export type ImportResult = {
  success: boolean
  fileId: string
  importData: {
    canvasWidth: number
    canvasHeight: number
    objects: any[]
    metadata: {
      originalFilename: string
      originalFormat: string
      convertedAt: string
      layerCount: number
    }
  }
  canvasJson: {
    version: string
    objects: any[]
  }
  urls: {
    original: string
    json: string
  }
}

export type ImportFormat = 'psd' | 'pdf' | 'ai'

const importStatus = ref<ImportStatus>('idle')
const importError = ref<string | null>(null)
const importProgress = ref(0)

export const useFileImport = () => {
  const auth = useAuth()
  const storage = useStorage()

  /**
   * Reset estado do import
   */
  const reset = () => {
    importStatus.value = 'idle'
    importError.value = null
    importProgress.value = 0
  }

  /**
   * Importa arquivo PSD
   * @param file Arquivo PSD a ser importado
   * @param options Opções de importação
   */
  const importPSD = async (
    file: File, 
    options?: { autoCenter?: boolean }
  ): Promise<ImportResult | null> => {
    if (!auth.user.value?.id) {
      importError.value = 'Usuário não autenticado'
      importStatus.value = 'error'
      return null
    }

    // Validar extensão
    if (!file.name.toLowerCase().endsWith('.psd')) {
      importError.value = 'Apenas arquivos .psd são suportados'
      importStatus.value = 'error'
      return null
    }

    // Validar tamanho (max 400MB)
    const maxSize = 400 * 1024 * 1024
    if (file.size > maxSize) {
      importError.value = 'Arquivo muito grande. Máximo: 400MB'
      importStatus.value = 'error'
      return null
    }

    importStatus.value = 'uploading'
    importError.value = null
    importProgress.value = 10

    try {
      // Criar FormData para upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', auth.user.value.id)
      
      // Desabilitar auto-center por padrão para manter posições originais do PSD
      const autoCenter = options?.autoCenter ?? false
      formData.append('autoCenter', autoCenter.toString())

      importStatus.value = 'converting'
      importProgress.value = 30

      // Enviar para API de conversão
      const result = await $fetch<ImportResult>('/api/import/convert-psd', {
        method: 'POST',
        body: formData,
        timeout: 600000 // 10 minutos timeout para PSDs grandes (até 400MB)
      })

      if (result?.success) {
        importProgress.value = 80
        importStatus.value = 'saving'

        return result
      }

      throw new Error(result ? 'Falha na conversão' : 'Sem resposta do servidor')

    } catch (error: any) {
      console.error('Erro ao importar PSD:', error)
      importError.value = error?.data?.message || error?.message || 'Erro ao importar arquivo'
      importStatus.value = 'error'
      return null
    }
  }

  /**
   * Importa arquivo PDF (futuro)
   */
  const importPDF = async (file: File): Promise<ImportResult | null> => {
    importError.value = 'Importação de PDF em desenvolvimento. Use PSD por enquanto.'
    importStatus.value = 'error'
    return null
  }

  /**
   * Importa arquivo AI (futuro)
   */
  const importAI = async (file: File): Promise<ImportResult | null> => {
    importError.value = 'Importação de AI em desenvolvimento. Use PSD por enquanto.'
    importStatus.value = 'error'
    return null
  }

  /**
   * Detecta formato e importa automaticamente
   */
  const importFile = async (
    file: File,
    options?: { autoCenter?: boolean }
  ): Promise<ImportResult | null> => {
    const ext = file.name.toLowerCase()

    if (ext.endsWith('.psd')) {
      return await importPSD(file, options)
    } else if (ext.endsWith('.pdf')) {
      return await importPDF(file)
    } else if (ext.endsWith('.ai')) {
      return await importAI(file)
    } else {
      importError.value = 'Formato não suportado. Use: .psd, .pdf, .ai'
      importStatus.value = 'error'
      return null
    }
  }

  /**
   * Salva resultado da importação como design
   */
  const saveAsDesign = async (
    importResult: ImportResult,
    designName: string
  ): Promise<any | null> => {
    if (!auth.user.value?.id) {
      importError.value = 'Usuário não autenticado'
      return null
    }

    importStatus.value = 'saving'
    importProgress.value = 90

    try {
      // Log para debug: mostrar o que foi recebido da importação
      console.log('=== saveAsDesign DEBUG ===')
      console.log('importResult:', importResult)
      console.log('canvasJson:', importResult.canvasJson)
      console.log('objects count:', importResult.canvasJson?.objects?.length || 0)
      console.log('canvas dimensions:', importResult.importData.canvasWidth, 'x', importResult.importData.canvasHeight)

      // Criar estrutura de página inicial compatível com o formato do dashboard
      const initialPage = {
        id: crypto.randomUUID(),
        name: 'Página 1',
        width: importResult.importData.canvasWidth,
        height: importResult.importData.canvasHeight,
        type: 'FREE_DESIGN',
        canvasData: importResult.canvasJson,
        thumbnail: undefined,
      }

      console.log('initialPage criada:', initialPage)

      // Marcar que este é um projeto importado de PSD para garantir que o viewport seja resetado ao abrir
      // Isso adiciona uma flag especial que o EditorCanvas usa para saber que deve fazer zoomToFit
      initialPage.canvasData = {
        ...importResult.canvasJson,
        __canvasViewport: {
          vpt: null, // null indica que deve fazer zoomToFit ao carregar
          _psdImport: true // flag adicional para identificar importações de PSD
        }
      }

      console.log('CanvasData com viewport flag:', initialPage.canvasData)
      console.log('=== DADOS QUE SERÃO SALVOS NO SUPABASE ===')
      console.log('initialPage:', JSON.stringify(initialPage, null, 2))
      console.log('initialPage.canvasData.objects:', initialPage.canvasData?.objects?.length || 0)

      // Salvar no Supabase
      // Nota: canvas_data contém o JSON do Fabric.js com URLs dos assets na Contabo
      const supabase = useSupabase()
      const payload = {
        name: designName,
        user_id: auth.user.value.id,
        canvas_data: [initialPage],
        updated_at: new Date().toISOString(),
      }
      console.log('Payload para Supabase:', JSON.stringify(payload, null, 2).substring(0, 2000))

      const { data, error } = await supabase
        .from('projects')
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('❌ ERRO DO SUPABASE:', error)
        throw error
      }

      console.log('=== DADOS VINDOS DO SUPABASE APÓS INSERT ===')
      console.log('Projeto salvo no Supabase:', data)
      console.log('canvas_data type:', typeof data?.canvas_data)
      console.log('canvas_data is array:', Array.isArray(data?.canvas_data))
      if (Array.isArray(data?.canvas_data) && data.canvas_data.length > 0) {
        console.log('Primeira página:', data.canvas_data[0])
        console.log('Primeira página.canvasData:', data.canvas_data[0]?.canvasData)
        console.log('Primeira página.canvasData.objects:', data.canvas_data[0]?.canvasData?.objects?.length || 0)
      }
      importProgress.value = 100
      importStatus.value = 'success'

      return data

    } catch (error: any) {
      console.error('Erro ao salvar design:', error)
      importError.value = error?.message || 'Erro ao salvar design'
      importStatus.value = 'error'
      return null
    }
  }

  /**
   * Carrega dados importados para o canvas
   */
  const loadIntoCanvas = async (
    importResult: ImportResult,
    canvas: any
  ): Promise<void> => {
    if (!canvas) {
      console.warn('Canvas não fornecido')
      return
    }

    return new Promise((resolve, reject) => {
      try {
        // Limpar canvas atual
        canvas.clear()

        // Carregar objetos convertidos
        canvas.loadFromJSON(importResult.canvasJson, () => {
          canvas.renderAll()
          resolve()
        })
      } catch (error) {
        console.error('Erro ao carregar no canvas:', error)
        reject(error)
      }
    })
  }

  /**
   * Workflow completo: importar + salvar
   */
  const importAndSave = async (
    file: File,
    designName?: string,
    options?: { autoCenter?: boolean }
  ): Promise<{ success: boolean; project?: any; error?: string }> => {
    reset()

    const result = await importFile(file, options)

    if (!result) {
      return {
        success: false,
        error: importError.value || 'Erro desconhecido'
      }
    }

    const name = designName || file.name.replace(/\.(psd|pdf|ai)$/i, '')

    const project = await saveAsDesign(result, name)

    if (!project) {
      return {
        success: false,
        error: importError.value || 'Erro ao salvar'
      }
    }

    return {
      success: true,
      project
    }
  }

  return {
    // Estado
    status: readonly(importStatus),
    error: readonly(importError),
    progress: readonly(importProgress),

    // Métodos
    reset,
    importPSD,
    importPDF,
    importAI,
    importFile,
    saveAsDesign,
    loadIntoCanvas,
    importAndSave
  }
}

/**
 * ============================================================================
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS (.env)
 * ============================================================================
 *
 * NUXT_CONTABO_IMPORT_BUCKET=jobimport
 *
 * ============================================================================
 * NOTAS DE USO
 * ============================================================================
 *
 * No componente:
 *
 * const { importPSD, saveAsDesign, status, error, importAndSave } = useFileImport()
 *
 * // Importar arquivo
 * const handleFileSelect = async (file: File) => {
 *   const result = await importAndSave(file, 'Meu Design')
 *   if (result.success) {
 *     console.log('Design salvo:', result.project)
 *   }
 * }
 */
