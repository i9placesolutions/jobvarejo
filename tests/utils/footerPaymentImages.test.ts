import { describe, expect, it } from 'vitest'
import { normalizeBusinessProfile } from '../../utils/businessProfile'
import { mergeBusinessProfile } from '../../server/utils/business-profile'
import { normalizeFooterPaymentImages, footerPaymentImageUrl, isFooterPaymentGroupCurrent } from '../../utils/footerPaymentImages'
describe('imagens de cartões do rodapé', () => {
  it('limita a cinco imagens distintas e rejeita fontes temporárias', () => {
    expect(normalizeFooterPaymentImages(['imagens/a.png', 'imagens/a.png', 'blob:temp', 'data:image/png,x', ...['b','c','d','e','f'].map(x=>`imagens/${x}.png`)])).toEqual(['imagens/a.png','imagens/b.png','imagens/c.png','imagens/d.png','imagens/e.png'])
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
})
