import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ frames: [] as any[], deny: false, closed: 0 }))
vi.mock('../../server/utils/auth', () => ({ requireAdminUser: async () => {
  if (state.deny) throw Object.assign(new Error('unauthorized'), { statusCode: 401 })
  return { user: { id: 'realtime-qa' }, role: 'super_admin' }
} }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('h3', async () => {
  const actual = await vi.importActual<any>('h3')
  return { ...actual, createEventStream: () => {
    let resolve: () => void
    const completion = new Promise<void>(done => { resolve = done })
    return { push: async (frame: any) => { state.frames.push(frame) }, onClosed: vi.fn(), send: () => completion, close: async () => { state.closed++; resolve!() } }
  } }
})
beforeEach(() => {
  state.frames = []; state.deny = false; state.closed = 0
  vi.stubGlobal('defineEventHandler', (handler: any) => handler)
  vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options))
  vi.stubEnv('JOBVAREJO_UAZAPI_URL', 'https://demo.uazapi.com')
  vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_TOKEN', 'sse-sensitive')
  vi.stubEnv('JOBVAREJO_UAZAPI_ADMIN_TOKEN', '')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('WhatsApp SSE proxy', () => {
  it('requires admin before opening upstream stream', async () => {
    state.deny = true
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../server/api/admin/whatsapp/realtime.get')
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('handles split CRLF and UTF8 frames, sanitizes and closes upstream', async () => {
    const frame = 'event: presence\r\ndata: {"token":"sse-sensitive","EventType":"presence","event":{"chatid":"self","presence":"composing"},"text":"olá"}\r\n\r\n'
    const bytes = new TextEncoder().encode(frame)
    const response = new Response(new ReadableStream({ start(controller) {
      // CRLF e caracteres multibyte atravessam múltiplos chunks.
      for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1))
      controller.close()
    } }), { headers: { 'content-type': 'text/event-stream' } })
    const fetchMock = vi.fn().mockResolvedValue(response); vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../server/api/admin/whatsapp/realtime.get')
    await handler({} as any)
    expect(state.frames[0].event).toBe('connected')
    const forwarded = state.frames.find(frame => frame.event === 'whatsapp')
    expect(JSON.parse(forwarded.data)).toEqual({ EventType: 'presence', event: { chatid: 'self', presence: 'composing' }, text: 'olá' })
    expect(forwarded.data).not.toContain('sse-sensitive')
    const requested = new URL((fetchMock.mock.calls[0] as any)[0])
    expect(requested.searchParams.get('events')).toContain('status_posts')
    expect(requested.searchParams.get('events')).toContain('newsletter_messages')
    expect(state.closed).toBe(1)
  })
})
