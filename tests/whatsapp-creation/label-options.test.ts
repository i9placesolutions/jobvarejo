import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('../../server/utils/postgres', () => ({ pgQuery: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: vi.fn() }) }))
vi.mock('../../server/utils/video-studio/service', () => ({ videoBucket: () => 'test-bucket' }))

const { buildLabelOptions, pickCompatibleLabels, renderLabelOptionsBoard } = await import('../../server/utils/whatsapp-creation/label-options')

const accountId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const simple = (id: string, preview?: string) => ({ id, name: `Etiqueta ${id}`, group: { type: 'group', objects: [{ name: 'price_text' }] }, preview_data_url: preview })
const multi = (id: string) => ({ id, name: `Atacarejo ${id}`, group: { type: 'group', objects: [{ name: 'atac_retail_bg' }] } })
const products = [
  { id: 'p1', name: 'Arroz', brand: '', variant: '', weight: '', price: '19,90' },
  { id: 'p2', name: 'Feijão', brand: '', variant: '', weight: '', price: '8,50' }
]

describe('opções de etiqueta do WhatsApp', () => {
  it('descarta etiquetas incompatíveis com o preço dos produtos e repetidas', () => {
    const picked = pickCompatibleLabels([simple('a'), multi('m'), simple('a'), simple('b')], products)
    expect(picked.map(row => row.id)).toEqual(['a', 'b'])
  })

  it('limita a 8 e põe as que têm prévia na frente', () => {
    const rows = [...Array.from({ length: 6 }, (_, index) => simple(`sem-${index}`)), ...Array.from({ length: 6 }, (_, index) => simple(`com-${index}`, 'data:image/png;base64,AAAA'))]
    const picked = pickCompatibleLabels(rows, products)
    expect(picked).toHaveLength(8)
    expect(picked.slice(0, 6).every(row => row.id.startsWith('com-'))).toBe(true)
  })

  it('monta a imagem numerada e guarda sob a pasta do pedido', async () => {
    const preview = `data:image/png;base64,${(await sharp({ create: { width: 40, height: 20, channels: 3, background: '#cc2200' } }).png().toBuffer()).toString('base64')}`
    const storeImage = vi.fn(async () => undefined)
    const result = await buildLabelOptions({ accountId, orderId, products, itemIds: [] }, {
      loadTemplates: async () => [simple('a', preview), simple('b', preview), multi('m')], storeImage
    })
    expect(result?.options).toEqual([{ id: 'a', name: 'Etiqueta a' }, { id: 'b', name: 'Etiqueta b' }])
    expect(result?.imageKey).toMatch(new RegExp(`^whatsapp-creation/${accountId}/${orderId}/labels-[0-9a-f-]{36}\\.png$`))
    expect(storeImage).toHaveBeenCalledTimes(1)
    const png = (storeImage.mock.calls[0] as unknown as [string, Buffer])[1]
    expect((await sharp(png).metadata()).width).toBe(760)
    expect((await renderLabelOptionsBoard([simple('x')])).length).toBeGreaterThan(100)
  })

  it('sem prévia, com falha ou estouro do tempo devolve só a lista em texto', async () => {
    const noPreview = await buildLabelOptions({ accountId, orderId, products, itemIds: [] }, { loadTemplates: async () => [simple('a')] })
    expect(noPreview).toEqual({ options: [{ id: 'a', name: 'Etiqueta a' }] })
    const preview = 'data:image/png;base64,AAAA'
    const failed = await buildLabelOptions({ accountId, orderId, products, itemIds: [] }, {
      loadTemplates: async () => [simple('a', preview)], storeImage: async () => { throw new Error('s3') }
    })
    expect(failed).toEqual({ options: [{ id: 'a', name: 'Etiqueta a' }] })
    const slow = await buildLabelOptions({ accountId, orderId, products, itemIds: [] }, {
      loadTemplates: async () => [simple('a', preview)], budgetMs: 5, storeImage: () => new Promise(resolve => setTimeout(resolve, 200))
    })
    expect(slow?.imageKey).toBeUndefined()
  })

  it('sem etiqueta compatível devolve null', async () => {
    expect(await buildLabelOptions({ accountId, orderId, products, itemIds: [] }, { loadTemplates: async () => [multi('m')] })).toBeNull()
  })

  it('para produtos específicos considera só a compatibilidade deles', async () => {
    const mixed = [...products, { id: 'p3', name: 'Leite', brand: '', variant: '', weight: '', price: '5,00', priceSpecial: '4,50' } as any]
    const result = await buildLabelOptions({ accountId, orderId, products: mixed, itemIds: ['p1'] }, { loadTemplates: async () => [simple('a'), multi('m')] })
    expect(result?.options.map(option => option.id)).toEqual(['a'])
  })
})
