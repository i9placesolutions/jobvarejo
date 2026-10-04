import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  approveData,
  approveImage,
  createOrder,
  registerPreview,
  updateOrder,
  type CreationProduct
} from '../../shared/whatsapp-creation'

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  productCandidates: vi.fn(),
  storageBytes: vi.fn()
}))

vi.mock('../../server/utils/whatsapp-creation/catalog', () => ({
  listCreationHeaders: mocks.headers,
  listProductCandidates: mocks.productCandidates
}))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ ownedStorageBytes: mocks.storageBytes }))

const { advanceConversation, newConversationState } = await import('../../server/utils/whatsapp-creation/conversation')

const accountId = '11111111-1111-4111-8111-111111111111'
const otherAccountId = '22222222-2222-4222-8222-222222222222'
const orderId = '33333333-3333-4333-8333-333333333333'
const sender = '+5511999999999'
const header = { id: 'header-story-tv', revision: 7, theme: 'Fecha Mês', formats: ['stories', 'tv'], name: 'Fim de semana' }
const byteImage = Buffer.from('verified-image-bytes')

function product(id = 'rice', overrides: Partial<CreationProduct> = {}): CreationProduct {
  return { id, name: 'Arroz', brand: 'Marca', variant: 'Tipo 1', weight: '5 kg', price: 'R$ 19,90', ...overrides }
}

function input(
  state: ReturnType<typeof newConversationState>,
  proposal: Record<string, unknown>,
  text: string,
  extra: { accountId?: string; uploaded?: { key: string; hash: string }; orderId?: string } = {}
) {
  return advanceConversation({
    state,
    proposal: proposal as any,
    text,
    accountId: extra.accountId || accountId,
    sender,
    orderId: extra.orderId || orderId,
    name: 'Rafa',
    ...(extra.uploaded ? { uploaded: extra.uploaded } : {})
  })
}

async function beginOrder(options: { products?: CreationProduct[]; kind?: 'encarte' | 'video'; division?: 'single' | 'pages'; formats?: string[] } = {}) {
  const state = newConversationState()
  mocks.headers.mockResolvedValue({ headers: [header], hasMore: false, missingTheme: false })
  const first = await input(state, {
    action: 'update', kind: options.kind || 'encarte', theme: 'Fecha Mês',
    formats: options.formats || ['stories', 'tv'],
    ...(options.products ? { products: options.products } : {}),
    ...(options.division ? { division: options.division } : {}),
    validity: 'sem validade'
  }, 'quero criar')
  return first
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.headers.mockResolvedValue({ headers: [header], hasMore: false, missingTheme: false })
  mocks.productCandidates.mockImplementation(async (_owner: string, item: CreationProduct) => [{
    key: `imagens/${item.id}-candidate.png`, hash: `candidate-hash-${item.id}`
  }])
  mocks.storageBytes.mockResolvedValue(byteImage)
})

