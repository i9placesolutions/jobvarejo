import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { buildWhatsAppRequest, callWhatsApp, getWhatsAppOperation, sanitizeWhatsApp, validateWhatsAppSchema, whatsappAdminConfig, whatsappOperations, assertWhatsAppSameOrigin, reserveWhatsAppStream } from '../../server/utils/whatsapp-admin'

beforeEach(() => {
  vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options))
  vi.stubGlobal('getHeader', (event: any, key: string) => event.headers?.[key])
  vi.stubEnv('JOBVAREJO_UAZAPI_URL', 'https://demo.uazapi.com')
  vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_TOKEN', 'instance-sensitive')
  vi.stubEnv('JOBVAREJO_UAZAPI_ADMIN_TOKEN', 'admin-sensitive')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('admin WhatsApp boundary', () => {
  it('fixes the provider origin and rejects private/unsafe URLs', () => {
    for (const url of ['http://demo.uazapi.com', 'https://127.0.0.1', 'https://evil.example', 'https://demo.uazapi.com?token=x', 'https://user:pass@demo.uazapi.com']) {
      vi.stubEnv('JOBVAREJO_UAZAPI_URL', url)
      expect(() => whatsappAdminConfig()).toThrow()
    }
  })
  it('does not silently connect the OTP instance', () => {
    vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_TOKEN', '')
    vi.stubEnv('UAZAPI_INSTANCE_TOKEN', 'otp')
    expect(() => whatsappAdminConfig()).toThrow()
  })
  it('strips credentials recursively including embedded secrets', () => {
    expect(sanitizeWhatsApp({ token: 'secret', openai_apikey: 'another-secret', nested: { admin_token: 'secret', text: 'url?token=secret', sendPayload: { file: 'private' } } }, ['secret'])).toEqual({ nested: { text: 'url?token=[protegido]' } })
  })
  it('redacts secret webhook URLs even when they use a different credential', () => {
    expect(sanitizeWhatsApp('https://host/hook?secret=other-credential')).toBe('https://host/hook?secret=[protegido]')
    expect(sanitizeWhatsApp('https://user:password@host/path')).toBe('https://[protegido]@host/path')
  })
  it('rejects operations outside the contract and SSE via execute', () => {
    expect(() => getWhatsAppOperation('https://evil.example')).toThrow()
    expect(() => getWhatsAppOperation('subscribeSSE')).toThrow()
    expect(new Set(whatsappOperations.map(x => x.id)).size).toBe(158)
  })
  it('allows only documented query/path parameters', () => {
    const op = getWhatsAppOperation('getGroupInviteLink')
    const request = buildWhatsAppRequest(op, { pathParams: { groupJID: '../../other' }, query: { token: 'evil' } }, 'https://demo.uazapi.com')
    expect(request.url).toBe('https://demo.uazapi.com/group/invitelink/..%2F..%2Fother')
    expect(() => buildWhatsAppRequest(op, { pathParams: { groupJID: '..' } }, 'https://demo.uazapi.com')).toThrow()
    expect(() => buildWhatsAppRequest(op, {}, 'https://demo.uazapi.com')).toThrow()
  })
  it('checks required types and enums from OpenAPI', () => {
    expect(() => validateWhatsAppSchema({ id: 2, text: '👍' }, getWhatsAppOperation('reactToMessage').bodySchema)).toThrow()
    expect(() => validateWhatsAppSchema({ id: 'm' }, getWhatsAppOperation('reactToMessage').bodySchema)).toThrow()
    expect(() => validateWhatsAppSchema({ number: '123', type: 'wrong', file: 'a' }, getWhatsAppOperation('sendMedia').bodySchema)).toThrow()
  })
  it('limits simultaneous streams and releases once', () => {
    const releases = [reserveWhatsAppStream('u'), reserveWhatsAppStream('u'), reserveWhatsAppStream('u')]
    expect(() => reserveWhatsAppStream('u')).toThrow()
    releases[0]!(); releases[0]!()
    const replacement = reserveWhatsAppStream('u')
    replacement(); releases.forEach(fn => fn())
  })
  it('validates schema alternatives and lengths', () => {
    expect(() => validateWhatsAppSchema({ name: 'Group', participants: 42 }, getWhatsAppOperation('createGroup').bodySchema)).toThrow()
    expect(() => validateWhatsAppSchema('a', { type: 'string', minLength: 2 })).toThrow()
    expect(() => validateWhatsAppSchema('abc', { type: 'string', pattern: '^x' })).toThrow()
    expect(() => validateWhatsAppSchema([], { type: 'array', minItems: 1 })).toThrow()
  })
  it('enforces required alternatives even when branches omit object type', () => {
    const labels = getWhatsAppOperation('setChatLabels')
    for (const choice of [{ labelids: ['1'] }, { add_labelid: '1' }, { remove_labelid: '1' }]) {
      expect(() => buildWhatsAppRequest(labels, { body: { number: '5511999999999', ...choice } }, 'https://demo.uazapi.com')).not.toThrow()
    }
    for (const choice of [{}, { labelids: ['1'], add_labelid: '2' }]) {
      expect(() => buildWhatsAppRequest(labels, { body: { number: '5511999999999', ...choice } }, 'https://demo.uazapi.com')).toThrow()
    }
    const payment = getWhatsAppOperation('sendRequestPayment').bodySchema
    expect(() => validateWhatsAppSchema({ number: '5511999999999' }, payment)).toThrow()
    for (const choice of [{ amount: 10 }, { orderMessageId: 'order' }, { amount: 10, orderMessageId: 'order' }]) {
      expect(() => validateWhatsAppSchema({ number: '5511999999999', ...choice }, payment)).not.toThrow()
    }
    expect(() => validateWhatsAppSchema({ number: '5511999999999', amount: '10' }, payment)).toThrow()
  })
  it('accepts the documented profile image alternatives without making descriptive examples exclusive', () => {
    const schema = getWhatsAppOperation('updateProfileImage').bodySchema
    for (const image of ['remove', 'delete', 'https://example.com/image.jpg', 'data:image/png;base64,YQ==']) {
      expect(() => validateWhatsAppSchema({ image }, schema)).not.toThrow()
    }
    expect(() => validateWhatsAppSchema({ image: 42 }, schema)).toThrow()
    expect(() => validateWhatsAppSchema({}, schema)).toThrow()
  })
  it('rejects cross-site browser mutations', () => {
    expect(() => assertWhatsAppSameOrigin({ headers: { origin: 'https://evil.example', host: 'jobvarejo.com.br' } } as any)).toThrow()
    expect(() => assertWhatsAppSameOrigin({ headers: { 'sec-fetch-site': 'cross-site' } } as any)).toThrow()
    expect(() => assertWhatsAppSameOrigin({ headers: { origin: 'https://jobvarejo.com.br', host: 'jobvarejo.com.br' } } as any)).not.toThrow()
  })
  it('blocks infrastructure operations for ordinary admins before network', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(callWhatsApp('listAllInstances', {}, 'admin')).rejects.toMatchObject({ statusCode: 403 })
    await expect(callWhatsApp('updateWebhook', { body: {} }, 'admin')).rejects.toMatchObject({ statusCode: 403 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('forwards only server credentials and masks failure bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'instance-sensitive', status: 'ok', nested: { text: 'admin-sensitive' } }), { headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await callWhatsApp('getInstanceStatus')
    expect(result).toEqual({ status: 'ok', nested: { text: '[protegido]' } })
    expect((fetchMock.mock.calls[0] as any)[1].headers.token).toBe('instance-sensitive')
    fetchMock.mockResolvedValue(new Response('secret error details', { status: 401 }))
    await expect(callWhatsApp('getInstanceStatus')).rejects.toMatchObject({ statusCode: 401, statusMessage: 'UAZAPI recusou a operação (HTTP 401).' })
  })
  it('does not treat provider failure over HTTP 200 as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":false}')))
    await expect(callWhatsApp('sendText', { body: { number: '5511999999999', text: 'hello' } })).rejects.toMatchObject({ statusCode: 502 })
  })
})
