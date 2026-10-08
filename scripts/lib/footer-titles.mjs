/**
 * Títulos do rodapé completo: "FALE CONOSCO" (WhatsApp), "ENDEREÇO" e "CARTÕES ACEITOS".
 * Usa os nomes que o layout do app já reconhece (utils/campaignRetailLayout.ts e
 * utils/referenceFlyerLayout.ts): eles somem junto com o campo quando o perfil não tem o dado
 * e são reposicionados pelo layout dinâmico. Idempotente: não duplica títulos existentes.
 */
import { randomUUID } from 'node:crypto'

export const FOOTER_TITLES = [
  { name: 'footer-reference-whatsapp-label', text: 'FALE CONOSCO', field: 'whatsapp' },
  { name: 'footer-reference-address-label', text: 'ENDEREÇO', field: 'address' },
  { name: 'footer-payment-label', text: 'CARTÕES ACEITOS', field: 'footerPaymentImages' }
]

const hex = value => {
  const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return null
  const raw = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1]
  return [0, 2, 4].map(i => parseInt(raw.slice(i, i + 2), 16))
}
const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 })
  return .2126 * r + .7152 * g + .0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + .05) / (y + .05) }

/** Cor de fundo predominante do rodapé (cor sólida ou parada central do gradiente). */
export const footerBaseColor = background => {
  const fill = background?.fill
  if (typeof fill === 'string') return hex(fill)
  const stops = fill?.colorStops || []
  return hex(stops[Math.floor(stops.length / 2)]?.color || stops[0]?.color)
}

/**
 * Cor do título: o destaque do tema (divisória do rodapé) quando contrasta com o fundo;
 * senão amarelo-ouro em fundo escuro ou grafite em fundo claro.
 */
export const footerTitleColor = (background, accent) => {
  const base = footerBaseColor(background) || [180, 0, 0]
  const candidate = hex(accent)
  if (candidate && contrast(candidate, base) >= 3) return accent
  return luminance(base) < .35 ? '#FFE14D' : '#1B1B1B'
}

const walkFind = (objects, predicate) => {
  for (const o of objects || []) {
    if (predicate(o)) return o
    const nested = Array.isArray(o.objects) ? walkFind(o.objects, predicate) : null
    if (nested) return nested
  }
  return null
}

/**
 * Garante os títulos no rodapé do canvas (JSON do Fabric). Só age em rodapés que o app sabe
 * organizar ('campaign-retail', inclusive empilhado, e 'reference-contacts'); outros ficam como estão.
 * @returns {{ canvas: any, added: string[], skipped?: string }}
 */
export function ensureFooterTitles(source) {
  const canvas = structuredClone(source)
  const objects = canvas.objects || []
  const background = objects.find(o => o?.name === 'footer-premium-background' && ['campaign-retail', 'reference-contacts'].includes(o.footerLayout))
  if (!background) return { canvas, added: [], skipped: 'rodapé sem layout dinâmico reconhecido' }
  const width = Number(background.width || 0) * Math.abs(Number(background.scaleX || 1))
  const stack = background.footerStack === true
  const scale = stack ? Math.min(1.4, Math.max(.25, width / 380)) : Math.max(.25, width / 1080)
  const accent = objects.find(o => o?.name === 'footer-column-divider-1')?.fill
  const fill = footerTitleColor(background, accent)
  const added = []
  let insertAt = objects.indexOf(background) + 1
  for (const title of FOOTER_TITLES) {
    if (objects.some(o => o?.name === title.name)) continue
    // Só cria o título se o modelo tem o campo correspondente.
    const hasField = walkFind(objects, o => o?.businessProfileField === title.field || o?.name === `footer-dynamic-${title.field}`)
    if (!hasField) continue
    // O rodapé de referência só tem títulos para WhatsApp e endereço.
    if (background.footerLayout === 'reference-contacts' && title.field === 'footerPaymentImages') continue
    const size = 21 * scale
    objects.splice(insertAt++, 0, {
      type: 'Textbox', version: '7.1.0', _customId: randomUUID(), name: title.name, layerName: `Título: ${title.text.toLowerCase()}`,
      parentFrameId: background.parentFrameId, _frameClipOwner: background._frameClipOwner || background.parentFrameId,
      originX: 'left', originY: 'top', left: Number(background.left || 0) + 20 * scale, top: Number(background.top || 0) + 8 * scale,
      width: Math.max(60, width * (stack ? .8 : .28)), height: size * 1.1, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true,
      text: title.text, __rawText: title.text, fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: size, lineHeight: 1.02,
      charSpacing: 0, fill, textAlign: 'left', styles: {}, splitByGrapheme: false, footerTitle: true,
      dynamicFieldBaseFontSize: size, dynamicFieldAutoFitFontSize: size, selectable: true, evented: true
    })
    added.push(title.name)
  }
  return { canvas, added }
}
