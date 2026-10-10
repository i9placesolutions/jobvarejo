// Troca a etiqueta de preço das zonas de produto de um modelo (mesmos campos que o editor grava ao aplicar
// uma etiqueta na zona) e atualiza a biblioteca de etiquetas embutida no JSON com as versões do banco.
// A biblioteca embutida tem prioridade sobre a zona no app e no renderizador; cópias antigas recoloridas
// faziam etiquetas diferentes saírem todas escuras.

// Etiquetas de preço único aprovadas para variar, por família de cor do modelo (sem as de tema específico,
// atacarejo/fardo e sem "Mês da Economia", reprovada pelo usuário em 10/10/2026).
export const LABEL_POOL = {
  red: ['tpl_economia_venha_economia', 'tpl_economia_preco_aqui', 'h1zcro9bo', 'tpl_default'],
  orange: ['tpl_economia_semana_imbativel', 'tpl_economia_venha_economia', 'tpl_economia_preco_aqui', 'h1zcro9bo'],
  yellow: ['tpl_economia_venha_economia', 'tpl_economia_preco_aqui', 'tpl_black_yellow', 'h1zcro9bo'],
  green: ['tpl_economia_economizar_verdade', 'tpl_economia_oferta_dia', 'tpl_economia_carrinho_cheio'],
  blue: ['tpl_segunda_limpeza_20260927', 'tpl_economia_preco_todo_dia', 'tpl_default'],
  purple: ['tpl_default', 'tpl_economia_preco_todo_dia', 'h1zcro9bo'],
  dark: ['tpl_barlow_black', 'nz2bk9f8m', 'tpl_black_yellow', 'tpl_default'],
  light: ['tpl_economia_venha_economia', 'tpl_segunda_limpeza_20260927', 'tpl_economia_preco_aqui', 'tpl_default']
}

const rgb = hex => { const n = parseInt(String(hex || '#000000').replace('#', '').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }

/** Família de cor a partir da cor base (e da de destaque quando a base é clara demais ou escura com destaque frio). */
export function colorFamily(base, accent) {
  const pick = hex => {
    const [r, g, b] = rgb(hex).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
    if (l < .16 || (d < .12 && l < .5)) return 'dark'
    if (d < .12) return 'light'
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h = (h * 60 + 360) % 360
    if (h < 18 || h >= 330) return 'red'
    if (h < 40) return 'orange'
    if (h < 70) return 'yellow'
    if (h < 170) return 'green'
    if (h < 255) return 'blue'
    return 'purple'
  }
  const family = pick(base), second = accent ? pick(accent) : null
  if (family === 'light' && second) return second === 'light' ? 'light' : second
  // Base escura com destaque frio (neon verde/azul/roxo) segue o destaque; dourado/vermelho fica no escuro.
  if (family === 'dark' && ['green', 'blue', 'purple'].includes(second)) return second
  return family
}

const STYLE_KEYS = ['splashColor', 'splashFill', 'splashTextColor', 'priceTextColor', 'priceCurrencyColor', 'priceFont', 'priceFontStyle', 'priceFontWeight', 'priceFontSize', 'splashStyle']

/** Aplica a etiqueta `label` ({ key, name, kind, group }) em todas as zonas do canvas; `library` = etiquetas do banco. */
export function applyLabel(canvas, label, library = []) {
  const out = structuredClone(canvas), changes = []
  const fill = name => (label.group?.objects || []).find(o => o.name === name)?.fill
  // Cores da zona = cores da própria etiqueta (o card recolore a etiqueta com elas).
  const own = Object.fromEntries(Object.entries({
    splashFill: fill('price_bg'), splashColor: fill('price-rim') || fill('price_bg'), accentColor: fill('price-rim') || fill('price_bg'),
    priceTextColor: fill('price_value_text'), priceCurrencyColor: fill('price_currency_text'), splashTextColor: fill('price_unit_text')
  }).filter(([, v]) => typeof v === 'string'))
  const strip = g => Object.fromEntries(Object.entries(g || {}).filter(([k]) => !STYLE_KEYS.includes(k)))
  for (const zone of out.objects || []) {
    if (!zone?.isProductZone && !zone?.isGridZone) continue
    const before = String(zone._zoneGlobalStyles?.splashTemplateId || zone._zoneTemplateSnapshotId || '')
    zone._zoneTemplateSnapshotId = label.key
    zone._zoneTemplateSnapshot = structuredClone(label.group)
    zone._zoneGlobalStyles = { ...strip(zone._zoneGlobalStyles), ...own, splashTemplateId: label.key }
    if (zone._zoneStateSnapshot) {
      zone._zoneStateSnapshot.labelTemplate = { id: label.key, name: label.name, kind: label.kind, group: structuredClone(label.group), snapshot: structuredClone(label.group) }
      zone._zoneStateSnapshot.globalStyles = { ...strip(zone._zoneStateSnapshot.globalStyles), ...own, splashTemplateId: label.key }
    }
    changes.push(`etiqueta ${before || '(nenhuma)'} → ${label.key}`)
  }
  if (changes.length) {
    // Biblioteca embutida: versões do banco para as etiquetas conhecidas, e a etiqueta nova presente.
    const lib = Array.isArray(out.__labelTemplates) ? out.__labelTemplates : []
    out.__labelTemplates = lib.map(t => { const db = library.find(x => x.key === t.id); return db ? { ...t, name: db.name, group: structuredClone(db.group) } : t })
    if (!out.__labelTemplates.some(t => t.id === label.key)) out.__labelTemplates.push({ id: label.key, name: label.name, kind: label.kind, group: structuredClone(label.group) })
  }
  return { canvas: out, changes }
}
