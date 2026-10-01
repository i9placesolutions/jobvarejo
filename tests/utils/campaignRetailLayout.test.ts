import { describe, expect, it } from 'vitest'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'

const text = (name: string, field: string, value: string, parentFrameId = 'frame') => ({ type: 'Textbox', name, text: value, businessProfileField: field, parentFrameId, left: 0, top: 0, width: 180, height: 30, scaleX: 1, scaleY: 1, fontSize: 20, originX: 'left', originY: 'top', visible: true })

describe('layout dinâmico da campanha varejo', () => {
  it('coloca o perfil abaixo dos ícones na faixa social estreita', () => {
    const band = { name: 'header-social-background', footerLayout: 'campaign-social', footerSocialLayout: 'stacked', parentFrameId: 'frame', left: 30, top: 380, width: 290, height: 85 }
    const instagram = text('header-instagram', 'instagram', '@SUPERMERCADORODRIGUES')
    const facebook = text('header-facebook', 'facebook', '@SUPERMERCADORODRIGUES')
    const icon = { name: 'header-icon-instagram', parentFrameId: 'frame', left: 0, top: 0, width: 32, height: 32, visible: true }
    const caption = text('header-social-caption', '', 'SIGA NOSSAS\nREDES SOCIAIS!')
    compactBusinessFooter([band, instagram, facebook, icon, { ...icon, name: 'header-icon-facebook' }, caption])
    expect(instagram.top).toBeGreaterThan(icon.top + 32)
    expect(instagram.width * instagram.scaleX).toBeGreaterThan(260)
    expect(instagram.fontSize * instagram.scaleY).toBeGreaterThan(15)
    expect(facebook.visible).toBe(false)
  })
  it('mantém a chamada abaixo do perfil nas referências com duas linhas', () => {
    const band = { name: 'header-social-background', footerLayout: 'campaign-social', footerSocialLayout: 'caption-below', parentFrameId: 'frame', left: 30, top: 20, width: 400, height: 85 }
    const instagram = text('header-instagram', 'instagram', '@SUPERMERCADORODRIGUES')
    const facebook = text('header-facebook', 'facebook', '@SUPERMERCADORODRIGUES')
    const icon = { name: 'header-icon-instagram', parentFrameId: 'frame', left: 0, top: 0, width: 32, height: 32, visible: true }
    const caption = text('header-social-caption', '', 'SIGA NOSSAS\nREDES SOCIAIS!')
    compactBusinessFooter([band, instagram, facebook, icon, { ...icon, name: 'header-icon-facebook' }, caption])
    expect(caption.top).toBeGreaterThan(instagram.top)
    expect(instagram.fontSize * instagram.scaleY).toBeGreaterThan(15)
    expect(caption.width * caption.scaleX).toBeGreaterThan(350)
  })
  it('recolhe redes vazias, reutiliza um texto para handles iguais e reativa ambos quando diferem', () => {
    const band = { type: 'Rect', name: 'header-social-background', footerLayout: 'campaign-social', parentFrameId: 'frame', left: 552, top: 2, width: 510, height: 70, visible: true }
    const instagram = text('header-instagram', 'instagram', '')
    const facebook = text('header-facebook', 'facebook', '')
    const iconInstagram = { type: 'Image', name: 'header-icon-instagram', parentFrameId: 'frame', left: 0, top: 0, width: 32, height: 32, visible: true }
    const iconFacebook = { ...iconInstagram, name: 'header-icon-facebook' }
    const caption = text('header-social-caption', '', 'SIGA NOSSAS\nREDES SOCIAIS!')
    const divider = { type: 'Rect', name: 'header-social-divider', parentFrameId: 'frame', left: 0, top: 0, width: 2, height: 40, visible: true }
    const nodes = [band, instagram, facebook, iconInstagram, iconFacebook, caption, divider]
    compactBusinessFooter(nodes)
    expect([band.visible, iconInstagram.visible, iconFacebook.visible, caption.visible, divider.visible]).toEqual([false, false, false, false, false])
    instagram.text = '@LOJA'
    compactBusinessFooter(nodes)
    expect([band.visible, iconInstagram.visible, iconFacebook.visible]).toEqual([true, true, false])
    expect(caption.text).toBe('SIGA NOSSAS\nREDES SOCIAIS!')
    facebook.text = '@LOJA'
    compactBusinessFooter(nodes)
    expect([iconInstagram.visible, iconFacebook.visible, instagram.visible, facebook.visible]).toEqual([true, true, true, false])
    facebook.text = '@OUTRA_LOJA'
    compactBusinessFooter(nodes)
    expect([instagram.visible, facebook.visible, iconInstagram.visible, iconFacebook.visible]).toEqual([true, true, true, true])
    expect(instagram.left).toBe(facebook.left)
    expect(Math.abs(instagram.top - facebook.top)).toBeGreaterThan(20)
  })

  it('recolhe e reabre colunas do rodapé conforme telefone, endereço e cartões chegam', () => {
    const background = { type: 'Rect', name: 'footer-premium-background', parentFrameId: 'frame', footerLayout: 'campaign-retail', left: 0, top: 800, width: 1080, height: 156, visible: true }
    const whatsapp = text('footer-dynamic-whatsapp', 'whatsapp', '')
    const address = text('footer-dynamic-address', 'address', '')
    const payment: any = { type: 'Group', name: 'footer-payment-images', businessProfileField: 'footerPaymentImages', parentFrameId: 'frame', left: 0, top: 0, width: 100, height: 50, footerPaymentWidth: 100, footerPaymentHeight: 50, visible: true, objects: [{ type: 'Rect', width: 100, height: 50 }] }
    const whatsappTitle = text('footer-reference-whatsapp-label', '', 'NOSSO WHATSAPP')
    const addressTitle = text('footer-reference-address-label', '', 'ENDEREÇO')
    const paymentTitle = text('footer-payment-label', '', 'ACEITAMOS OS CARTÕES')
    const whatsappCaption = text('footer-whatsapp-caption', '', 'FALE COM A GENTE!')
    const addressCaption = text('footer-address-caption', '', 'VENHA NOS VISITAR!')
    const whatsappIcon = { type: 'Image', name: 'icon-whatsapp', parentFrameId: 'frame', width: 40, height: 40, left: 0, top: 0, visible: true }
    const addressIcon = { ...whatsappIcon, name: 'icon-address' }
    const divider1 = { type: 'Rect', name: 'footer-column-divider-1', parentFrameId: 'frame', width: 2, height: 80, left: 0, top: 0, visible: true }
    const divider2 = { ...divider1, name: 'footer-column-divider-2' }
    const nodes = [background, whatsapp, address, payment, whatsappTitle, addressTitle, paymentTitle, whatsappCaption, addressCaption, whatsappIcon, addressIcon, divider1, divider2]
    compactBusinessFooter(nodes)
    expect([whatsapp.visible, address.visible, payment.visible, divider1.visible, divider2.visible]).toEqual([false, false, false, false, false])
    whatsapp.text = '(11) 99999-9999'
    compactBusinessFooter(nodes)
    expect([whatsapp.visible, whatsappTitle.visible, whatsappCaption.visible, whatsappIcon.visible]).toEqual([true, true, true, true])
    address.text = 'RUA DA LOJA, 100 - CENTRO, CIDADE - UF'
    compactBusinessFooter(nodes)
    expect([address.visible, addressTitle.visible, addressCaption.visible, divider1.visible, divider2.visible]).toEqual([true, true, true, true, false])
    payment.objects.push({ type: 'Image', src: '/cartoes/visa.png' })
    payment.visible = true
    compactBusinessFooter(nodes)
    expect([payment.visible, paymentTitle.visible, divider1.visible, divider2.visible]).toEqual([true, true, true, true])
    expect(payment.footerPaymentHeight).toBeGreaterThan(90)
    payment.objects = [{ type: 'Rect', width: 100, height: 50 }]
    whatsapp.text = ''
    compactBusinessFooter(nodes)
    expect([whatsapp.visible, address.visible, payment.visible, divider1.visible, divider2.visible]).toEqual([false, true, false, false, false])
    expect(address.left).toBeLessThan(140)
  })

  it('mantém rodapés antigos fora do novo layout opt-in', () => {
    const background: any = { type: 'Rect', name: 'footer-premium-background', parentFrameId: 'legacy', left: 0, top: 1200, width: 1080, height: 120, visible: true }
    const address = text('footer-dynamic-address', 'address', 'Rua A', 'legacy')
    const nodes = [background, address]
    compactBusinessFooter(nodes)
    expect(background.footerLayout).toBeUndefined()
    expect(address.visible).toBe(true)
  })

  it('reserva mais espaço ao endereço e redistribui os pesos quando falta um campo', () => {
    const background = { name: 'footer-premium-background', parentFrameId: 'frame', footerLayout: 'campaign-retail', footerColumnWeights: [.34, .44, .22], left: 0, top: 800, width: 1080, height: 140 }
    const whatsapp = text('footer-dynamic-whatsapp', 'whatsapp', '(11) 99999-9999')
    const address = text('footer-dynamic-address', 'address', 'Rua da Loja, 100 - Centro\nCidade - UF')
    const payment: any = { type: 'Group', name: 'footer-payment-images', parentFrameId: 'frame', width: 200, height: 80, visible: true, objects: [{ type: 'Image' }] }
    const panel = { name: 'footer-whatsapp-panel', parentFrameId: 'frame', left: 0, top: 0, width: 10, height: 10, visible: true }
    const nodes = [background, whatsapp, address, payment, panel]
    compactBusinessFooter(nodes)
    expect(address.width / payment.width).toBeCloseTo(2)
    expect(panel.width).toBeGreaterThan(whatsapp.width)
    const previousWidth = address.width
    whatsapp.text = ''
    compactBusinessFooter(nodes)
    expect(address.width).toBeGreaterThan(previousWidth)
    expect(address.width / payment.width).toBeCloseTo(2)
    expect(address.left).toBe(20)
    expect(panel.visible).toBe(false)
  })
})
