import { describe, expect, it } from 'vitest'
import { normalizeBusinessProfile } from '../../utils/businessProfile'
import { mergeBusinessProfile } from '../../server/utils/business-profile'
import { normalizeFooterPaymentImages, footerPaymentImageUrl, isFooterPaymentGroupCurrent, createFooterPaymentGroup } from '../../utils/footerPaymentImages'
describe('imagens de cartões do rodapé', () => {
  it('limita a seis imagens distintas e rejeita fontes temporárias', () => {
    expect(normalizeFooterPaymentImages(['imagens/a.png', 'imagens/a.png', 'blob:temp', 'data:image/png,x', ...['b','c','d','e','f'].map(x=>`imagens/${x}.png`)])).toEqual(['imagens/a.png','imagens/b.png','imagens/c.png','imagens/d.png','imagens/e.png','imagens/f.png'])
  })
  it('não inventa cartões quando o cliente ainda não escolheu', () => {
    expect(normalizeBusinessProfile({}).footerPaymentImages).toEqual([])
  })
  it('preserva a escolha em atualização parcial e permite limpar', () => {
    const profile = { footerPaymentImages: ['imagens/cartao.webp'] }
    expect(mergeBusinessProfile(profile, { address: 'Rua A' }).footerPaymentImages).toEqual(profile.footerPaymentImages)
    expect(mergeBusinessProfile(profile, { footerPaymentImages: [] }).footerPaymentImages).toEqual([])
  })
  it('resolve a chave durável pelo proxy de imagens', () => {
    expect(footerPaymentImageUrl('imagens/cartão.webp')).toBe('/api/storage/p?key=imagens%2Fcart%C3%A3o.webp')
  })
  it('reutiliza o grupo persistido e o grupo Fabric com as mesmas fontes e tamanho', () => {
    const objects = [{ type: 'Rect', width: 300, height: 50 }, { type: 'Image', __originalSrc: '/cartoes/cartao-1.png' }]
    const slot = { type: 'Group', footerPaymentWidth: 300, footerPaymentHeight: 50, objects }
    expect(isFooterPaymentGroupCurrent(slot, ['brand:cartao-1'])).toBe(true)
    expect(isFooterPaymentGroupCurrent({ ...slot, objects: undefined, getObjects: () => objects }, ['brand:cartao-1'])).toBe(true)
    expect(isFooterPaymentGroupCurrent(slot, ['brand:cartao-2'])).toBe(false)
    expect(isFooterPaymentGroupCurrent({ ...slot, footerPaymentWidth: 400 }, ['brand:cartao-1'])).toBe(false)
    expect(isFooterPaymentGroupCurrent(slot, [])).toBe(false)
    expect(isFooterPaymentGroupCurrent({ type: 'Rect', width: 300, height: 50 }, [])).toBe(false)
  })

  it.each([1, 5, 6])('cria grade 3x2 para %i cartões e preserva a linha legada', async count => {
    class Rect { type = 'Rect'; constructor(public values: any) { Object.assign(this, values) } }
    class Group { type = 'Group'; constructor(public objects: any[], public values: any) { Object.assign(this, values) } getObjects() { return this.objects } }
    const fabric = { Rect, Group, FabricImage: { fromURL: async (src: string) => ({ type: 'Image', src, width: 120, height: 60, set(values: any) { Object.assign(this, values) } }) } }
    const values = Array.from({ length: count }, (_, index) => `brand:cartao-${index + 1}`)
    const grid = await createFooterPaymentGroup(fabric, { left: 0, top: 0, width: 300, height: 80, footerPaymentColumns: 3 }, values)
    expect(grid.footerPaymentColumns).toBe(3)
    expect(grid.getObjects().filter((child: any) => child.type === 'Image')).toHaveLength(count)
    expect(isFooterPaymentGroupCurrent(grid, values)).toBe(true)
    if (count > 3) expect(new Set(grid.getObjects().filter((child: any) => child.type === 'Image').map((child: any) => child.top)).size).toBe(2)

    const row = await createFooterPaymentGroup(fabric, { left: 0, top: 0, width: 300, height: 80 }, values)
    expect(row.footerPaymentColumns).toBeUndefined()
    expect(isFooterPaymentGroupCurrent(row, values)).toBe(true)
    if (count > 3) expect(isFooterPaymentGroupCurrent({ ...grid, footerPaymentColumns: undefined }, values)).toBe(false)
  })

  it('desenha um azulejo por cartão quando o modelo pede fundo próprio', async () => {
    class Rect { type = 'Rect'; constructor(public values: any) { Object.assign(this, values) } }
    class Group { type = 'Group'; constructor(public objects: any[], public values: any) { Object.assign(this, values) } getObjects() { return this.objects } }
    const fabric = { Rect, Group, FabricImage: { fromURL: async (src: string) => ({ type: 'Image', src, width: 120, height: 60, set(values: any) { Object.assign(this, values) } }) } }
    const values = ['brand:cartao-1', 'brand:cartao-2', 'brand:cartao-3']
    const group = await createFooterPaymentGroup(fabric, { left: 0, top: 0, width: 300, height: 50, footerPaymentTile: '#ffffff' }, values)
    const children = group.getObjects()
    const tiles = children.filter((child: any) => child.type === 'Rect').slice(1)
    expect(group.footerPaymentTile).toBe('#ffffff')
    expect(tiles).toHaveLength(3)
    expect(tiles.every((tile: any) => tile.fill === '#ffffff' && tile.height <= 50)).toBe(true)
    // Cada imagem fica dentro do próprio azulejo.
    for (const [index, image] of children.filter((child: any) => child.type === 'Image').entries()) {
      expect(image.left).toBeCloseTo(tiles[index].left)
      expect(120 * image.scaleX).toBeLessThan(tiles[index].width)
    }
    expect(isFooterPaymentGroupCurrent(group, values)).toBe(true)
    expect(isFooterPaymentGroupCurrent({ ...group, footerPaymentTile: undefined }, values)).toBe(false)
  })
})
