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
  storageBytes: vi.fn(),
  productReview: vi.fn()
}))

vi.mock('../../server/utils/whatsapp-creation/catalog', () => ({
  listCreationHeaders: mocks.headers,
  listProductCandidates: mocks.productCandidates
}))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ ownedStorageBytes: mocks.storageBytes }))
vi.mock('../../server/utils/whatsapp-creation/product-review', () => ({ createProductReviewBoards: mocks.productReview }))

const { advanceConversation, interpretationRequest, newConversationState } = await import('../../server/utils/whatsapp-creation/conversation')

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
  mocks.productReview.mockResolvedValue(['whatsapp-creation/review-board.png'])
})

describe('workflow da conversa de criação via WhatsApp', () => {
  it('instrui a IA a preservar dados ambíguos e distinguir lista substituta, adição, foto e preço', () => {
    const request = interpretationRequest(newConversationState(), 'cenoura esta errado', 'Rafa')
    const systemPrompt = String(request.messages[0]?.content)
    expect(systemPrompt).toMatch(/productOperation=patch altera somente os itens\/campos identificados/i)
    expect(systemPrompt).toMatch(/append soma os itens novos e deduplica/i)
    expect(systemPrompt).toMatch(/replace substitui a lista apenas quando a pessoa pedir isso explicitamente/i)
    expect(systemPrompt).toMatch(/unclear pede esclarecimento sem alterar a lista/i)
    expect(systemPrompt).toMatch(/correção de preço explícita/i)
    expect(systemPrompt).toMatch(/foto citada pelo nome de um único produto/i)
  })

  it('envia quatro prévias personalizadas com legendas 1 a 4 na ordem do catálogo', async () => {
    const headers = Array.from({ length: 4 }, (_, index) => ({ ...header, id: `header-${index + 1}`, name: `Modelo ${index + 1}` }))
    mocks.headers.mockResolvedValue({ headers, hasMore: false, missingTheme: false })
    const prepared = await advanceConversation({
      state: newConversationState(), proposal: { action: 'update', kind: 'encarte', theme: 'Hortifruti' },
      text: 'Hortifruti', accountId, sender, orderId, name: 'Rafa',
      prepareHeader: async selected => {
        await new Promise(resolve => setTimeout(resolve, (5 - Number(selected.id.slice(-1))) * 2))
        return { ...selected, headerKey: `headers/${selected.id}.png` }
      }
    })
    expect(prepared.send.map(message => message.text)).toEqual(['1', '2', '3', '4'])
    expect(prepared.send.map(message => message.key)).toEqual(headers.map(selected => `headers/${selected.id}.png`))
  })

  it('pergunta naturalmente qual modelo prefere e oferece mais opções quando há outras', async () => {
    mocks.headers.mockResolvedValue({ headers: [{ ...header, name: 'Modelo azul' }], hasMore: true, missingTheme: false })
    const result = await input(newConversationState(), {
      action: 'update', kind: 'video', theme: 'Fecha Mês', formats: ['stories'],
      products: [product()], division: 'single', validity: 'sem validade'
    }, 'Quero um vídeo Fecha Mês')
    expect(result.send.at(-1)?.text).toBe('Qual desses modelos você prefere? Quer ver mais opções?')
    expect(result.send.at(-1)?.text).not.toMatch(/responda o número|diga.*ver mais/i)
  })

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
    expect(choose.send.map(message => message.text).join(' ')).toMatch(/qual a validade/i)
  })

  it('aproveita um pedido inteiro em uma mensagem e segue da escolha direto à conferência visual', async () => {
    const products = [
      product('mamao', { name: 'Mamão Formosa', brand: '', variant: '', weight: '', price: '4.99' }),
      product('alho', { name: 'Alho', brand: '', variant: '', weight: '', price: '22.99' })
    ]
    const first = await input(newConversationState(), {
      action: 'update', kind: 'encarte', theme: 'Hortifruti', formats: ['stories'], products, validity: '05/10/2026'
    }, 'Quero encarte Hortifruti para Story: Mamão Formosa 4,99 e Alho 22,99. Validade 05/10/2026.')
    expect(first.state.phase).toBe('header')
    expect(first.state.draft).toMatchObject({ theme: 'Hortifruti', formats: ['stories'], validity: '05/10/2026' })
    expect(first.state.draft.products).toHaveLength(2)
    expect(first.send).toHaveLength(1)

    const chosen = await input(first.state, { action: 'status' }, '1')
    expect(chosen.state.phase).toBe('data')
    expect(chosen.state.draft.division).toBe('single')
    expect(chosen.send).toHaveLength(1)
    expect(chosen.send[0]).toMatchObject({ type: 'image', purpose: 'review' })
    expect(chosen.send[0]?.text).toMatch(/confira fotos e preços/i)
  })

  it('retoma um render falho somente quando solicitado e reapresenta a conferência', async () => {
    const first = await beginOrder({ products: [product()] })
    const chosen = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const failed = { ...chosen.state, phase: 'collecting' as const, order: updateOrder(chosen.state.order!, accountId, {}) }
    const status = await input(failed, { action: 'status' }, 'Qual o status do pedido?')
    expect(status.state.phase).toBe('collecting')
    expect(status.send).toHaveLength(1)
    expect(status.send[0]?.type).toBe('text')

    const resumed = await input(failed, { action: 'status' }, 'tentar novamente')
    expect(resumed.state.phase).toBe('data')
    expect(resumed.state.order!.revision).toBeGreaterThan(failed.order!.revision)
    expect(resumed.send).toEqual([expect.objectContaining({ type: 'image', purpose: 'review' })])
  })

  it('divide automaticamente em páginas quando o Story tem mais de nove produtos', async () => {
    const products = Array.from({ length: 10 }, (_, index) => product(`item-${index + 1}`))
    const state = { ...newConversationState(), header: { ...header }, draft: {
      kind: 'encarte' as const, theme: 'Hortifruti', formats: ['stories'], products, validity: '05/10/2026'
    } }
    const review = await input(state, { action: 'update' }, 'Pode montar')
    expect(review.state.draft.division).toBe('pages')
    expect(review.state.order?.division).toBe('pages')
    expect(review.state.phase).toBe('data')
  })

  it('aceita respostas curtas de divisão e validade mesmo quando o modelo omite os campos', async () => {
    const state = {
      ...newConversationState(),
      header: { ...header },
      draft: { kind: 'encarte' as const, theme: 'Fecha Mês', formats: ['stories'], products: [product('mamao', { name: 'Mamão Formosa', brand: '', variant: '', weight: '' })] }
    }
    const division = await input(state, { action: 'status' }, 'Tudo junto')
    expect(division.state.draft.division).toBe('single')
    expect(division.send[0]?.text).toMatch(/qual a validade/i)

    const date = await input(division.state, { action: 'status', validity: '05/10/2026' }, '05/10/2026')
    expect(date.state.draft.validity).toBe('05/10/2026')
    expect(date.send[0]?.text).toMatch(/confira fotos e preços/i)
    expect(date.send.some(message => message.type === 'image' && message.key === 'whatsapp-creation/review-board.png')).toBe(true)
    expect(date.state.draft.products[0]).toMatchObject({ brand: '', variant: '', weight: '' })

    const sameImage = await input(state, { action: 'update' }, 'Mesma imagem')
    expect(sameImage.state.draft.division).toBe('single')
    const noValidity = await input(sameImage.state, { action: 'status' }, 'Sem validade')
    expect(noValidity.state.draft.validity).toBe('sem validade')
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
    expect(selected.send.some(message => message.type === 'image' && message.purpose === 'review')).toBe(true)

    const confirmedData = await input(selected.state, { action: 'approve_data' }, 'confirmar dados')
    expect(confirmedData.state.phase).toBe('rendering')
    expect(confirmedData.generate).toBe(true)
    expect(confirmedData.state.order?.dataApprovedRevision).toBe(confirmedData.state.order?.revision)
    expect(confirmedData.state.order?.images[0]).toMatchObject({
      key: `imagens/${item.id}-candidate.png`, hash: createHash('sha256').update(byteImage).digest('hex'),
      approvedRevision: confirmedData.state.order?.revision
    })
  })

  it('leva hortifruti com nome e preço, fotos, confirmação curta e prévia até a entrega aprovada', async () => {
    const state = {
      ...newConversationState(),
      header: { ...header },
      draft: {
        kind: 'encarte' as const, theme: 'Fecha Mês', formats: ['stories'], division: 'single' as const,
        products: [product('mamao', { name: 'Mamão Formosa', brand: '', variant: '', weight: '', price: '4.99' })],
        validity: '05/10/2026'
      }
    }
    const review = await input(state, { action: 'update' }, '05/10/2026')
    expect(review.state.phase).toBe('data')
    expect(review.send.filter(message => message.type === 'image')).toHaveLength(1)
    expect(review.send.find(message => message.type === 'image')).toMatchObject({ key: 'whatsapp-creation/review-board.png', purpose: 'review' })
    expect(review.state.order?.products[0]).toMatchObject({ brand: '', variant: '', weight: '' })

    const data = await input(review.state, { action: 'status' }, 'Confirmado')
    expect(data.state.phase).toBe('rendering')
    expect(data.generate).toBe(true)

    const revision = data.state.order!.revision
    const artifactId = 'preview-hortifruti'
    const preview = {
      ...data.state,
      phase: 'preview' as const,
      previewPresentedRevision: revision,
      order: registerPreview(data.state.order!, accountId, { artifactId, revision, formatIds: ['stories'] }),
      artifacts: [{ artifactId, formatId: 'stories', key: 'whatsapp-creation/story.png', hash: 'hash', mimeType: 'image/png', projectId: 'project-story', editUrl: '/edit/story' }]
    }
    const noImplicitApproval = await input(preview, { action: 'status' }, 'Ok')
    expect(noImplicitApproval.send.filter(message => message.purpose === 'final')).toHaveLength(0)
    const approved = await input(preview, { action: 'status', artifactNumbers: [99] }, `APROVAR ${revision}`)
    expect(approved.state.phase).toBe('approved')
    expect(approved.send.filter(message => message.purpose === 'final')).toHaveLength(1)
  })

  it('agrupa quatro fotos de hortifruti em uma única imagem de conferência', async () => {
    const names = ['Mamão Formosa', 'Alho', 'Abacate', 'Cebola']
    const state = {
      ...newConversationState(), header: { ...header },
      draft: { kind: 'encarte' as const, theme: 'Hortifruti', formats: ['stories'], division: 'single' as const,
        products: names.map((name, index) => product(`item-${index + 1}`, { name, brand: '', variant: '', weight: '', price: `${index + 4}.99` })),
        validity: '05/10/2026' }
    }
    const review = await input(state, { action: 'update' }, '05/10/2026')
    expect(mocks.productReview).toHaveBeenCalledOnce()
    expect(mocks.productReview).toHaveBeenCalledWith(expect.objectContaining({ products: expect.arrayContaining(names.map(name => expect.objectContaining({ name }))) }))
    expect(review.send.filter(message => message.type === 'image')).toHaveLength(1)
    expect(review.send).toHaveLength(1)
  })

  it('sai da coleta atual com Confirmado mesmo quando a IA responde status', async () => {
    const state = {
      ...newConversationState(), header: { ...header },
      draft: { kind: 'encarte' as const, theme: 'Hortifruti', formats: ['stories'], division: 'single' as const,
        products: [product('mamao', { name: 'Mamão Formosa', brand: '', variant: '', weight: '', price: '4.99' })],
        validity: '05/10/2026' }
    }
    const review = await input(state, { action: 'status', products: [] }, 'Confirmado')
    expect(review.state.phase).toBe('data')
    expect(review.state.draft.products).toHaveLength(1)
    expect(review.send).toHaveLength(1)
    expect(review.send[0]).toMatchObject({ type: 'image', purpose: 'review' })
  })

  it('aceita correção de foto pelo número mostrado na prancha antes da aprovação', async () => {
    const first = await beginOrder({ products: [product('rice'), product('milk', { name: 'Leite' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const rejected = await input(review.state, { action: 'update' }, 'a foto 2 está errada')
    expect(rejected.state.phase).toBe('data')
    expect(rejected.state.candidates).toHaveLength(1)
    expect(rejected.state.candidates[0]?.itemId).toBe(review.state.order!.products[0]!.id)
    expect(rejected.state.reviewPresentedRevision).toBeUndefined()
    expect(rejected.send[0]?.text).toMatch(/imagens corretas/i)
  })

  it('corrige a foto literal mesmo se a IA disser status e alterar a lista', async () => {
    const first = await beginOrder({ products: [product('rice'), product('milk', { name: 'Leite' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const rejected = await input(review.state, { action: 'status', itemNumbers: [1], products: [] }, 'a foto 2 está errada')
    expect(rejected.state.draft.products).toHaveLength(2)
    expect(rejected.state.candidates.map(candidate => candidate.itemId)).toEqual([review.state.order!.products[0]!.id])
    expect(rejected.send[0]?.text).toMatch(/itens 2 foram removidas/i)
  })

  it('preserva o preço e guarda o produto quando a reclamação não diz o que está errado', async () => {
    const first = await beginOrder({ products: [product('rice'), product('carrot', { name: 'Cenoura', price: 'R$ 2,99' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const malformed = await input(review.state, {
      action: 'update', products: [product('rice'), product('carrot', { name: 'Cenoura', price: '' })]
    }, 'cenoura esta errado')

    expect(malformed.state.phase).toBe('data')
    expect(malformed.state.draft.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 2,99' })
    expect(malformed.state.order?.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 2,99' })
    expect(malformed.state.pendingCorrectionItemId).toBe(review.state.order?.products[1]?.id)
    expect(malformed.send[0]?.text).toMatch(/foto, o nome ou o preço/i)

    const clarified = await input(malformed.state, { action: 'update', products: [] }, 'a foto')
    expect(clarified.state.draft.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 2,99' })
    expect(clarified.state.pendingCorrectionItemId).toBeUndefined()
    expect(clarified.state.candidates.map(candidate => candidate.itemId)).toEqual([review.state.order!.products[0]!.id])
    expect(clarified.send[0]?.text).toMatch(/fotos dos itens 2 foram removidas/i)
  })

  it('resolve reclamação de foto pelo nome único e pergunta o item na reclamação genérica', async () => {
    const first = await beginOrder({ products: [product('rice'), product('carrot', { name: 'Cenoura', price: 'R$ 2,99' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')

    const generic = await input(review.state, { action: 'update', products: [], itemNumbers: [1] }, 'a foto esta errada')
    expect(generic.state.draft.products).toHaveLength(2)
    expect(generic.state.candidates).toHaveLength(2)
    expect(generic.send[0]?.text).toMatch(/qual produto está com a foto errada/i)

    const named = await input(review.state, { action: 'update', products: [], itemNumbers: [1] }, 'troque a foto da Cenoura')
    expect(named.state.draft.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 2,99' })
    expect(named.state.candidates.map(candidate => candidate.itemId)).toEqual([review.state.order!.products[0]!.id])
    expect(named.send[0]?.text).toMatch(/fotos dos itens 2 foram removidas/i)
  })

  it('associa uma foto recebida ao produto pelo nome sem aceitar lista ou número inventados', async () => {
    mocks.productCandidates.mockResolvedValue([])
    const first = await beginOrder({ products: [product('rice'), product('carrot', { name: 'Cenoura', price: 'R$ 2,99' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const uploaded = { key: `whatsapp-creation/${accountId}/inbound/cenoura.png`, hash: 'carrot-photo-hash' }
    const assigned = await input(review.state, { action: 'update', products: [], itemNumbers: [1] }, 'foto da Cenoura', { uploaded })

    expect(assigned.state.draft.products).toHaveLength(2)
    expect(assigned.state.draft.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 2,99' })
    expect(assigned.state.pendingUploaded).toBeUndefined()
    expect(assigned.state.candidates).toContainEqual(expect.objectContaining({ itemId: review.state.order!.products[1]!.id, ...uploaded }))
  })

  it('aplica uma correção explícita de preço sem tratá-la como reclamação de foto', async () => {
    const first = await beginOrder({ products: [product('rice'), product('carrot', { name: 'Cenoura', price: 'R$ 2,99' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const correctedProducts = [product('rice'), product('carrot', { name: 'Cenoura', price: 'R$ 3,99' })]
    const corrected = await input(review.state, { action: 'update', products: correctedProducts }, 'o preço da Cenoura está errado, é R$ 3,99')

    expect(corrected.state.draft.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 3,99' })
    expect(corrected.state.phase).toBe('data')
    expect(corrected.state.order?.products[1]).toMatchObject({ name: 'Cenoura', price: 'R$ 3,99' })
    expect(corrected.state.candidates).toHaveLength(2)
    expect(corrected.send[0]?.text).toMatch(/confira fotos e preços/i)
  })

  it('invalidates data and photo approvals when an image is replaced', async () => {
    const initial = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    const dataApproved = await input({ ...selected.state, reviewPresentedRevision: undefined }, { action: 'approve_data' }, 'confirmar dados')
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
    expect(reconfirmedData.state.phase).toBe('rendering')
    expect(reconfirmedData.generate).toBe(true)
    expect(reconfirmedData.state.order?.images[0]?.approvedRevision).toBe(reconfirmedData.state.order?.revision)
  })

  it('guarda uma foto sem número e aplica ao item indicado na mensagem seguinte', async () => {
    const initial = await beginOrder({ products: [product(), product('milk', { name: 'Leite' })], division: 'single' })
    const selected = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    const dataApproved = await input({ ...selected.state, reviewPresentedRevision: undefined }, { action: 'approve_data' }, 'confirmar dados')
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

  it('aceita foto enviada já na revisão de dados e associa o número respondido depois', async () => {
    mocks.productCandidates.mockResolvedValue([])
    const initial = await beginOrder({ products: [product('mamao', { name: 'Mamão Formosa', brand: '', variant: '', weight: '' })], division: 'single', formats: ['stories'] })
    const review = await input(initial.state, { action: 'choose_header', choice: 1 }, '1')
    expect(review.state.phase).toBe('data')
    expect(review.send.some(message => message.text.includes('pode enviar essas fotos'))).toBe(true)

    const uploaded = { key: `whatsapp-creation/${accountId}/inbound/mamao.png`, hash: 'uploaded-hash' }
    const waiting = await input(review.state, { action: 'status' }, '', { uploaded })
    expect(waiting.state.pendingUploaded).toEqual(uploaded)
    expect(waiting.send[0]?.text).toMatch(/de qual produto/i)

    const assigned = await input(waiting.state, { action: 'status' }, '1')
    expect(assigned.state.pendingUploaded).toBeUndefined()
    expect(assigned.state.candidates[0]).toMatchObject({ itemId: review.state.order!.products[0]!.id, ...uploaded })
    expect(assigned.send.some(message => message.type === 'image' && message.key === 'whatsapp-creation/review-board.png')).toBe(true)
    expect(assigned.state.phase).toBe('data')
  })

  it('rejeita uma embalagem errada e não libera geração enquanto a foto correta não chegar', async () => {
    const first = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const confirmed = await input({ ...selected.state, reviewPresentedRevision: undefined }, { action: 'approve_data' }, 'confirmar dados')
    const rejected = await input(confirmed.state, { action: 'update', itemNumbers: [1] }, 'a foto do item 1 está errada')
    expect(rejected.state.candidates).toEqual([])
    expect(rejected.state.order?.images[0]?.key).toBe('')
    expect(rejected.state.order?.revision).toBe(confirmed.state.order!.revision + 1)
    expect(rejected.send[0]?.text).toMatch(/imagens corretas/i)
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
      previewPresentedRevision: order.revision,
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

    const redone = await input(state, { action: 'status' }, 'Refazer prévia')
    expect(redone.generate).toBe(true)
    expect(redone.state.phase).toBe('rendering')
    expect(redone.state.order?.revision).toBe(order.revision + 1)
    expect(redone.state.order?.dataApprovedRevision).toBe(redone.state.order?.revision)
    expect(redone.state.order?.images[0]?.approvedRevision).toBe(redone.state.order?.revision)
    expect(redone.state.order?.previews).toEqual([])
    expect(redone.state.artifacts).toEqual([])
    expect(redone.send.map(message => message.text).join(' ')).toMatch(/refazer a prévia/i)
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
    const confirmed = await input({ ...selected.state, reviewPresentedRevision: undefined }, { action: 'approve_data' }, 'confirmar dados')
    const partial = await input(confirmed.state, { action: 'approve_images' }, 'confirmar foto 1')
    expect(partial.generate).toBe(false)
    expect(partial.state.order?.images[0]?.approvedRevision).toBe(partial.state.order?.revision)
    expect(partial.state.order?.images[1]?.approvedRevision).toBeNull()
  })

  it('aceita confirmação natural, preserva negação e aplica preço corrigido antes de aprovar', async () => {
    const first = await beginOrder({ products: [product()], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')

    const natural = await input(review.state, { action: 'status', confirmationIntent: 'approve', confirmationEvidence: 'Fechado' }, 'Fechado')
    expect(natural.generate).toBe(true)
    expect(natural.state.order?.dataApprovedRevision).toBe(natural.state.order?.revision)

    const positiveNegation = await input(review.state, {
      action: 'approve_data', confirmationIntent: 'approve', confirmationEvidence: 'não precisa mudar nada, segue'
    }, 'Não precisa mudar nada, segue')
    expect(positiveNegation.generate).toBe(true)

    const continueCurrent = await input(review.state, { action: 'cancel' }, 'Não cancela, vamos continuar')
    expect(continueCurrent.state.phase).toBe('data')
    expect(continueCurrent.state.order?.id).toBe(review.state.order?.id)
    expect(continueCurrent.send[0]?.text).not.toMatch(/cancelei/i)

    const mixed = await input(review.state, {
      action: 'update', confirmationIntent: 'approve', confirmationEvidence: 'Pode seguir',
      products: [product('rice', { price: 'R$ 20,00' })]
    }, 'Pode seguir, mas põe R$ 20,00 no arroz')
    expect(mixed.generate).toBe(false)
    expect(mixed.state.draft.products[0]?.price).toBe('R$ 20,00')
    expect(mixed.state.order?.dataApprovedRevision).toBeNull()

    const disagrees = await input(review.state, { action: 'approve_data' }, 'Sim, o preço não confere')
    expect(disagrees.generate).toBe(false)
    expect(disagrees.state.order?.dataApprovedRevision).toBeNull()
    expect(disagrees.send[0]?.text).toMatch(/qual produto ou parte/i)

    const list = await beginOrder({ products: [product('rice', { name: 'Arroz' }), product('beans', { name: 'Feijão' })], division: 'single' })
    const listReview = await input(list.state, { action: 'choose_header', choice: 1 }, '1')
    const correctedPrice = await input(listReview.state, {
      action: 'update', confirmationIntent: 'approve', confirmationEvidence: 'tudo certo',
      products: [product('rice', { name: 'Arroz', price: 'R$ 8,99' })]
    }, 'Tudo certo, mas o arroz é 8,99')
    expect(correctedPrice.generate).toBe(false)
    expect(correctedPrice.state.draft.products).toHaveLength(2)
    expect(correctedPrice.state.draft.products.map(item => [item.name, item.price])).toEqual([
      ['Arroz', 'R$ 8,99'], ['Feijão', 'R$ 19,90']
    ])
    expect(correctedPrice.state.order?.dataApprovedRevision).toBeNull()

    const single = await beginOrder({ products: [product('rice', { name: 'Arroz MarcaX', brand: 'MarcaX', weight: '5 kg' })], division: 'single' })
    const singleReview = await input(single.state, { action: 'choose_header', choice: 1 }, '1')
    const singlePatch = await input(singleReview.state, {
      action: 'update', productOperation: 'patch',
      products: [{ id: 'rice', name: 'Arroz MarcaX', price: 'R$ 17,90', brand: '', weight: '' }]
    }, 'Corrigir preço do Arroz MarcaX para R$ 17,90')
    expect(singlePatch.state.draft.products).toHaveLength(1)
    expect(singlePatch.state.draft.products[0]).toMatchObject({ brand: 'MarcaX', weight: '5 kg', price: 'R$ 17,90' })
  })

  it('acrescenta ofertas sem substituir nem duplicar os itens que já existem', async () => {
    const first = await beginOrder({ products: [product('rice', { name: 'Arroz' }), product('beans', { name: 'Feijão' })], division: 'single' })
    const review = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const appended = await input(review.state, {
      action: 'update', productOperation: 'append',
      products: [product('rice', { name: 'Arroz' }), product('beans', { name: 'Feijão' }), product('yogurt', { name: 'Iogurte', price: 'R$ 5,99' })]
    }, 'Adiciona iogurte por 5,99')
    expect(appended.state.draft.products).toHaveLength(3)
    expect(appended.state.draft.products.map(item => item.name)).toEqual(['Arroz', 'Feijão', 'Iogurte'])
    expect(appended.state.draft.products.slice(0, 2).map(item => item.id)).toEqual(review.state.draft.products.map(item => item.id))
    const otherBrand = await input(review.state, {
      action: 'update', productOperation: 'append',
      products: [product('rice-other', { name: 'Arroz', brand: 'Outra marca', weight: '1 kg', price: 'R$ 4,99' })]
    }, 'Adiciona também Arroz Outra marca 1 kg por 4,99')
    expect(otherBrand.state.draft.products).toHaveLength(3)
    expect(otherBrand.state.draft.products[0]).toMatchObject({ id: review.state.draft.products[0]!.id, brand: 'Marca', weight: '5 kg' })
    expect(otherBrand.state.draft.products[2]).toMatchObject({ brand: 'Outra marca', weight: '1 kg', price: 'R$ 4,99' })
    expect(otherBrand.state.draft.products[2]!.id).not.toBe(review.state.draft.products[0]!.id)
  })

  it('usa confirmação natural em fotos e roteiro, mas respeita rejeição explícita', async () => {
    const first = await beginOrder({ products: [product('rice'), product('milk', { name: 'Leite' })], division: 'single' })
    const selected = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const imageReview = {
      ...selected.state,
      phase: 'images' as const,
      order: approveData(selected.state.order!, accountId)
    }
    const acceptedPhotos = await input(imageReview, {
      action: 'approve_images', confirmationIntent: 'approve', confirmationEvidence: 'essas imagens estão certas'
    }, 'Perfeito, essas imagens estão certas')
    expect(acceptedPhotos.generate).toBe(true)

    const rejectedSecond = await input(imageReview, {
      action: 'approve_images', confirmationIntent: 'reject', confirmationEvidence: 'segunda não', itemNumbers: [2]
    }, 'A primeira certa, a segunda não')
    expect(rejectedSecond.generate).toBe(false)
    expect(rejectedSecond.state.candidates).toHaveLength(1)
    expect(rejectedSecond.send[0]?.text).toMatch(/fotos de Leite ficam de fora/i)

    const videoStart = await beginOrder({ kind: 'video', products: [product()], division: 'single', formats: ['stories'] })
    const videoReview = await input(videoStart.state, { action: 'choose_header', choice: 1 }, '1')
    const scriptReview = await input(videoReview.state, { action: 'approve_data' }, 'confirmar dados')
    expect(scriptReview.state.phase).toBe('script')
    const scriptApproved = await input(scriptReview.state, {
      action: 'status', confirmationIntent: 'approve', confirmationEvidence: 'manda ver'
    }, 'Manda ver')
    expect(scriptApproved.generate).toBe(true)
    expect(scriptApproved.state.order?.scriptApprovedRevision).toBe(scriptApproved.state.order?.revision)
  })

  it('aprova somente o formato citado na confirmação natural da prévia', async () => {
    const order = createOrder({
      id: orderId,
      identity: { accountId, normalizedSender: sender },
      kind: 'encarte', theme: 'Fecha Mês',
      formats: [{ id: 'stories', width: 1080, height: 1920 }, { id: 'feed', width: 1080, height: 1350 }],
      division: 'single', products: [product()]
    })
    const currentOrder = registerPreview(order, accountId, { artifactId: 'preview-current', revision: order.revision, formatIds: ['stories', 'feed'] })
    const preview = {
      ...newConversationState(), phase: 'preview' as const, previewPresentedRevision: currentOrder.revision,
      draft: { kind: 'encarte' as const, theme: 'Fecha Mês', formats: ['stories', 'feed'], division: 'single' as const, products: [product()], validity: 'sem validade' },
      header: { ...header }, order: currentOrder,
      artifacts: [
        { artifactId: 'preview-current', formatId: 'stories', key: 'whatsapp-creation/file-story.png', hash: 'h1', mimeType: 'image/png', projectId: 'project-story', editUrl: '/edit/story' },
        { artifactId: 'preview-current', formatId: 'feed', key: 'whatsapp-creation/file-feed.png', hash: 'h2', mimeType: 'image/png', projectId: 'project-feed', editUrl: '/edit/feed' }
      ]
    }
    const result = await input(preview, {
      action: 'approve_preview', confirmationIntent: 'approve', confirmationEvidence: 'Pode seguir', artifactNumbers: [1, 2]
    }, 'Pode seguir só com o Story')
    expect(result.send.filter(message => message.purpose === 'final').map(message => message.formatId)).toEqual(['stories'])
    expect(result.state.phase).toBe('preview')
    for (const artifactNumbers of [[1], [1, 2]]) {
      const pendingFeed = await input(preview, {
        action: 'approve_preview', confirmationIntent: 'approve', confirmationEvidence: 'pode mandar', artifactNumbers
      }, 'Pode mandar a do Story, o Feed ainda vou revisar')
      expect(pendingFeed.send.filter(message => message.purpose === 'final').map(message => message.formatId)).toEqual(['stories'])
      expect(pendingFeed.state.phase).toBe('preview')
    }
    for (const text of ['Pode mandar, o Feed ainda vou revisar', 'Pode mandar o arquivo 2, o Feed ainda vou revisar']) {
      const onlyPending = await input(preview, {
        action: 'approve_preview', confirmationIntent: 'approve', confirmationEvidence: 'pode mandar', artifactNumbers: [2]
      }, text)
      expect(onlyPending.send.filter(message => message.purpose === 'final')).toEqual([])
      expect(onlyPending.state.phase).toBe('preview')
    }
  })

  it('não confunde outro cabeçalho com outro encarte e entende a resposta ao escolher continuar ou recomeçar', async () => {
    const first = await beginOrder({ products: [product()], division: 'single' })
    const greeting = await input(first.state, { action: 'status' }, 'Oi')
    expect(greeting.send[0]?.text).toBe('Oi! Quer continuar esse encarte ou começar outro?')
    const anotherHeader = await input(first.state, { action: 'cancel_and_start_new' }, 'Quero outro cabeçalho')
    expect(anotherHeader.state.phase).toBe('header')
    expect(anotherHeader.state.draft.theme).toBe('Fecha Mês')
    expect(anotherHeader.state.draft.products).toHaveLength(1)

    const selected = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const ask = await input(selected.state, { action: 'new_order' }, 'Quero outro pedido')
    expect(ask.state.pendingOrderChoice).toBe(true)
    expect(ask.send[0]?.text).toBe('Quer continuar esse encarte ou começar outro?')
    const startAnother = await input(ask.state, { action: 'status' }, 'Outro')
    expect(startAnother.state.draft.products).toEqual([])
    expect(startAnother.state.draft.theme).toBeUndefined()
    expect(startAnother.state.phase).toBe('collecting')

    const pendingChoice = { ...selected.state, pendingOrderChoice: true }
    const keepCurrent = await input(pendingChoice, { action: 'cancel_and_start_new' }, 'Não quero outro, vamos continuar esse')
    expect(keepCurrent.state.order?.id).toBe(selected.state.order?.id)
    expect(keepCurrent.state.phase).toBe(selected.state.phase)
    expect(keepCurrent.state.draft.products).toEqual(selected.state.draft.products)
  })

  it('preserva a ação composta explícita mesmo quando a recusa é sobre o pedido atual', async () => {
    const first = await beginOrder({ products: [product()], division: 'single' })
    const selected = await input(first.state, { action: 'choose_header', choice: 1 }, '1')
    const next = await input(selected.state, {
      action: 'cancel_and_start_new', confirmationIntent: 'reject', confirmationEvidence: 'cancela esse'
    }, 'Cancela esse, faz outro')
    expect(next.state.phase).toBe('collecting')
    expect(next.state.draft.products).toEqual([])
    expect(next.send[0]?.text).toMatch(/pedido novo/i)
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
