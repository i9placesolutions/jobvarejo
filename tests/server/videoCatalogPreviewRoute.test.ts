import {beforeEach, describe, expect, it, vi} from 'vitest'
const mocks = vi.hoisted(() => ({
  send: vi.fn(), preview: vi.fn(), path: vi.fn(), header: vi.fn(), headers: vi.fn(),
  set: vi.fn(), remove: vi.fn(), status: vi.fn(), redirect: vi.fn(), stream: vi.fn()
}))
vi.mock('../../server/utils/s3', () => ({getS3Client: () => ({send: mocks.send})}))
vi.mock('../../server/utils/rate-limit', () => ({enforceRateLimit: vi.fn()}))
vi.mock('../../server/utils/video-studio/service', () => ({videoBucket: () => 'catalog'}))
vi.mock('../../server/utils/video-studio/catalog-preview', () => ({catalogPreview: mocks.preview, CATALOG_PREVIEW_VERSION: 'webp-1280-v1'}))
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('getRouterParam', mocks.path)
vi.stubGlobal('getRequestIP', () => '127.0.0.1')
vi.stubGlobal('getRequestHeader', mocks.header)
vi.stubGlobal('setResponseHeaders', mocks.headers)
vi.stubGlobal('setResponseHeader', mocks.set)
vi.stubGlobal('removeResponseHeader', mocks.remove)
vi.stubGlobal('setResponseStatus', mocks.status)
vi.stubGlobal('sendRedirect', mocks.redirect)
vi.stubGlobal('sendStream', mocks.stream)
vi.stubGlobal('createError', (data: any) => Object.assign(new Error(data.statusMessage), data))
const handler = (await import('../../server/routes/video-studio/[...path].get')).default
const path = 'templates/catalog/454cb8bf-ec09-45d9-8676-414ec93bc0db-background.png'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.path.mockReturnValue('preview/' + path)
  mocks.header.mockReturnValue(undefined)
  mocks.preview.mockResolvedValue(Buffer.from('webp'))
  mocks.send.mockResolvedValue({Body: {transformToWebStream: () => 'original-stream'}})
})

describe('rota de prévias públicas', () => {
  it('entrega WebP com ETag próprio e valida 304 antes de converter', async () => {
    const response = await handler({} as any)
    expect(response).toEqual(Buffer.from('webp'))
    const headers = mocks.headers.mock.calls[0]![1]
    expect(headers['Content-Type']).toBe('image/webp')
    expect(headers.ETag).toContain('-webp-1280-v1')
    mocks.header.mockImplementation((_event, name) => name === 'if-none-match' ? headers.ETag : undefined)
    mocks.preview.mockClear()
    expect(await handler({} as any)).toBeNull()
    expect(mocks.status).toHaveBeenCalledWith({}, 304)
    expect(mocks.preview).not.toHaveBeenCalled()
  })

  it('conserva o original e as respostas Range usadas em mídia/exportação', async () => {
    mocks.path.mockReturnValue(path)
    mocks.header.mockImplementation((_event, name) => name === 'range' ? 'bytes=0-99' : undefined)
    await handler({} as any)
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(mocks.send.mock.calls[0]![0].input.Range).toBe('bytes=0-99')
    expect(mocks.status).toHaveBeenCalledWith({}, 206)
    expect(mocks.stream).toHaveBeenCalledWith({}, 'original-stream')
  })

  it('não converte vídeo e conserva o stream de efeitos animados', async () => {
    mocks.path.mockReturnValue('preview/templates/drawn-fx/7891508.webm')
    await handler({} as any)
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(mocks.stream).toHaveBeenCalledWith({}, 'original-stream')
  })

  it('recupera falha de conversão com original sem guardar o redirecionamento', async () => {
    mocks.preview.mockRejectedValueOnce(new Error('decode'))
    await handler({} as any)
    expect(mocks.redirect).toHaveBeenCalledWith({}, '/video-studio/' + path, 302)
    expect(mocks.set).toHaveBeenCalledWith({}, 'Cache-Control', 'no-store')
    expect(mocks.remove).toHaveBeenCalledWith({}, 'ETag')
  })

  it('rejeita caminho privado, traversal e imagem fora do manifesto', async () => {
    for (const path of ['preview/../private.png', 'preview/templates/unknown.png', 'preview/projects/private.png']) {
      mocks.path.mockReturnValue(path)
      await expect(handler({} as any)).rejects.toMatchObject({statusCode: 404})
    }
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
