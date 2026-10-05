import { createEventStream } from 'h3'
import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { sanitizeWhatsApp, whatsappAdminConfig, whatsappEvents, reserveWhatsAppStream } from '../../../utils/whatsapp-admin'

export default defineEventHandler(async event => {
  const { user } = await requireAdminUser(event)
  await enforceRateLimit(event, `whatsapp-sse:${user.id}`, 30, 60_000)
  const config = whatsappAdminConfig()
  const release = reserveWhatsAppStream(user.id)
  const stream = createEventStream(event)
  const controller = new AbortController()
  let closed = false
  const heartbeat = setInterval(() => { void stream.push({ event: 'heartbeat', data: String(Date.now()) }).catch(() => controller.abort()) }, 15_000)
  // Sessões longas são reautenticadas a cada 5 minutos pelo reconnect do EventSource.
  const connectTimeout = setTimeout(() => controller.abort(), 12_000)
  const expiry = setTimeout(() => controller.abort(), 5 * 60_000)
  stream.onClosed(async () => { closed = true; release(); controller.abort(); clearInterval(heartbeat); clearTimeout(expiry); clearTimeout(connectTimeout) })
  const pump = async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const url = new URL(`${config.base}/sse`)
      url.searchParams.set('token', config.token)
      url.searchParams.set('events', whatsappEvents.join(','))
      const response = await fetch(url, { headers: { accept: 'text/event-stream' }, redirect: 'error', signal: controller.signal })
      clearTimeout(connectTimeout)
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('upstream')
      await stream.push({ event: 'connected', data: JSON.stringify({ connected: true, at: new Date().toISOString() }) })
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      while (!closed) {
        const chunk = await reader.read()
        if (chunk.done) break
        pending += decoder.decode(chunk.value, { stream: true })
        if (pending.length > 8_000_000) throw new Error('frame too large')
        // SSE aceita LF e CRLF, inclusive separadores divididos entre chunks.
        let match: RegExpExecArray | null
        while ((match = /\r?\n\r?\n/.exec(pending))) {
          const frame = pending.slice(0, match.index)
          pending = pending.slice(match.index + match[0].length)
          const lines = frame.split(/\r?\n/)
          const name = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || ''
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
          if (!data) continue
          let payload: any
          try { payload = JSON.parse(data) } catch { continue }
          if (!payload || typeof payload !== 'object') continue
          const type = name || payload.EventType || payload.type || 'message'
          await stream.push({ event: 'whatsapp', data: JSON.stringify(sanitizeWhatsApp({ ...payload, EventType: payload.EventType || type }, [config.token, config.adminToken])) })
        }
      }
    } catch {
      if (!closed) await stream.push({ event: 'unavailable', data: JSON.stringify({ error: 'Conexão interrompida; sincronização será retomada.' }) }).catch(() => {})
    } finally {
      release()
      controller.abort()
      await reader?.cancel().catch(() => {})
      clearInterval(heartbeat); clearTimeout(expiry); clearTimeout(connectTimeout)
      if (!closed) await stream.close().catch(() => {})
    }
  }
  // Inicia o pump após registrar o fechamento; send mantém a resposta aberta.
  void pump()
  return stream.send()
})
