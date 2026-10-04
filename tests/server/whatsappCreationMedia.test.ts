import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn(), one: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.one }))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.sign }))

const {
  downloadProviderMedia,
  ownedStorageBytes,
  signOwnedArtifact,
  validateProviderEvent
} = await import('../../server/utils/whatsapp-creation/media')

const accountId = '11111111-1111-4111-8111-111111111111'
const otherAccountId = '22222222-2222-4222-8222-222222222222'
const instanceToken = 'uazapi-test-token-never-return-this'
const imagePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/W1sAAAAASUVORK5CYII=', 'base64')
const webhook = (message: Record<string, unknown> = {}) => ({
  EventType: 'messages',
  token: instanceToken,
  instanceName: 'jobvarejo-instance',
  message: {
    messageid: 'provider-message-123',
    messageType: 'Conversation',
    chatid: '5511999999999@s.whatsapp.net',
    sender_pn: '5511999999999@s.whatsapp.net',
    fromMe: false,
    isGroup: false,
    text: 'Quero um encarte',
    messageTimestamp: 1780488000000,
    ...message
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_TOKEN', instanceToken)
  vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_ID', 'jobvarejo-instance')
  vi.stubEnv('JOBVAREJO_UAZAPI_URL', 'https://api.uazapi.com')
  vi.stubEnv('WASABI_BUCKET', 'test-bucket')
  vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket' }))
  mocks.send.mockResolvedValue({})
  mocks.sign.mockResolvedValue('https://signed.test/asset')
  mocks.one.mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('mídia de criação pelo WhatsApp', () => {
  it('valida token e instância, descarta eventos próprios/grupos/histórico e sanitiza mensagem direta', () => {
    expect(validateProviderEvent(webhook())).toMatchObject({
      messageId: 'provider-message-123',
      phone: '+5511999999999',
      text: 'Quero um encarte',
      type: 'text',
      timestamp: 1780488000000
    })
    expect(validateProviderEvent(webhook({ fromMe: true }))).toEqual({ ignored: true })
    expect(validateProviderEvent(webhook({ isGroup: true }))).toEqual({ ignored: true })
    expect(validateProviderEvent({ ...webhook(), EventType: 'history' })).toEqual({ ignored: true })
    expect(validateProviderEvent(webhook({ sender_pn: '123456789012345@lid', chatid: '123456789012345@lid' }))).toEqual({ ignored: true })
    expect(validateProviderEvent(webhook({ sender_pn: '5511888888888@s.whatsapp.net' }))).toMatchObject({ phone: '+5511888888888' })
    expect(JSON.stringify(validateProviderEvent(webhook()))).not.toContain(instanceToken)
  })

  it('autentica token antes de ignorar evento e não devolve detalhes sensíveis', () => {
    expect(() => validateProviderEvent({ ...webhook(), token: 'wrong-token' })).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(() => validateProviderEvent({ ...webhook(), instanceName: 'other-instance' })).toThrow(expect.objectContaining({ statusCode: 401 }))
    vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_TOKEN', '')
    expect(() => validateProviderEvent(webhook())).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  it('baixa imagem somente via endpoint configurado, desativa transcrição e salva original na área da conta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      mimetype: 'image/png', base64Data: imagePng.toString('base64'), fileURL: 'https://attacker.invalid/never-fetch'
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await downloadProviderMedia('provider-message-123', accountId)

    expect(result).toMatchObject({
      mimeType: 'image/png',
      content: { type: 'image_url', image_url: { url: expect.stringMatching(/^data:image\/(?:png|jpeg);base64,/) } }
    })
    expect(result.key).toMatch(new RegExp(`^whatsapp-creation/${accountId}/inbound/[0-9a-f-]+\\.png$`))
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://api.uazapi.com/message/download'), expect.objectContaining({
      method: 'POST', headers: { 'content-type': 'application/json', token: instanceToken },
      body: JSON.stringify({ id: 'provider-message-123', return_base64: true, generate_mp3: true, transcribe: false })
    }))
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const command = mocks.send.mock.calls[0]?.[0]
    expect(command.input).toMatchObject({ Bucket: 'test-bucket', Key: result.key, ContentType: 'image/png' })
    expect(command.input.Body).toEqual(imagePng)
  })

  it('rejeita host HTTP/externo e base64 acima de 5 MB sem buscar fileURL nem gravar no storage', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('JOBVAREJO_UAZAPI_URL', 'http://127.0.0.1:8080')
    await expect(downloadProviderMedia('provider-message-123', accountId)).rejects.toMatchObject({ statusCode: 503 })
    expect(fetchMock).not.toHaveBeenCalled()

    vi.stubEnv('JOBVAREJO_UAZAPI_URL', 'https://api.uazapi.com')
    const tooLargeBase64 = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ mimetype: 'image/png', base64Data: tooLargeBase64 }), { status: 200 }))
    await expect(downloadProviderMedia('provider-message-123', accountId)).rejects.toMatchObject({ statusCode: 413 })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('protege chaves de storage por conta e aceita assets de template somente por lista explícita', async () => {
    await expect(ownedStorageBytes(`whatsapp-creation/${otherAccountId}/private.png`, accountId)).rejects.toMatchObject({ statusCode: 403 })
    await expect(signOwnedArtifact(`art-studio/${otherAccountId}/secret.png`, accountId)).rejects.toMatchObject({ statusCode: 403 })

    const templateKey = 'projects/admin/template/header.png'
    mocks.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) } })
    await expect(ownedStorageBytes(templateKey, accountId, new Set([templateKey]))).resolves.toEqual(Buffer.from([1, 2, 3]))
    expect(mocks.send.mock.calls[0]?.[0].input).toMatchObject({ Key: templateKey })
    await expect(ownedStorageBytes(templateKey, accountId)).rejects.toMatchObject({ statusCode: 403 })
    await expect(signOwnedArtifact(templateKey, accountId, new Set([templateKey]))).resolves.toBe('https://signed.test/asset')
    await expect(signOwnedArtifact(templateKey, accountId)).rejects.toMatchObject({ statusCode: 403 })

    await expect(signOwnedArtifact(`whatsapp-creation/${accountId}/outbound/final.png`, accountId)).resolves.toBe('https://signed.test/asset')
    expect(mocks.sign).toHaveBeenCalledTimes(2)
  })
})
