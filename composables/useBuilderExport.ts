export const useBuilderExport = () => {
  const isExporting = ref(false)
  const { tenant } = useBuilderAuth()

  const exportAsPng = async (
    element: HTMLElement,
    opts?: { scale?: number },
  ): Promise<Blob> => {
    const { default: html2canvas } = await import('html2canvas-pro')
    const scale = opts?.scale ?? 2

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
    })

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Falha ao gerar imagem PNG'))
        },
        'image/png',
      )
    })
  }

  const downloadPng = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const uploadSnapshot = async (blob: Blob, flyerId: string): Promise<string> => {
    if (!tenant.value?.id) throw new Error('Usuario nao autenticado')

    const key = `builder/${tenant.value.id}/flyers/${flyerId}/snapshot.png`

    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType: 'image/png' },
      headers: { 'Content-Type': 'image/png' },
      body: blob,
    })

    // Build public URL from runtime config
    const config = useRuntimeConfig()
    const endpoint = (config.public as any).wasabi?.endpoint || 's3.wasabisys.com'
    const bucket = (config.public as any).wasabi?.bucket || 'jobvarejo'

    return `https://${endpoint}/${bucket}/${key}`
  }

  return { exportAsPng, downloadPng, uploadSnapshot, isExporting }
}
