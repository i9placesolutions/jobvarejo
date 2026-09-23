import { assertSafeExternalHttpUrl } from './url-safety'

const UAZAPI_FAILURE_STATUSES = new Set(['error', 'failed', 'failure', 'rejected', 'denied', 'not_sent'])

export const isUazapiSendRejected = (result: unknown): boolean => {
  if (!result || typeof result !== 'object') return false

  const root = result as Record<string, unknown>
  const candidates = [root, root.response, root.data]

  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false
    const payload = candidate as Record<string, unknown>
    const status = String(payload.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    const hasError = payload.error !== undefined && payload.error !== null && payload.error !== false && payload.error !== ''

    return payload.success === false || payload.ok === false || hasError || UAZAPI_FAILURE_STATUSES.has(status)
  })
}

export const sendWhatsAppText = async (params: { phone: string; text: string }): Promise<void> => {
  const config = useRuntimeConfig()
  const rawBaseUrl = String((config as any).uazapiServerUrl || '').trim()
  const instanceToken = String((config as any).uazapiInstanceToken || '').trim()

  if (!rawBaseUrl || !instanceToken) {
    throw createError({ statusCode: 503, statusMessage: 'A confirmação por WhatsApp está indisponível no momento.' })
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(assertSafeExternalHttpUrl(rawBaseUrl, { maxLength: 512 }))
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'A confirmação por WhatsApp está indisponível no momento.' })
  }

  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search) {
    throw createError({ statusCode: 503, statusMessage: 'A confirmação por WhatsApp está indisponível no momento.' })
  }

  const endpoint = `${baseUrl.toString().replace(/\/+$/, '')}/send/text`
  const number = params.phone.replace(/\D/g, '')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        token: instanceToken
      },
      body: JSON.stringify({ number, text: params.text }),
      redirect: 'error',
      signal: AbortSignal.timeout(12_000)
    })

    if (!response.ok) {
      throw new Error(`uazapi status ${response.status}`)
    }

    const result = await response.json().catch(() => null)
    if (isUazapiSendRejected(result)) {
      throw new Error('uazapi rejected the message send')
    }
  } catch {
    // Do not log the request body, destination phone, or instance credential.
    throw createError({ statusCode: 503, statusMessage: 'Não foi possível enviar o código pelo WhatsApp. Tente novamente mais tarde.' })
  }
}
