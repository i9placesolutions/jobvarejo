/**
 * Padronização do rodapé dos modelos de encarte (docs/encartes-padrao-design.md, seção 3).
 * Função pura sobre o JSON do Fabric: devolve o canvas ajustado e a lista do que mudou.
 *
 * - Rodapé de referência (2 colunas, sem cartões) → rodapé de campanha (3 blocos com cartões).
 * - Rodapé de campanha sem títulos → ganha "FALE CONOSCO", "ENDEREÇO" e "CARTÕES ACEITOS".
 * - Rodapé desenhado no fundo (sem objeto de faixa) → ganha faixa invisível que organiza os campos.
 * - TV não recebe contatos (regra do formato); páginas sem campos de contato ficam como estão.
 */
import { randomUUID } from 'node:crypto'
import { ensureFooterTitles, footerTitleColor } from '../lib/footer-titles.mjs'

export const STANDARD_TITLES = {
  'footer-reference-whatsapp-label': 'FALE CONOSCO',
  'footer-reference-address-label': 'ENDEREÇO',
  'footer-payment-label': 'CARTÕES ACEITOS'
}
// Títulos personalizados que comunicam algo além do padrão ficam como estão.
const CUSTOM_TITLES = new Set(['WHATSAPP DELIVERY'])
const DEFAULT_CARDS = ['brand:cartao-82', 'brand:cartao-81', 'brand:cartao-84', 'brand:cartao-80', 'brand:cartao-79', 'brand:cartao-86']

const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
export const bounds = o => {
  const w = num(o?.width) * Math.abs(num(o?.scaleX, 1)), h = num(o?.height) * Math.abs(num(o?.scaleY, 1))
  const left = num(o?.left) - (o?.originX === 'center' ? w / 2 : o?.originX === 'right' ? w : 0)
  const top = num(o?.top) - (o?.originY === 'center' ? h / 2 : o?.originY === 'bottom' ? h : 0)
  return { left, top, width: w, height: h, right: left + w, bottom: top + h }
}
const byName = (objects, name) => objects.find(o => o?.name === name)

/** Slot de cartões no padrão do app (grupo com bandeiras; o layout redimensiona). */
export function paymentSlotFrom(donorSlot, background, footerScale) {
  const slot = structuredClone(donorSlot)
  const area = bounds(background)
  Object.assign(slot, {
    _customId: randomUUID(), name: 'footer-payment-images', layerName: 'Cartões aceitos', businessProfileField: 'footerPaymentImages',
    quickFieldEnabled: true, parentFrameId: background.parentFrameId, _frameClipOwner: background._frameClipOwner || background.parentFrameId,
    left: area.left + area.width * .66, top: area.top + 12 * footerScale, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, angle: 0,
    footerPaymentWidth: area.width * .32, footerPaymentHeight: Math.max(20, area.height - 24 * footerScale), footerPaymentColumns: 3, footerPaymentTile: '#ffffff', visible: true
  })
  delete slot.clipPath
  return slot
}

/**
 * @param {any} source canvas
 * @param {{ format: string, donorPaymentSlot: any }} options
 * @returns {{ canvas: any, changes: string[], skipped?: string }}
 */
