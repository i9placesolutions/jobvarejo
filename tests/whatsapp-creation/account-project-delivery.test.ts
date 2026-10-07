import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gzipSync } from 'node:zlib'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  tx: vi.fn(),
  send: vi.fn(),
  resolveAccount: vi.fn(),
  assertAccess: vi.fn(),
  queue: vi.fn(),
  render: vi.fn(),
  templateLibrary: vi.fn()
}))

vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query, pgTx: mocks.tx }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/video-studio/service', () => ({ videoBucket: () => 'test-bucket' }))
vi.mock('../../server/utils/template-library-storage', () => ({ isTemplateLibraryStorageKey: mocks.templateLibrary }))
vi.mock('../../server/utils/whatsapp-creation/access', () => ({ resolveWhatsAppAccount: mocks.resolveAccount }))
vi.mock('../../server/utils/whatsapp-creation/repository', () => ({ assertCreationAccess: mocks.assertAccess, queueCreationSend: mocks.queue }))
vi.mock('../../server/utils/whatsapp-creation/render', () => ({
  renderSavedCanvasPage: mocks.render,
  readFlyerPaymentIcon: vi.fn(async () => null),
  resolvePublishedFlyerCatalogKey: vi.fn(() => null)
}))
vi.mock('../../server/utils/whatsapp-creation/catalog', () => ({ listCreationHeaders: vi.fn(), listProductCandidates: vi.fn() }))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ ownedStorageBytes: vi.fn() }))
vi.mock('../../server/utils/whatsapp-creation/product-review', () => ({ createProductReviewBoards: vi.fn() }))

const { deliverAccountProject, embedAccountCanvasImages, loadAccountPageCanvas } = await import('../../server/utils/whatsapp-creation/account-project-delivery')
const { newConversationState } = await import('../../server/utils/whatsapp-creation/conversation')

const ownerId = '11111111-1111-4111-8111-111111111111'
const otherOwnerId = '22222222-2222-4222-8222-222222222222'
const orderId = '33333333-3333-4333-8333-333333333333'
const conversationId = '44444444-4444-4444-8444-444444444444'
const projectId = 'aaaaaaaa-0000-4000-8000-000000000001'
const token = '55555555-5555-4555-8555-555555555555'

const body = (bytes: Buffer, contentType = 'image/png') => ({ ContentLength: bytes.length, ContentType: contentType, Body: { transformToByteArray: async () => new Uint8Array(bytes) } })

function orderRow(job: Record<string, unknown> = {}) {
  const state = newConversationState()
  state.accountProject = { projectId, projectName: 'Açougue', job: { token, projectId, until: new Date(Date.now() + 60_000).toISOString(), ...job } }
  return { id: orderId, owner_id: ownerId, conversation_id: conversationId, sender_phone: '+5511999999999', kind: 'encarte', state }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.templateLibrary.mockResolvedValue(false)
  mocks.resolveAccount.mockResolvedValue({ ok: true, user: { id: ownerId, role: 'user' } })
})