describe('workflow da conversa de criação via WhatsApp', () => {
  it('envia as imagens dos cabeçalhos depois do tema e só pede formato após a escolha', async () => {
    const visualHeader = { ...header, theme: 'Hortifruti', headerKey: 'whatsapp-creation/owner/headers/preview.png' }
    mocks.headers.mockResolvedValue({ headers: [visualHeader], hasMore: false, missingTheme: false })
    const first = await input(newConversationState(), { action: 'update', kind: 'encarte', theme: 'Hortifruti' }, 'Hortifruti')
    expect(mocks.headers).toHaveBeenCalledWith(accountId, 'encarte', 'Hortifruti', [], 0)
    expect(first.state.phase).toBe('header')
    expect(first.send).toContainEqual(expect.objectContaining({ type: 'image', key: visualHeader.headerKey }))
    const chosen = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    expect(chosen.send.map(message => message.text).join(' ')).toMatch(/qual formato/i)
    const story = await input(chosen.state, { action: 'update', formats: ['stories'] }, 'Story')
    expect(story.state.header?.id).toBe(visualHeader.id)
    expect(story.send.map(message => message.text).join(' ')).toMatch(/mande os produtos/i)
    expect(mocks.headers).toHaveBeenCalledTimes(1)
  })

  it('reinicia as opções ao trocar o tema depois de pedir mais cabeçalhos', async () => {
    const first = await beginOrder()
    const paged = await input(first.state, { action: 'more_headers' }, 'ver mais')
    expect(paged.state.choiceOffset).toBe(1)
    await input(paged.state, { action: 'update', theme: 'Aniversário' }, 'mude para aniversário')
    expect(mocks.headers).toHaveBeenLastCalledWith(accountId, 'encarte', 'Aniversário', ['stories', 'tv'], 0)
  })

  it('pergunta o tema antes do catálogo e mantém todos os produtos nos dois formatos sem inventar divisão', async () => {
    const state = newConversationState()
    const noTheme = await input(state, {
      action: 'update', kind: 'encarte', formats: ['stories', 'tv'], products: [product('rice'), product('milk')]
    }, 'quero um encarte')
    expect(noTheme.state.phase).toBe('collecting')
    expect(noTheme.send.map(message => message.text).join(' ')).toMatch(/qual tema/i)
    expect(mocks.headers).not.toHaveBeenCalled()

    const needsHeader = await input(noTheme.state, {
      action: 'update', theme: 'Fecha Mês', formats: ['stories', 'tv']
    }, 'tema fim de semana')
    expect(mocks.headers).toHaveBeenCalledWith(accountId, 'encarte', 'Fecha Mês', ['stories', 'tv'], 0)
    expect(needsHeader.state.phase).toBe('header')
    const productIds = noTheme.state.draft.products.map(item => item.id)
    expect(needsHeader.state.draft.products.map(item => item.id)).toEqual(productIds)
    expect(needsHeader.state.draft.division).toBeUndefined()

    const choose = await input(needsHeader.state, { action: 'choose_header', choice: 1 }, '1')
    expect(choose.state.phase).toBe('collecting')
    expect(choose.state.draft.products.map(item => item.id)).toEqual(productIds)
    expect(choose.state.draft.division).toBeUndefined()
    expect(choose.send.map(message => message.text).join(' ')).toMatch(/mesma imagem|dividir/i)
  })

  it('passa da escolha aos dados, revisa a foto e só então libera a geração', async () => {
    const initial = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    const item = selected.state.order!.products[0]!
    expect(selected.state.phase).toBe('data')
    expect(selected.state.order?.header?.id).toBe(header.id)
    expect(selected.state.order?.dataApprovedRevision).toBeNull()
    expect(mocks.productCandidates).toHaveBeenCalledWith(accountId, expect.objectContaining({ id: item.id }))
    expect(mocks.storageBytes).toHaveBeenCalledWith(`imagens/${item.id}-candidate.png`, accountId)

    const confirmedData = await input(selected.state, { action: 'approve_data' }, 'confirmar dados')
    expect(confirmedData.state.phase).toBe('images')
    expect(confirmedData.state.order?.dataApprovedRevision).toBe(confirmedData.state.order?.revision)
    expect(confirmedData.send.some(message => message.type === 'image' && message.purpose === 'review')).toBe(true)

    const confirmedPhoto = await input(confirmedData.state, { action: 'approve_images' }, 'confirmar todas as fotos')
    expect(confirmedPhoto.state.phase).toBe('rendering')
    expect(confirmedPhoto.generate).toBe(true)
    expect(confirmedPhoto.state.order?.images[0]).toMatchObject({
      key: `imagens/${item.id}-candidate.png`, hash: createHash('sha256').update(byteImage).digest('hex'),
      approvedRevision: confirmedPhoto.state.order?.revision
    })
  })

  it('invalidates data and photo approvals when an image is replaced', async () => {
    const initial = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    const dataApproved = await input(selected.state, { action: 'approve_data' }, 'confirmar dados')
    const imageApproved = dataApproved
    const previousRevision = imageApproved.state.order!.revision
    const replacement = { key: `whatsapp-creation/${accountId}/inbound/new.png`, hash: 'new-photo-hash' }
    const changed = await input(imageApproved.state, { action: 'update', itemNumbers: [1] }, 'trocar foto do item 1', { uploaded: replacement })
    expect(changed.generate).toBe(false)
    expect(changed.state.phase).toBe('data')
    expect(changed.state.order?.revision).toBe(previousRevision + 1)
    expect(changed.state.order?.dataApprovedRevision).toBeNull()
    expect(changed.state.order?.images[0]).toMatchObject({ key: replacement.key, hash: replacement.hash, approvedRevision: null })

    const reconfirmedData = await input(changed.state, { action: 'approve_data' }, 'confirmar dados')
    expect(reconfirmedData.state.phase).toBe('images')
    expect(reconfirmedData.state.order?.images[0]?.approvedRevision).toBeNull()
    const reconfirmedPhoto = await input(reconfirmedData.state, { action: 'approve_images' }, 'confirmar todas as fotos')
    expect(reconfirmedPhoto.generate).toBe(true)
    expect(reconfirmedPhoto.state.order?.images[0]?.approvedRevision).toBe(reconfirmedPhoto.state.order?.revision)
  })

  it('guarda uma foto sem número e aplica ao item indicado na mensagem seguinte', async () => {
    const initial = await beginOrder({ products: [product(), product('milk', { name: 'Leite' })], division: 'single' })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    const dataApproved = await input(selected.state, { action: 'approve_data' }, 'confirmar dados')
    const incoming = { key: `whatsapp-creation/${accountId}/inbound/unassigned.png`, hash: 'unassigned-hash' }
    const initialKeys = selected.state.order!.images.map(image => image.key)
    const secondItemId = selected.state.order!.products[1]!.id

    const waiting = await input(dataApproved.state, { action: 'update' }, 'segue a foto', { uploaded: incoming })
    expect(waiting.state.pendingUploaded).toEqual(incoming)
    expect(waiting.state.order?.images.map(image => image.key)).toEqual(initialKeys)
    expect(waiting.generate).toBe(false)

    const assigned = await input(waiting.state, { action: 'update', itemNumbers: [2] }, 'foto do item 2')
    expect(assigned.state.pendingUploaded).toBeUndefined()
    expect(assigned.state.order?.images[0]?.key).toBe(initialKeys[0])
    expect(assigned.state.order?.images[1]).toMatchObject({ itemId: secondItemId, key: incoming.key, hash: incoming.hash, approvedRevision: null })
    expect(assigned.state.phase).toBe('data')
  })

  it('rejeita uma embalagem errada e não libera geração enquanto a foto correta não chegar', async () => {
    const first = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const confirmed = await input(selected.state, { action: 'approve_data' }, 'confirmar dados')
    const rejected = await input(confirmed.state, { action: 'update', itemNumbers: [1] }, 'a foto do item 1 está errada')
    expect(rejected.state.candidates).toEqual([])
    expect(rejected.state.order?.images[0]?.key).toBe('')
    expect(rejected.state.order?.revision).toBe(confirmed.state.order!.revision + 1)
    expect(rejected.send[0]?.text).toMatch(/envie as imagens corretas/i)
    const cannotApprove = await input(rejected.state, { action: 'approve_images' }, 'confirmar todas as fotos')
    expect(cannotApprove.generate).toBe(false)
    expect(cannotApprove.send[0]?.text).toMatch(/envie as fotos corretas/i)
  })

  it('não envia preview com revisão errada e entrega apenas os arquivos aprovados explicitamente', async () => {
    let order = createOrder({
      id: orderId, identity: { accountId, normalizedSender: sender }, kind: 'encarte', theme: 'Fecha Mês',
      formats: [{ id: 'stories', width: 1080, height: 1920 }, { id: 'tv', width: 1920, height: 1080 }],
      division: 'single', products: [product()], validity: 'sem validade'
    })
    order = updateOrder(order, accountId, { header: { id: header.id, revision: header.revision, theme: header.theme, formats: header.formats } })
    order = approveImage(order, accountId, { itemId: 'rice', key: 'imagens/rice.png', hash: 'rice-hash' })
    order = approveData(order, accountId)
    order = registerPreview(order, accountId, { artifactId: 'preview-current', revision: order.revision, formatIds: ['stories', 'tv'] })

    const state = {
      ...newConversationState(),
      phase: 'preview' as const,
      draft: { kind: 'encarte' as const, theme: 'Fecha Mês', formats: ['stories', 'tv'], division: 'single' as const, products: [product()], validity: 'sem validade' },
      header: { ...header },
      order,
      artifacts: [
        { artifactId: 'preview-current', formatId: 'stories', key: 'whatsapp-creation/file-story.png', hash: 'h1', mimeType: 'image/png', projectId: 'project-story', editUrl: '/edit/story' },
        { artifactId: 'preview-current', formatId: 'tv', key: 'whatsapp-creation/file-tv.png', hash: 'h2', mimeType: 'image/png', projectId: 'project-tv', editUrl: '/edit/tv' }
      ]
    }

    const stale = await input(state, { action: 'approve_preview', approvalRevision: order.revision }, `APROVAR ${order.revision - 1}`)
    expect(stale.send.filter(message => message.purpose === 'final')).toEqual([])
    expect(stale.state.phase).toBe('preview')

    const oneApproved = await input(state, { action: 'approve_preview', approvalRevision: order.revision, artifactNumbers: [1, 2] }, `APROVAR ${order.revision} arquivo 1`)
    expect(oneApproved.send.filter(message => message.purpose === 'final')).toHaveLength(1)
    expect(oneApproved.send.find(message => message.purpose === 'final')).toMatchObject({ formatId: 'stories', key: 'whatsapp-creation/file-story.png' })
    expect(oneApproved.state.phase).toBe('preview')
    expect(oneApproved.state.order?.previewApprovals.map(approval => approval.formatId)).toEqual(['stories'])
  })

  it('rejeita estado de pedido pertencente a outra conta', async () => {
    const initial = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    await expect(input(selected.state, { action: 'approve_data' }, 'confirmar dados', { accountId: otherAccountId }))
      .rejects.toThrow('ACCOUNT_MISMATCH')
  })

  it('não amplia a confirmação de uma foto para todas quando a IA omite os números', async () => {
    const first = await beginOrder({ products: [product(), product('milk')], division: 'single' })
    const selected = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const confirmed = await input(selected.state, { action: 'approve_data' }, 'confirmar dados')
    const partial = await input(confirmed.state, { action: 'approve_images' }, 'confirmar foto 1')
    expect(partial.generate).toBe(false)
    expect(partial.state.order?.images[0]?.approvedRevision).toBe(partial.state.order?.revision)
    expect(partial.state.order?.images[1]?.approvedRevision).toBeNull()
  })

  it('não trunca vídeo com mais de seis ofertas; pede ao cliente para escolher os itens', async () => {
    const products = Array.from({ length: 7 }, (_, index) => product(`item-${index + 1}`, { name: `Produto ${index + 1}` }))
    const initial = await beginOrder({ kind: 'video', products, division: 'pages', formats: ['stories'] })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    expect(selected.generate).toBe(false)
    expect(selected.state.order).toBeUndefined()
    expect(selected.state.draft.products).toHaveLength(7)
    expect(selected.state.draft.products.map(item => item.name)).toEqual(products.map(item => item.name))
    expect(selected.send.map(message => message.text).join(' ')).toMatch(/seis ofertas/i)
    expect(mocks.productCandidates).not.toHaveBeenCalled()
  })
})