export function standardizeFooter(source, { format, donorPaymentSlot }) {
  if (format === 'tv') return { canvas: source, changes: [], skipped: 'TV sem contatos' }
  let canvas = structuredClone(source)
  const objects = canvas.objects
  const changes = []
  const whatsapp = byName(objects, 'footer-dynamic-whatsapp'), address = byName(objects, 'footer-dynamic-address')
  if (!whatsapp && !address) return { canvas: source, changes: [], skipped: 'sem campos de contato no rodapé' }
  let background = byName(objects, 'footer-premium-background')

  // Rodapé desenhado no fundo: faixa invisível cobrindo os campos, para o layout organizar.
  if (!background) {
    const parts = objects.filter(o => /^footer-|^icon-(whatsapp|address)$/.test(String(o?.name || '')) || o?.businessProfileField === 'footerPaymentImages')
    const boxes = parts.map(bounds).filter(b => b.width > 0 && b.height > 0)
    if (!boxes.length) return { canvas: source, changes: [], skipped: 'rodapé sem geometria' }
    const frame = objects.find(o => o?.isFrame)
    const frameBox = frame ? bounds(frame) : { left: 0, width: num(canvas.width, 1080) }
    const u = frameBox.width / 1080
    const top = Math.min(...boxes.map(b => b.top)), bottom = Math.max(...boxes.map(b => b.bottom))
    background = {
      type: 'Rect', version: '7.1.0', _customId: randomUUID(), name: 'footer-premium-background', layerName: 'Rodapé (faixa do fundo)',
      parentFrameId: whatsapp?.parentFrameId || address?.parentFrameId, _frameClipOwner: whatsapp?._frameClipOwner || whatsapp?.parentFrameId,
      originX: 'left', originY: 'top', left: frameBox.left + 17 * u, top: top - 6 * u, width: frameBox.width - 34 * u, height: bottom - top + 12 * u,
      scaleX: 1, scaleY: 1, angle: 0, fill: 'rgba(0,0,0,0)', strokeWidth: 0, footerLayout: 'campaign-retail', footerColumnWeights: [1.2, 1.2, .8],
      footerBakedBand: true, selectable: true, evented: true, visible: true
    }
    // As colunas seguem as divisórias que já estão na arte (ícones costumam estar fixados nelas).
    const dividers = ['footer-column-divider-1', 'footer-column-divider-2'].map(name => byName(objects, name)).filter(Boolean).map(o => bounds(o).left).sort((a, b) => a - b)
    if (dividers.length === 2) {
      const left = background.left + 20 * u, right = background.left + background.width - 20 * u
      const widths = [dividers[0] - left, dividers[1] - dividers[0], right - dividers[1]]
      if (widths.every(w => w > 40 * u)) background.footerColumnWeights = widths.map(w => Math.round(w / Math.max(...widths) * 100) / 100)
    }
    objects.splice(objects.indexOf(parts[0]), 0, background)
    changes.push('faixa do rodapé criada sobre o fundo desenhado')
  }

  if (background.footerLayout === 'reference-contacts') {
    Object.assign(background, { footerLayout: 'campaign-retail', footerColumnWeights: [1.2, 1.2, .8] })
    changes.push('rodapé de referência migrado para 3 blocos')
  }
  if (background.footerLayout !== 'campaign-retail') return { canvas: source, changes: [], skipped: `rodapé ${background.footerLayout || 'sem layout'}` }

  const area = bounds(background)
  const scale = background.footerStack ? Math.min(1.4, Math.max(.25, area.width / 380)) : Math.max(.25, area.width / 1080)
  // Cartões aceitos: todo rodapé completo tem o bloco (some sozinho se o perfil não tiver bandeiras).
  if (!objects.some(o => o?.businessProfileField === 'footerPaymentImages')) {
    objects.splice(objects.indexOf(background) + 1, 0, paymentSlotFrom(donorPaymentSlot, background, scale))
    changes.push('bloco de cartões aceitos adicionado')
  }
  // Duas divisórias entre os três blocos.
  const divider1 = byName(objects, 'footer-column-divider-1')
  if (divider1 && !byName(objects, 'footer-column-divider-2')) {
    objects.splice(objects.indexOf(divider1) + 1, 0, { ...structuredClone(divider1), _customId: randomUUID(), name: 'footer-column-divider-2' })
    changes.push('segunda divisória adicionada')
  }

  // Títulos: textos padronizados nos que já existem (estilo do modelo preservado) e os que faltam.
  const existingLabel = byName(objects, 'footer-reference-address-label') || byName(objects, 'footer-reference-whatsapp-label')
  for (const [name, text] of Object.entries(STANDARD_TITLES)) {
    const label = byName(objects, name)
    if (label && label.text !== text && !CUSTOM_TITLES.has(String(label.text || '').trim().toUpperCase())) {
      label.text = text; label.__rawText = text
      changes.push(`título "${text}" padronizado`)
    }
    if (!label && name === 'footer-payment-label' && existingLabel) {
      // Mesmo estilo dos títulos que o modelo já tem.
      const clone = { ...structuredClone(existingLabel), _customId: randomUUID(), name, text, __rawText: text, layerName: 'Título: cartões aceitos' }
      objects.splice(objects.indexOf(existingLabel) + 1, 0, clone)
      changes.push(`título "${text}" adicionado`)
    }
  }
  // Legendas com espaçamento entre letras ficam com letras espalhadas quando o encaixe reduz o texto.
  for (const o of canvas.objects) if (/^footer-(whatsapp|address)-caption$/.test(String(o?.name || '')) && Number(o.charSpacing) > 0) {
    o.charSpacing = 0
    changes.push('espaçamento da legenda ajustado')
  }
  // Título e valor na mesma margem: WhatsApp e endereço alinhados à esquerda, como os títulos.
  for (const field of [whatsapp, address]) {
    const live = field && canvas.objects.find(o => o?.name === field.name)
    if (live && live.textAlign && live.textAlign !== 'left') { live.textAlign = 'left'; changes.push(`${field.name === 'footer-dynamic-whatsapp' ? 'WhatsApp' : 'endereço'} alinhado à esquerda`) }
  }
  const titled = ensureFooterTitles(canvas)
  canvas = titled.canvas
  for (const name of titled.added) changes.push(`título "${STANDARD_TITLES[name]}" adicionado`)
  // Faixa desenhada no fundo: títulos na mesma cor dos valores (o fundo real é imagem).
  if (background.footerBakedBand) {
    const value = (whatsapp || address)?.fill
    for (const o of canvas.objects) if (Object.hasOwn(STANDARD_TITLES, o?.name) && typeof value === 'string') o.fill = value
  } else {
    const fill = footerTitleColor(background, byName(canvas.objects, 'footer-column-divider-1')?.fill)
    for (const o of canvas.objects) if (o?.footerTitle && !o.fill) o.fill = fill
  }
  return { canvas, changes }
}
