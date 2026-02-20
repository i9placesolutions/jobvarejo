export const useUpload = () => {
    const isUploading = ref(false)
    const error = ref<string | null>(null)
    const { getApiAuthHeaders } = useApiAuth()

    type UploadResult = {
        url: string
        success: boolean
        key?: string
        dedup?: boolean
        contentType?: string
        originalBytes?: number
        storedBytes?: number
    }

    const uploadSingle = async (file: File): Promise<UploadResult> => {
        const formData = new FormData()
        formData.append('file', file)
        const headers = await getApiAuthHeaders()
        const data = await $fetch('/api/upload', {
            method: 'POST',
            headers,
            body: formData
        })
        return data as UploadResult
    }

    const uploadFile = async (file: File): Promise<UploadResult> => {
        isUploading.value = true
        error.value = null
        try {
            return await uploadSingle(file)
        } catch (err: any) {
            console.error('Upload failed:', err)
            error.value = err?.message || 'Falha no upload'
            throw err
        } finally {
            isUploading.value = false
        }
    }

    const uploadFiles = async (
        files: File[],
        opts?: {
            onProgress?: (info: { done: number; total: number; file: File; ok: boolean }) => void
            continueOnError?: boolean
        }
    ): Promise<Array<{ file: File; result?: UploadResult; error?: any }>> => {
        const list = Array.isArray(files) ? files.filter(Boolean) : []
        isUploading.value = true
        error.value = null
        const out: Array<{ file: File; result?: UploadResult; error?: any }> = []
        const total = list.length
        const continueOnError = opts?.continueOnError !== false

        try {
            let done = 0
            for (const file of list) {
                try {
                    const result = await uploadSingle(file)
                    done += 1
                    out.push({ file, result })
                    opts?.onProgress?.({ done, total, file, ok: true })
                } catch (e: any) {
                    done += 1
                    out.push({ file, error: e })
                    opts?.onProgress?.({ done, total, file, ok: false })
                    if (!continueOnError) throw e
                }
            }
        } catch (err: any) {
            console.error('Upload batch failed:', err)
            error.value = err?.message || 'Falha no upload'
            throw err
        } finally {
            isUploading.value = false
        }

        return out
    }

    return {
        uploadFile,
        uploadFiles,
        isUploading,
        error
    }
}
