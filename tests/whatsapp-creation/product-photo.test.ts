import { describe, expect, it } from 'vitest'
import { isRawWhatsAppPhoto, processedPhotoKey } from '../../server/utils/whatsapp-creation/product-photo'

const product = { id: 'p1', name: 'Manga Tommy', brand: '', variant: '', weight: '', price: '5.99' }
const rawHash = 'a'.repeat(64)

describe('foto de produto enviada pelo WhatsApp', () => {
  it('reconhece apenas fotos cruas recebidas na conversa', () => {
    expect(isRawWhatsAppPhoto('whatsapp-creation/eb847e8e-7c19-4bee-8042-376528ce6192/inbound/5364a460-02a8-4fc1-98aa-f18423b300fc.jpg')).toBe(true)
    expect(isRawWhatsAppPhoto('imagens/smart-src-05954074a91a5bc2-v2.webp')).toBe(false)
    expect(isRawWhatsAppPhoto('imagens/manual-abacate-8475748e19d0-v2.webp')).toBe(false)
    expect(isRawWhatsAppPhoto('whatsapp-creation/eb847e8e-7c19-4bee-8042-376528ce6192/headers/cache-x.png')).toBe(false)
  })

  it('salva com o nome do produto no padrão do upload manual', () => {
    const key = processedPhotoKey(product, rawHash)
    expect(key).toMatch(/^imagens\/manual-[a-z0-9-]*manga[a-z0-9-]*-[0-9a-f]{12}-birefnet-v2-a{16}-bg\.webp$/)
  })

  it('gera a mesma chave para a mesma foto e outra para foto diferente', () => {
    expect(processedPhotoKey(product, rawHash)).toBe(processedPhotoKey({ ...product }, rawHash))
    expect(processedPhotoKey(product, 'b'.repeat(64))).not.toBe(processedPhotoKey(product, rawHash))
  })
})