describe('imagens do encarte salvo', () => {
  it('embute arquivos da própria conta e recusa os de outra conta ou externos', async () => {
    mocks.send.mockResolvedValue(body(Buffer.from('png-bytes')))
    const canvas = { objects: [{ type: 'Image', src: `/api/storage/p?key=projects/${ownerId}/${projectId}/assets/a.png` }, { type: 'Group', objects: [{ type: 'Image', src: 'imagens/arroz.webp' }] }] }
    await embedAccountCanvasImages(canvas, ownerId)
    expect(canvas.objects[0]!.src).toBe(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`)
    expect((canvas.objects[1] as any).objects[0].src).toMatch(/^data:image\/png;base64,/)
    expect(mocks.send.mock.calls.map(([command]) => command.input.Key)).toEqual([`projects/${ownerId}/${projectId}/assets/a.png`, 'imagens/arroz.webp'])

    await expect(embedAccountCanvasImages({ objects: [{ type: 'Image', src: `/api/storage/p?key=projects/${otherOwnerId}/p/x.png` }] }, ownerId)).rejects.toMatchObject({ statusCode: 403 })
    await expect(embedAccountCanvasImages({ objects: [{ type: 'Image', src: 'https://evil.example/x.png' }] }, ownerId)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.send).toHaveBeenCalledTimes(2)
  })

  it('lê a página salva só da pasta de projetos do dono', async () => {
    mocks.send.mockResolvedValue(body(gzipSync(Buffer.from(JSON.stringify({ objects: [{ type: 'Rect' }] }))), 'application/octet-stream'))
    await expect(loadAccountPageCanvas({ canvasDataPath: `projects/${ownerId}/${projectId}/page_1.json` }, ownerId)).resolves.toEqual({ objects: [{ type: 'Rect' }] })
    await expect(loadAccountPageCanvas({ canvasDataPath: `projects/${otherOwnerId}/${projectId}/page_1.json` }, ownerId)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('entrega do encarte da conta', () => {
  it('recusa token diferente e vínculo de outra conta antes de ler o projeto', async () => {
    await expect(deliverAccountProject(orderRow(), '66666666-6666-4666-8666-666666666666')).rejects.toMatchObject({ statusCode: 409 })
    mocks.resolveAccount.mockResolvedValue({ ok: true, user: { id: otherOwnerId, role: 'user' } })
    await expect(deliverAccountProject(orderRow(), token)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('gera as páginas do projeto do dono e enfileira imagem + arquivo de cada uma', async () => {
    const row = orderRow()
    mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes("jsonb_set(state,'{accountProject,job,started}'")) return { rows: [{ id: orderId }] }
      if (sql.includes('from public.projects')) {
        expect(params).toEqual([projectId, ownerId])
        expect(sql).toMatch(/user_id = \$2 and coalesce\(is_template, false\) = false/)
        return { rows: [{ id: projectId, name: 'Açougue', canvas_data: { pages: [{ width: 1080, height: 1350, canvasData: { objects: [{ type: 'Rect' }] } }] } }] }
      }
      throw new Error(`SQL inesperado: ${sql}`)
    })
    mocks.render.mockResolvedValue([{ png: Buffer.from('page-1'), region: { left: 0, top: 0, width: 1080, height: 1350 } }])
    mocks.send.mockResolvedValue({})
    const updates: unknown[] = []
    const client = { query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT state FROM public.whatsapp_creation_orders')) return { rows: [{ state: structuredClone(row.state) }] }
      updates.push(params)
      return { rows: [] }
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))

    const result = await deliverAccountProject(row, token)

    expect(result).toMatchObject({ ok: true, count: 2 })
    expect(mocks.assertAccess).toHaveBeenCalledWith(expect.objectContaining({ id: ownerId }), 'encarte')
    const put = mocks.send.mock.calls[0]![0].input
    expect(put.Key).toMatch(new RegExp(`^projects/${ownerId}/${projectId}/whatsapp/[0-9a-f]{40}\\.png$`))
    const [, conversation, owner, order, state, send, correlation] = mocks.queue.mock.calls[0]!
    expect([conversation, owner, order, correlation]).toEqual([conversationId, ownerId, orderId, `account-project:${orderId}:${token}`])
    expect(state.accountProject).toMatchObject({ projectId, projectName: 'Açougue' })
    expect(state.accountProject.job).toBeUndefined()
    expect(send.map((item: any) => [item.type, item.purpose, item.key, item.accountProjectId])).toEqual([
      ['image', 'account_project', put.Key, projectId],
      ['document', 'account_project', put.Key, projectId],
      ['text', undefined, undefined, undefined]
    ])
    expect(updates).toHaveLength(1)
  })

  it('não entrega projeto que não pertence mais à conta e avisa na conversa', async () => {
    const row = orderRow()
    mocks.query.mockImplementation(async (sql: string) => sql.includes('jsonb_set') ? { rows: [{ id: orderId }] } : { rows: [] })
    const client = { query: vi.fn(async (sql: string) => sql.startsWith('SELECT state') ? { rows: [{ state: structuredClone(row.state) }] } : { rows: [] }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))
    await expect(deliverAccountProject(row, token)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.render).not.toHaveBeenCalled()
    const send = mocks.queue.mock.calls[0]![5]
    expect(send).toEqual([expect.objectContaining({ type: 'text', text: expect.stringContaining('Não encontrei mais o encarte') })])
  })
})
