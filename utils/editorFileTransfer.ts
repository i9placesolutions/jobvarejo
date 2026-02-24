export type DownloadFileOptions = {
  revokeBlobUrl?: boolean
  revokeDelayMs?: number
}

export type DownloadPayload = {
  dataURL: string
  fileName: string
  format: string
}

export type DownloadMultipleOptions = {
  delayMs?: number
  downloadFileFn?: (url: string, name: string) => void
}

export const downloadFile = (url: string, name: string, opts: DownloadFileOptions = {}) => {
  if (typeof document === 'undefined') return
  const link = document.createElement('a')
  link.download = name
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  const shouldRevokeBlobUrl = opts.revokeBlobUrl !== false
  const revokeDelayMs = Math.max(0, Number(opts.revokeDelayMs ?? 1000))
  if (shouldRevokeBlobUrl && typeof url === 'string' && url.startsWith('blob:')) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    }, revokeDelayMs)
  }
}

export const downloadMultipleFiles = async (
  files: DownloadPayload[],
  opts: DownloadMultipleOptions = {}
) => {
  const delayMs = Math.max(0, Number(opts.delayMs ?? 300))
  const runDownload = opts.downloadFileFn || ((url: string, name: string) => downloadFile(url, name))

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    runDownload(file.dataURL, `${file.fileName}.${file.format}`)
    if (i < files.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

export const shareFileFromDataUrl = async (
  dataURL: string,
  fileName: string,
  title: string = 'Design export'
): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  try {
    const response = await fetch(dataURL)
    if (!response.ok) {
      throw new Error(`Falha ao preparar arquivo para compartilhamento (status ${response.status})`)
    }

    const blob = await response.blob()
    const file = new File([blob], fileName, { type: blob.type })
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      const hasUserGesture = (navigator as any)?.userActivation?.isActive === true
      if (!hasUserGesture) {
        console.warn('[Share] Ação bloqueada: é necessário clicar novamente para compartilhar (gesto do usuário).')
        return false
      }
      try {
        await navigator.share({
          title,
          files: [file]
        })
        return true
      } catch (err) {
        const errName = String((err as Error)?.name || '')
        if (errName === 'AbortError') return false
        if (errName === 'NotAllowedError') {
          console.warn('[Share] Compartilhamento bloqueado pelo navegador. Tente novamente pelo botão de compartilhar.')
          return false
        }
        if (errName !== 'AbortError') {
          console.error('[Share] Error sharing:', err)
        }
        return false
      }
    }

    console.warn('[Share] Web Share API not supported or file not shareable')
    return false
  } catch (err) {
    console.error('[Share] Error preparing share file:', err)
    return false
  }
}
