export const useUpload = () => {
    const isUploading = ref(false)
    const error = ref<string | null>(null)
    const supabase = useSupabase()

    const getApiAuthHeaders = async () => {
        const { data, error } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (error || !token) {
            throw new Error('Sessão expirada. Faça login novamente.')
        }
        return { Authorization: `Bearer ${token}` }
    }

    const uploadFile = async (file: File) => {
        isUploading.value = true
        error.value = null

        const formData = new FormData()
        formData.append('file', file)

        try {
            const headers = await getApiAuthHeaders()
            const data = await $fetch('/api/upload', {
                method: 'POST',
                headers,
                body: formData
            })

            return data as {
                url: string
                success: boolean
                key?: string
                dedup?: boolean
                contentType?: string
                originalBytes?: number
                storedBytes?: number
            }
        } catch (err: any) {
            console.error('Upload failed:', err)
            error.value = err.message || 'Falha no upload'
            throw err
        } finally {
            isUploading.value = false
        }
    }

    return {
        uploadFile,
        isUploading,
        error
    }
}
