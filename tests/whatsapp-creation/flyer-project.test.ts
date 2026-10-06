import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { createOrder, updateOrder, type CreationOrder } from '../../shared/whatsapp-creation'

const mocks = vi.hoisted(() => ({ send: vi.fn(), one: vi.fn(), query: vi.fn(), tx: vi.fn(), publish: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/video-studio/service', async original => ({ ...(await original() as object), videoBucket: () => 'test-bucket' }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.one, pgQuery: mocks.query, pgTx: mocks.tx }))
vi.mock('../../server/utils/project-realtime', () => ({ publishProjectChange: mocks.publish }))
vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket', wasabiEndpoint: '' }))

const { classifyFlyerProjectSlot, projectCanvasHash, saveDraftFlyerProject, whatsappFlyerProjectId } = await import('../../server/utils/whatsapp-creation/render')

const ownerId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const templateOwner = '33333333-3333-4333-8333-333333333333'
const templateUpdatedAt = new Date('2026-10-01T12:00:00.000Z')
const user = { id: ownerId } as any
const logoKey = `projects/${ownerId}/logo/logo.png`
const profile = { companyName: 'Mercado Teste', logo: `/api/storage/p?key=${encodeURIComponent(logoKey)}` } as any
const logoPng = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#cc0000' } }).png().toBuffer()

function headerOnlyOrder(revision = 0): CreationOrder {
  const order = updateOrder(createOrder({ id: orderId, identity: { accountId: ownerId, normalizedSender: '+5511999999999' }, kind: 'encarte', theme: 'Fecha Mês',
    formats: [{ id: 'stories', width: 1080, height: 1920 }], division: null, products: [] }), ownerId,
  { header: { id: 'template-1', revision: templateUpdatedAt.getTime(), theme: 'Fecha Mês', formats: ['stories'] } })
  return { ...order, revision }
}

/** Banco em memória para public.projects. */
const projects = new Map<string, any>()

beforeEach(() => {
  vi.resetAllMocks()
  projects.clear()
  mocks.send.mockImplementation(async (command: unknown) => command instanceof GetObjectCommand
    ? { ContentLength: logoPng.length, ContentType: 'image/png', Body: { transformToByteArray: async () => new Uint8Array(logoPng) } }
    : {})
  mocks.query.mockResolvedValue({ rows: [] })
  mocks.one.mockImplementation(async (sql: string, params: any[]) => {
    if (sql.includes('product_card_configurations')) return null
    if (sql.includes('project.is_template=true')) {
      return { id: 'template-1', user_id: templateOwner, name: 'Modelo Fecha Mês', template_config: {}, updated_at: templateUpdatedAt, is_template: true,
        canvas_data: { pages: [{ id: 'page', width: 1080, height: 1920, templateFormatId: 'stories', canvasData: { width: 1080, height: 1920, objects: [{ type: 'Image', name: 'headerLogo', quickLogoSlot: true, src: '', left: 0, top: 0, width: 200, height: 100 }] } }] } }
    }
    if (sql.startsWith('select id,user_id,canvas_data,template_config from public.projects')) return structuredClone(projects.get(params[0]) || null)
    throw new Error(`SQL inesperado: ${sql}`)
  })
  mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback({
    query: async (sql: string, params: any[]) => {
      if (sql.startsWith('select id,user_id,canvas_data,template_config from public.projects')) {
        const row = projects.get(params[0])
        return { rows: row ? [structuredClone(row)] : [] }
      }
      if (sql.trim().startsWith('insert into public.projects')) {
        projects.set(params[0], { id: params[0], name: params[1], canvas_data: JSON.parse(params[2]), preview_url: params[3], user_id: params[4], template_config: JSON.parse(params[5]) })
        return { rows: [] }
      }
      if (sql.trim().startsWith('update public.projects')) {
        const row = projects.get(params[0])
        row.canvas_data = JSON.parse(params[2])
        row.template_config = { ...row.template_config, whatsappCreation: JSON.parse(params[4]) }
        return { rows: [] }
      }
      throw new Error(`SQL transacional inesperado: ${sql}`)
    }
  }))
})

describe('projeto do encarte em andamento no painel', () => {
  it('usa um id estável por pedido, independente da revisão', () => {
    expect(whatsappFlyerProjectId(ownerId, orderId)).toBe(whatsappFlyerProjectId(ownerId, orderId, 1))
    expect(whatsappFlyerProjectId(ownerId, orderId, 2)).not.toBe(whatsappFlyerProjectId(ownerId, orderId))
    expect(whatsappFlyerProjectId(templateOwner, orderId)).not.toBe(whatsappFlyerProjectId(ownerId, orderId))
  })

  it('classifica edição manual, revisão mais nova e projeto de outro pedido', () => {
    const canvas = { pages: [{ id: 'p1', canvasDataPath: 'projects/x/page.json' }] }
    const meta = { orderId, revision: 3, stage: 'draft', canvasHash: projectCanvasHash(canvas) }
    const row = { user_id: ownerId, canvas_data: canvas, template_config: { whatsappCreation: meta } }
    const input = { userId: ownerId, orderId, revision: 3, stage: 'draft' as const }
    expect(classifyFlyerProjectSlot(null, input)).toBe('absent')
    expect(classifyFlyerProjectSlot(row, input)).toBe('ours')
    expect(classifyFlyerProjectSlot(row, { ...input, stage: 'final' })).toBe('ours')
    expect(classifyFlyerProjectSlot({ ...row, canvas_data: { pages: [{ id: 'p1', canvasDataPath: 'projects/x/page.json', canvasSavedAt: 1 }] } }, input)).toBe('edited')
    expect(classifyFlyerProjectSlot(row, { ...input, revision: 2 })).toBe('newer')
    expect(classifyFlyerProjectSlot({ ...row, template_config: { whatsappCreation: { ...meta, stage: 'final' } } }, input)).toBe('newer')
    expect(classifyFlyerProjectSlot({ ...row, user_id: templateOwner }, input)).toBe('foreign')
    expect(classifyFlyerProjectSlot({ ...row, template_config: {} }, input)).toBe('foreign')
  })

  it('cria o projeto com o modelo escolhido e atualiza o mesmo projeto depois', async () => {
    const first = await saveDraftFlyerProject(headerOnlyOrder(0), [], user, profile)
    const projectId = whatsappFlyerProjectId(ownerId, orderId)
    expect(first).toMatchObject({ projectId, version: 1, created: true, stale: false, forked: false })
    const row = structuredClone(projects.get(projectId))
    expect(row.user_id).toBe(ownerId)
    expect(row.name).toBe('WhatsApp · Fecha Mês')
    expect(row.canvas_data.pages).toHaveLength(1)
    expect(row.canvas_data.pages[0]).toMatchObject({ templateModelId: 'template-1', templateFormatId: 'stories', type: 'RETAIL_OFFER',
      canvasDataPath: expect.stringMatching(new RegExp(`^projects/${ownerId}/${projectId}/page_[0-9a-f-]{36}\\.json$`)) })
    expect(row.template_config.whatsappCreation).toMatchObject({ orderId, revision: 0, stage: 'draft', canvasHash: projectCanvasHash(row.canvas_data) })
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ projectId, action: 'created' }))

    const second = await saveDraftFlyerProject(headerOnlyOrder(2), [], user, profile)
    expect(second).toMatchObject({ projectId, version: 1, created: false, forked: false })
    expect(projects.size).toBe(1)
    expect(projects.get(projectId).template_config.whatsappCreation.revision).toBe(2)
    // Página nova por revisão: o JSON da revisão anterior nunca é sobrescrito.
    expect(projects.get(projectId).canvas_data.pages[0].canvasDataPath).not.toBe(row.canvas_data.pages[0].canvasDataPath)
  })

  it('não sobrescreve edição feita no painel: grava uma nova versão', async () => {
    await saveDraftFlyerProject(headerOnlyOrder(1), [], user, profile)
    const projectId = whatsappFlyerProjectId(ownerId, orderId)
    const edited = projects.get(projectId)
    edited.canvas_data.pages[0].canvasSavedAt = Date.now() + 1000
    edited.canvas_data.pages[0].canvasDataPath = `projects/${ownerId}/${projectId}/page_manual.json`
    const editedSnapshot = structuredClone(edited)

    const result = await saveDraftFlyerProject(headerOnlyOrder(2), [], user, profile)
    expect(result).toMatchObject({ projectId: whatsappFlyerProjectId(ownerId, orderId, 2), version: 2, created: true, forked: true })
    expect(projects.get(projectId)).toEqual(editedSnapshot)
    expect(projects.get(result.projectId).name).toBe('WhatsApp · Fecha Mês (versão 2)')
  })

  it('job atrasado de revisão antiga não troca o conteúdo mais novo', async () => {
    await saveDraftFlyerProject(headerOnlyOrder(3), [], user, profile)
    const projectId = whatsappFlyerProjectId(ownerId, orderId)
    const before = structuredClone(projects.get(projectId))
    const result = await saveDraftFlyerProject(headerOnlyOrder(2), [], user, profile)
    expect(result).toMatchObject({ projectId, stale: true, created: false })
    expect(projects.get(projectId)).toEqual(before)
  })
})
