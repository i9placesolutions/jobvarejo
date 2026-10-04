import { describe, expect, it } from 'vitest'
import {
  approveData,
  approveImage,
  approvePreview,
  approveScript,
  assertCanDeliver,
  assertCanGeneratePaidVoice,
  assertCanRender,
  createOrder,
  registerPreview,
  updateOrder,
  type CreationOrder,
  type CreationProduct
} from '../../shared/whatsapp-creation'

const accountId = 'f3a43d1e-4837-4e2e-b41c-0458328f51e2'
const otherAccountId = 'b26cfde0-e5c0-4c71-8662-af00b1488d1f'
const orderId = 'a9489f12-830b-4a94-9bb4-d4a36c9a21aa'
const format = { id: 'story', width: 1080, height: 1920 }

function product(id: string, price = 'R$ 19,90'): CreationProduct {
  return { id, name: 'Arroz', brand: 'Marca', variant: 'Tipo 1', weight: '5 kg', price }
}

function create(kind: 'encarte' | 'video' | 'cartaz' | 'studio' = 'encarte', products = [product('item-1')]): CreationOrder {
  return createOrder({
    id: orderId,
    identity: { accountId, normalizedSender: '+5511999999999' },
    kind,
    theme: 'Fecha Mês',
    formats: [format],
    division: products.length ? 'single' : null,
    products
  })
}

function withHeader(order: CreationOrder): CreationOrder {
  return updateOrder(order, accountId, {
    header: { id: 'header-fecha-mes', revision: 4, theme: 'Fecha Mês', formats: ['story'] }
  })
}

function ready(order = create()): CreationOrder {
  let next = withHeader(order)
  for (const item of next.products) {
    next = approveImage(next, accountId, { itemId: item.id, key: `images/${item.id}.png`, hash: `sha-${item.id}` })
  }
  return approveData(next, accountId)
}

