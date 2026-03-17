export type StyleReference = {
  id: string
  s3Key: string
  displayName: string | null
  styleAnalysis: Record<string, any>
  tags: string[]
  usageCount: number
  createdAt: string
  url: string | null
}

const items = ref<StyleReference[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const error = ref<string | null>(null)

export const useStyleReferences = () => {
  const loadReferences = async () => {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ items: StyleReference[] }>('/api/style-references')
      items.value = data.items || []
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Erro ao carregar inspiracoes'
      console.warn('[useStyleReferences] loadReferences failed:', error.value)
    } finally {
      isLoading.value = false
    }
  }

  const uploadReference = async (file: File, opts?: { displayName?: string; tags?: string[] }) => {
    isUploading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (opts?.displayName) formData.append('displayName', opts.displayName)
      if (opts?.tags?.length) formData.append('tags', JSON.stringify(opts.tags))

      const result = await $fetch<StyleReference>('/api/style-references', {
        method: 'POST',
        body: formData
      })

      items.value = [result, ...items.value]
      return result
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Erro ao enviar inspiracao'
      throw err
    } finally {
      isUploading.value = false
    }
  }

  const deleteReference = async (id: string) => {
    error.value = null
    try {
      await $fetch('/api/style-references', {
        method: 'DELETE',
        body: { id }
      })
      items.value = items.value.filter(r => r.id !== id)
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Erro ao deletar inspiracao'
      throw err
    }
  }

  const generateInstitutional = async (opts: {
    prompt: string
    size?: string
    title?: string
    subtitle?: string
    tagFilter?: string
  }) => {
    error.value = null
    try {
      const result = await $fetch<{
        success: boolean
        imageUrl: string
        imageKey: string
        canvasData: any
        styleNotesUsed: string | null
        inspirationsUsed: number
      }>('/api/ai/institutional/generate', {
        method: 'POST',
        body: opts
      })
      return result
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Erro ao gerar arte'
      throw err
    }
  }

  // Todas as tags únicas das inspirações do usuário
  const allTags = computed(() => {
    const tagSet = new Set<string>()
    for (const item of items.value) {
      for (const tag of (item.tags || [])) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort()
  })

  return {
    items: readonly(items),
    isLoading: readonly(isLoading),
    isUploading: readonly(isUploading),
    error: readonly(error),
    allTags,
    loadReferences,
    uploadReference,
    deleteReference,
    generateInstitutional,
  }
}
