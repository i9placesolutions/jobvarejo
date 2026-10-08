/**
 * Validade no vão da arte (modelos da fábrica de campanhas de 03/10/2026).
 *
 * Nesses modelos o fundo é dividido em cabeçalho e campo de produtos com um vão entre eles, por onde
 * aparece a cor de base: é a faixa onde a data deve ficar. Uma pílula colorida
 * (retail-validity-visual-band) foi posta por cima, deslocada do vão. O ajuste esconde a pílula, leva a
 * área da validade (standard-validity-background) para o vão e pinta data e calendário com a cor da
 * pílula (ou branco/preto se o contraste com a faixa for baixo). O layout do editor
 * (layoutInlineFooterValidity) centraliza ícone e data em uma linha dentro dessa área.
 */
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
export const bounds = o => {
  const w = num(o?.width) * Math.abs(num(o?.scaleX, 1)), h = num(o?.height) * Math.abs(num(o?.scaleY, 1))
  const left = num(o?.left) - (o?.originX === 'center' ? w / 2 : o?.originX === 'right' ? w : 0)
  const top = num(o?.top) - (o?.originY === 'center' ? h / 2 : o?.originY === 'bottom' ? h : 0)
  return { left, top, width: w, height: h, right: left + w, bottom: top + h }
}
const visible = o => o && o.visible !== false && num(o.opacity, 1) > 0

const rgb = color => {
  const hex = String(color || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (hex) {
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
  }
  const m = String(color || '').match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  return m ? m.slice(1, 4).map(Number) : null
}
const luminance = ([r, g, b]) => {
  const c = [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 })
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
}
export const contrast = (a, b) => {
  const x = rgb(a), y = rgb(b)
  if (!x || !y) return 0
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (hi + .05) / (lo + .05)
}
/** Cor da data sobre a faixa: a da pílula quando legível (≥ 3:1), senão branco ou preto. */
export const validityTextColor = (pillColor, stripColor) => {
  if (contrast(pillColor, stripColor) >= 3) return pillColor
  return contrast('#ffffff', stripColor) >= contrast('#171717', stripColor) ? '#ffffff' : '#171717'
}

/**
 * @param {any} source canvas do Fabric
 * @returns {{ canvas: any, changes: string[], skipped?: string }}
 */
export function moveValidityIntoGap(source) {
  const objects = source?.objects || []
  const by = name => objects.find(o => o?.name === name)
  const band = by('retail-validity-visual-band'), area = by('standard-validity-background'), date = by('header-validity')
  const header = by('campaign-bg-header'), field = by('campaign-bg-retail-field')
  if (!visible(band)) return { canvas: source, changes: [], skipped: 'sem pílula de validade visível' }
  if (!area || !date) return { canvas: source, changes: [], skipped: 'sem área ou texto de validade' }
  if (!visible(header) || !visible(field)) return { canvas: source, changes: [], skipped: 'fundo sem vão' }
  const gapTop = bounds(header).bottom, gapBottom = bounds(field).top
  if (gapBottom - gapTop < 10) return { canvas: source, changes: [], skipped: 'fundo sem vão' }

  const canvas = structuredClone(source)
  const find = name => canvas.objects.find(o => o?.name === name)
  const pill = find('retail-validity-visual-band'), box = find('standard-validity-background'), text = find('header-validity')
  // Cor que aparece no vão: a base da campanha (retângulo de fundo) ou a moldura da página.
  const base = canvas.objects.find(o => /base de cor/i.test(String(o?.name || o?.layerName || '')) && visible(o)) || canvas.objects.find(o => o?.isFrame)
  const stripColor = String(base?.fill || '#171717')
  const color = validityTextColor(String(pill.fill || '#ffffff'), stripColor)
  const pillBox = bounds(pill), dy = gapTop - pillBox.top

  pill.visible = false
  Object.assign(box, { originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, left: pillBox.left, width: pillBox.width, top: gapTop, height: gapBottom - gapTop })
  text.top = num(text.top) + dy
  Object.assign(text, { fill: color, dynamicFieldTextColor: color, styles: {} })
  const changes = ['pílula de validade escondida', 'área da validade no vão da arte', `data na cor ${color}`]
  for (const icon of canvas.objects.filter(o => /^header-validity-calendar/.test(String(o?.name || '')))) {
    icon.top = num(icon.top) + dy
    const paint = o => {
      if (o.stroke && o.stroke !== 'transparent') o.stroke = color
      if (o.fill && o.fill !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(o.fill)) o.fill = color
      for (const child of o.objects || []) paint(child)
    }
    paint(icon)
    changes.push('calendário na cor da data')
  }
  return { canvas, changes }
}
