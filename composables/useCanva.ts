import type {
  CanvaDesign,
  CanvaProductMapping,
  CanvaMappedProduct,
  CanvaTransaction,
  CanvaTransactionPage,
  CanvaTransactionElement,
} from '~/types/canva'

// Estado global compartilhado entre componentes
const designs = ref<CanvaDesign[]>([])
const isLoadingDesigns = ref(false)
const searchQuery = ref('')
const continuation = ref<string | null>(null)
const hasMore = ref(false)

const selectedDesign = ref<CanvaDesign | null>(null)
const transaction = ref<CanvaTransaction | null>(null)
const mappings = ref<CanvaProductMapping[]>([])
const isProcessing = ref(false)
const error = ref<string | null>(null)

export const useCanva = () => {
  // Buscar designs do Canva via API server-side
  const fetchDesigns = async (query?: string, loadMore = false) => {
    isLoadingDesigns.value = true
    error.value = null
    try {
      const params: Record<string, string> = {}
      if (query) params.query = query
      if (loadMore && continuation.value) params.continuation = continuation.value
      if (!loadMore) {
        params.sort_by = 'modified_descending'
      }

      const data = await $fetch<{
        designs: CanvaDesign[]
        continuation?: string
      }>('/api/canva/designs', { query: params })

      if (loadMore) {
        designs.value = [...designs.value, ...(data.designs || [])]
      } else {
        designs.value = data.designs || []
      }
      continuation.value = data.continuation || null
      hasMore.value = !!data.continuation
    } catch (err: any) {
      console.error('Erro ao buscar designs do Canva:', err)
      error.value = err?.data?.message || 'Erro ao buscar designs'
      if (!loadMore) designs.value = []
    } finally {
      isLoadingDesigns.value = false
    }
  }

  // Analisar estrutura do design (detectar produtos automaticamente)
  const designAnalysis = ref<any>(null)

  const analyzeDesign = async (designId: string) => {
    isProcessing.value = true
    error.value = null
    try {
      const data = await $fetch<any>(`/api/canva/designs/${designId}/analyze-smart`, {
        method: 'POST',
      })
      designAnalysis.value = data
      return data
    } catch (err: any) {
      console.error('Erro ao analisar design:', err)
      error.value = err?.data?.message || 'Erro ao analisar design'
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  // Iniciar transacao de edicao - le o conteudo do design
  const startTransaction = async (designId: string) => {
    isProcessing.value = true
    error.value = null
    try {
      const data = await $fetch<CanvaTransaction>(`/api/canva/designs/${designId}/transaction`, {
        method: 'POST',
      })
      transaction.value = data
      return data
    } catch (err: any) {
      console.error('Erro ao iniciar transacao:', err)
      error.value = err?.data?.message || 'Erro ao abrir design para edicao'
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  // Detectar slots de produtos no design (textos e imagens)
  const detectSlots = (pages: CanvaTransactionPage[]): CanvaProductMapping[] => {
    const detectedMappings: CanvaProductMapping[] = []
    let slotIndex = 0

    for (const page of pages) {
      for (const element of page.elements) {
        if (element.type === 'richtext' && element.text) {
          // Detectar se parece nome de produto ou preco
          const text = element.text.trim()
          const isPricePattern = /^R?\$?\s*\d+[.,]\d{2}$/.test(text) || /^\d+[.,]\d{2}$/.test(text)
          const isUnit = /^(UN|KG|G|L|ML|PCT|CX|DZ|BD|FD|SC|100G|500G)$/i.test(text)

          let type: 'name' | 'price' | 'unit' = 'name'
          if (isPricePattern) type = 'price'
          else if (isUnit) type = 'unit'

          detectedMappings.push({
            slot_index: slotIndex++,
            element_id: element.id,
            type,
            page_index: page.index,
            page_id: page.id,
          })
        } else if (element.type === 'image') {
          detectedMappings.push({
            slot_index: slotIndex++,
            element_id: element.id,
            type: 'image',
            page_index: page.index,
            page_id: page.id,
          })
        }
      }
    }

    mappings.value = detectedMappings
    return detectedMappings
  }

  // Mapear produto a um slot
  const mapProductToSlot = (slotIndex: number, product: CanvaMappedProduct) => {
    const mapping = mappings.value.find(m => m.slot_index === slotIndex)
    if (mapping) {
      mapping.product = product
    }
  }

  // Aplicar substituicoes no design
  const applyMappings = async (transactionId: string) => {
    isProcessing.value = true
    error.value = null
    try {
      const data = await $fetch<{ success: boolean; errors: string[] }>(`/api/canva/designs/apply`, {
        method: 'POST',
        body: {
          transaction_id: transactionId,
          mappings: mappings.value.filter(m => m.product),
        },
      })
      return data
    } catch (err: any) {
      console.error('Erro ao aplicar mapeamentos:', err)
      error.value = err?.data?.message || 'Erro ao substituir produtos'
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  // Confirmar (commit) as alteracoes
  const commitTransaction = async (transactionId: string) => {
    isProcessing.value = true
    try {
      await $fetch(`/api/canva/designs/commit`, {
        method: 'POST',
        body: { transaction_id: transactionId },
      })
    } catch (err: any) {
      console.error('Erro ao salvar alteracoes:', err)
      error.value = err?.data?.message || 'Erro ao salvar no Canva'
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  // Cancelar transacao
  const cancelTransaction = async (transactionId: string) => {
    try {
      await $fetch(`/api/canva/designs/cancel`, {
        method: 'POST',
        body: { transaction_id: transactionId },
      })
    } catch (err: any) {
      console.error('Erro ao cancelar transacao:', err)
    } finally {
      transaction.value = null
      mappings.value = []
    }
  }

  // Exportar design
  const exportDesign = async (designId: string, format: 'pdf' | 'png' | 'jpg' = 'png') => {
    isProcessing.value = true
    try {
      const data = await $fetch<{ download_url: string }>(`/api/canva/designs/${designId}/export`, {
        method: 'POST',
        body: { format },
      })
      return data.download_url
    } catch (err: any) {
      console.error('Erro ao exportar design:', err)
      error.value = err?.data?.message || 'Erro ao exportar'
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  // Upload de imagem do Wasabi para o Canva
  const uploadImageToCanva = async (wasabiKey: string, name: string) => {
    try {
      const data = await $fetch<{ asset_id: string }>('/api/canva/upload-asset', {
        method: 'POST',
        body: { wasabi_key: wasabiKey, name },
      })
      return data.asset_id
    } catch (err: any) {
      console.error('Erro ao fazer upload para Canva:', err)
      throw err
    }
  }

  // Limpar estado
  const reset = () => {
    selectedDesign.value = null
    transaction.value = null
    mappings.value = []
    error.value = null
    isProcessing.value = false
  }

  return {
    // Estado
    designs,
    isLoadingDesigns,
    searchQuery,
    hasMore,
    selectedDesign,
    transaction,
    mappings,
    isProcessing,
    error,
    designAnalysis,

    // Acoes
    fetchDesigns,
    analyzeDesign,
    startTransaction,
    detectSlots,
    mapProductToSlot,
    applyMappings,
    commitTransaction,
    cancelTransaction,
    exportDesign,
    uploadImageToCanva,
    reset,
  }
}
