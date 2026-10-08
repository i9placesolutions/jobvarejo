// node --test scripts/flyer-templates/standardize-lib.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { standardizeFooter } from './standardize-lib.mjs'

const donorPaymentSlot = { type: 'Group', name: 'footer-payment-images', businessProfileField: 'footerPaymentImages', left: 0, top: 0, width: 300, height: 100, objects: [{ type: 'Rect', width: 300, height: 100 }] }
const text = (name, field, value, extra = {}) => ({ type: 'Textbox', name, businessProfileField: field, text: value, parentFrameId: 'f', left: 100, top: 1240, width: 300, height: 40, fill: '#ffffff', ...extra })
const frame = { type: 'Rect', isFrame: true, _customId: 'f', left: 0, top: 0, width: 1080, height: 1350 }
const names = canvas => canvas.objects.map(o => o.name)

const referenceFooter = () => ({ objects: [
  frame,
  { type: 'Rect', name: 'footer-premium-background', footerLayout: 'reference-contacts', parentFrameId: 'f', left: 17, top: 1210, width: 1046, height: 122, fill: '#4a2a00' },
  { type: 'Textbox', name: 'footer-reference-whatsapp-label', text: 'NOSSO WHATSAPP', parentFrameId: 'f', fill: '#ffd200', fontFamily: 'Barlow', left: 0, top: 0, width: 300, height: 20 },
  { type: 'Textbox', name: 'footer-reference-address-label', text: 'ENDEREÇO', parentFrameId: 'f', fill: '#ffd200', fontFamily: 'Barlow', left: 0, top: 0, width: 300, height: 20 },
  text('footer-dynamic-whatsapp', 'whatsapp', '(11) 99999-9999'),
  text('footer-dynamic-address', 'address', 'Rua da Loja, 100'),
  { type: 'Rect', name: 'footer-column-divider-1', parentFrameId: 'f', fill: '#ffd200', left: 500, top: 1220, width: 2, height: 80 }
] })

test('migra o rodapé de referência para 3 blocos com cartões e títulos padronizados', () => {
  const { canvas, changes } = standardizeFooter(referenceFooter(), { format: 'feed', donorPaymentSlot })
  const background = canvas.objects.find(o => o.name === 'footer-premium-background')
  assert.equal(background.footerLayout, 'campaign-retail')
  assert.ok(names(canvas).includes('footer-payment-images'))
  assert.ok(names(canvas).includes('footer-column-divider-2'))
  assert.equal(canvas.objects.find(o => o.name === 'footer-reference-whatsapp-label').text, 'FALE CONOSCO')
  const payment = canvas.objects.find(o => o.name === 'footer-payment-label')
  assert.equal(payment.text, 'CARTÕES ACEITOS')
  assert.equal(payment.fill, '#ffd200', 'título novo herda o estilo dos títulos do modelo')
  assert.ok(changes.length >= 4)
})

test('é idempotente: rodar de novo não muda nada', () => {
  const first = standardizeFooter(referenceFooter(), { format: 'feed', donorPaymentSlot })
  const second = standardizeFooter(first.canvas, { format: 'feed', donorPaymentSlot })
  assert.deepEqual(second.changes, [])
  assert.equal(second.canvas.objects.length, first.canvas.objects.length)
})

test('rodapé de campanha sem títulos ganha os três títulos', () => {
  const source = { objects: [frame,
    { type: 'Rect', name: 'footer-premium-background', footerLayout: 'campaign-retail', parentFrameId: 'f', left: 17, top: 1210, width: 1046, height: 120, fill: { type: 'linear', colorStops: [{ color: '#ff5a44' }, { color: '#d40808' }, { color: '#7a0000' }] } },
    text('footer-dynamic-whatsapp', 'whatsapp', '(11) 99999-9999'), text('footer-dynamic-address', 'address', 'Rua A'),
    { ...donorPaymentSlot, parentFrameId: 'f' }, { type: 'Rect', name: 'footer-column-divider-1', parentFrameId: 'f', fill: '#ffd200' }] }
  const { canvas } = standardizeFooter(source, { format: 'stories', donorPaymentSlot })
  const titles = canvas.objects.filter(o => o.footerTitle).map(o => o.text)
  assert.deepEqual(titles, ['FALE CONOSCO', 'ENDEREÇO', 'CARTÕES ACEITOS'])
  assert.ok(canvas.objects.filter(o => o.footerTitle).every(o => o.fill === '#ffd200'))
})

test('rodapé desenhado no fundo ganha faixa invisível e títulos na cor dos valores', () => {
  const source = { objects: [frame, text('footer-dynamic-whatsapp', 'whatsapp', '(11) 99999-9999', { fill: '#fff1c0' }), text('footer-dynamic-address', 'address', 'Rua A', { left: 450 })] }
  const { canvas, changes } = standardizeFooter(source, { format: 'feed', donorPaymentSlot })
  const background = canvas.objects.find(o => o.name === 'footer-premium-background')
  assert.equal(background.fill, 'rgba(0,0,0,0)')
  assert.equal(background.footerBakedBand, true)
  assert.ok(changes.includes('faixa do rodapé criada sobre o fundo desenhado'))
  assert.ok(canvas.objects.filter(o => o.footerTitle).every(o => o.fill === '#fff1c0'))
})

test('TV e páginas sem contatos ficam como estão; título personalizado é preservado', () => {
  assert.equal(standardizeFooter(referenceFooter(), { format: 'tv', donorPaymentSlot }).changes.length, 0)
  assert.equal(standardizeFooter({ objects: [frame] }, { format: 'feed', donorPaymentSlot }).changes.length, 0)
  const custom = referenceFooter()
  custom.objects[2].text = 'WHATSAPP DELIVERY'
  const { canvas } = standardizeFooter(custom, { format: 'feed', donorPaymentSlot })
  assert.equal(canvas.objects.find(o => o.name === 'footer-reference-whatsapp-label').text, 'WHATSAPP DELIVERY')
})