describe('estado puro de criação via WhatsApp', () => {
  it('rejects cross-tenant reads and mutations with a structured account error', () => {
    const order = create()
    expect(() => approveData(order, otherAccountId)).toThrowError(expect.objectContaining({
      code: 'ACCOUNT_MISMATCH', name: 'CreationStateError'
    }))
    expect(() => assertCanRender(order, otherAccountId)).toThrowError(expect.objectContaining({ code: 'ACCOUNT_MISMATCH' }))
  })

  it('does not allow account, owner, or sender identity to be changed by a patch', () => {
    const order = create()
    for (const field of ['accountId', 'ownerId', 'sender']) {
      expect(() => updateOrder(order, accountId, { [field]: otherAccountId })).toThrowError(expect.objectContaining({ code: 'IMMUTABLE_ORDER_FIELD' }))
    }
  })

  it('increments revisions on edits and clears data, image, and preview approvals', () => {
    let order = ready()
    order = registerPreview(order, accountId, { artifactId: 'preview-v3', revision: order.revision, formatIds: ['story'] })
    order = approvePreview(order, accountId, { artifactId: 'preview-v3', revision: order.revision, formatId: 'story' })
    const edited = updateOrder(order, accountId, { products: [{ ...order.products[0]!, price: 'R$ 20,50' }] })
    expect(edited.revision).toBe(order.revision + 1)
    expect(edited.dataApprovedRevision).toBeNull()
    expect(edited.images[0]?.approvedRevision).toBeNull()
    expect(edited.previews).toEqual([])
    expect(edited.previewApprovals).toEqual([])
  })

  it('replacing an image makes prior data approval and previews stale', () => {
    let order = ready()
    order = registerPreview(order, accountId, { artifactId: 'preview-before-replacement', revision: order.revision, formatIds: ['story'] })
    order = approvePreview(order, accountId, { artifactId: 'preview-before-replacement', revision: order.revision, formatId: 'story' })
    const replaced = approveImage(order, accountId, { itemId: 'item-1', key: 'images/new.png', hash: 'sha-new' })
    expect(replaced.revision).toBe(order.revision + 1)
    expect(replaced.images[0]).toMatchObject({ key: 'images/new.png', hash: 'sha-new', approvedRevision: replaced.revision })
    expect(replaced.dataApprovedRevision).toBeNull()
    expect(replaced.previews).toEqual([])
    expect(() => assertCanRender(replaced, accountId)).toThrowError(expect.objectContaining({ code: 'DATA_NOT_APPROVED' }))
  })

  it('requires a preview approval for every delivered format and artifact', () => {
    let order = updateOrder(create(), accountId, {
      formats: [format, { id: 'feed', width: 1080, height: 1350 }],
      header: { id: 'header-multi', revision: 2, theme: 'Fecha Mês', formats: ['story', 'feed'] }
    })
    for (const item of order.products) order = approveImage(order, accountId, { itemId: item.id, key: `${item.id}.png`, hash: `hash-${item.id}` })
    for (const item of order.products) order = approveImage(order, accountId, { itemId: item.id, key: `${item.id}.png`, hash: `hash-${item.id}` })
    order = approveData(order, accountId)
    expect(() => assertCanRender(order, accountId)).not.toThrow()
    order = registerPreview(order, accountId, { artifactId: 'preview-multi', revision: order.revision, formatIds: ['story', 'feed'] })
    order = approvePreview(order, accountId, { artifactId: 'preview-multi', revision: order.revision, formatId: 'story' })
    expect(() => assertCanDeliver(order, accountId, 'preview-multi', ['story', 'feed'])).toThrowError(expect.objectContaining({ code: 'PREVIEW_NOT_APPROVED' }))
    order = approvePreview(order, accountId, { artifactId: 'preview-multi', revision: order.revision, formatId: 'feed' })
    expect(() => assertCanDeliver(order, accountId, 'preview-multi', ['story', 'feed'])).not.toThrow()
    expect(() => assertCanDeliver(order, accountId, 'preview-multi', ['square'])).toThrowError(expect.objectContaining({ code: 'PREVIEW_NOT_APPROVED' }))
  })

  it('rejects video render batches with more than six products', () => {
    const products = Array.from({ length: 7 }, (_, index) => product(`item-${index + 1}`))
    let order = updateOrder(withHeader(create('video', products)), accountId, { division: 'pages' })
    for (const item of order.products) order = approveImage(order, accountId, { itemId: item.id, key: `${item.id}.png`, hash: `hash-${item.id}` })
    for (const item of order.products) order = approveImage(order, accountId, { itemId: item.id, key: `${item.id}.png`, hash: `hash-${item.id}` })
    order = approveData(order, accountId)
    expect(() => assertCanRender(order, accountId)).toThrowError(expect.objectContaining({ code: 'VIDEO_PRODUCT_LIMIT' }))
    expect(() => assertCanRender(order, accountId, { productIds: products.slice(0, 6).map((item) => item.id) })).not.toThrow()
  })

  it('requires complete institutional copy and preserves literal prices', () => {
    const blankInstitutional = createOrder({
      id: orderId, identity: { accountId, normalizedSender: '+5511999999999' }, kind: 'studio',
      theme: 'Aniversário', formats: [format], products: [], institutionalText: { title: '', message: '', callToAction: '' }
    })
    expect(() => approveData(blankInstitutional, accountId)).toThrowError(expect.objectContaining({ code: 'INSTITUTIONAL_TEXT_REQUIRED' }))
    const order = create('encarte', [product('item-1', 'dezenove e noventa')])
    expect(order.products[0]?.price).toBe('dezenove e noventa')
    expect(Object.isFrozen(order)).toBe(true)
    expect(Object.isFrozen(order.products[0])).toBe(true)
  })

  it('keeps missing themes pending and requires script approval before paid voice', () => {
    const missingTheme = createOrder({
      id: orderId, identity: { accountId, normalizedSender: '+5511999999999' }, kind: 'studio',
      theme: null, themeTicket: { status: 'pending' }, formats: [format], products: [],
      institutionalText: { title: 'Aniversário', message: 'A loja faz anos', callToAction: 'Venha comemorar' }
    })
    expect(missingTheme.themeTicket).toEqual({ status: 'pending' })
    expect(() => assertCanRender(missingTheme, accountId)).toThrowError(expect.objectContaining({ code: 'THEME_PENDING' }))
    let video = create('video', [])
    expect(() => assertCanGeneratePaidVoice(video, accountId)).toThrowError(expect.objectContaining({ code: 'SCRIPT_NOT_APPROVED' }))
    video = approveScript(video, accountId, 'Oferta de arroz a R$ 19,90.')
    expect(() => assertCanGeneratePaidVoice(video, accountId)).not.toThrow()
  })
})
