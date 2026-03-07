const decodeBase64ToBytes = (base64: string): Uint8Array => {
  const normalized = String(base64 || '').replace(/\s+/g, '')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const blobFromDataLikeUrl = async (value: string): Promise<Blob> => {
  const raw = String(value || '').trim()
  if (!raw) {
    throw new Error('URL de dados vazia')
  }

  if (raw.startsWith('data:')) {
    const commaIndex = raw.indexOf(',')
    if (commaIndex < 0) {
      throw new Error('Data URL inválida')
    }

    const header = raw.slice(5, commaIndex)
    const payload = raw.slice(commaIndex + 1)
    const parts = header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)

    const mimeType = parts.find((part) => !part.includes('=')) || 'application/octet-stream'
    const isBase64 = parts.includes('base64')

    if (isBase64) {
      const bytes = decodeBase64ToBytes(payload)
      const buffer = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(buffer).set(bytes)
      return new Blob([buffer], { type: mimeType })
    }

    let decodedPayload = payload
    try {
      decodedPayload = decodeURIComponent(payload)
    } catch {
      // keep original payload when it is already decoded
    }
    return new Blob([decodedPayload], { type: mimeType })
  }

  if (
    raw.startsWith('blob:') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('/')
  ) {
    const response = await fetch(raw)
    if (!response.ok) {
      throw new Error(`Falha ao preparar arquivo para compartilhamento (status ${response.status})`)
    }

    const blob = await response.blob()
    if (!blob || blob.size <= 0) {
      throw new Error('Blob de exportação vazio')
    }
    return blob
  }

  throw new Error('Formato de URL não suportado para conversão em blob')
}
