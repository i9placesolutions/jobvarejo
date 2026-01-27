export const useUpload = () => {
    const isUploading = ref(false)
    const error = ref<string | null>(null)

    const uploadFile = async (file: File) => {
        isUploading.value = true
        error.value = null

        const formData = new FormData()
        formData.append('file', file)

        try {
            const data = await $fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            return data as { url: string, success: boolean }
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
