/** Extrai somente uma restrição explícita, sem confundir peso ou quantidade da embalagem. */
export const extractPurchaseLimit = (raw: string): { limit: string | null; rest: string } => {
  const unit = '(unidades?|unid\\.?|und\\.?|un\\.?|kg|quilos?|pct|pacotes?|cx|caixas?|fd|fardos?)'
  const target = '(cliente|pessoa|cpf)'
  const quantity = '(\\d{1,3}(?:[,.]\\d{1,3})?)'
  const patterns = [
    new RegExp(`\\b(?:limite|limte|lim\\.?|limitad[oa](?:\\s+a)?|m[aá]ximo|max\\.?)\\s*:?\\s*${quantity}\\s*${unit}?(?![\\w,.])(?:\\s+por\\s+${target}\\b)?`, 'i'),
    new RegExp(`\\b(?:at[eé]\\s+)?${quantity}\\s*${unit}?\\s+por\\s+${target}\\b`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(raw)
    if (!match) continue
    const qty = Number(match[1]!.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) continue
    const unitRaw = (match[2] || 'UN').toUpperCase()
    const normalizedUnit = /^(KG|QUILO)/.test(unitRaw) ? 'KG'
      : /^(PCT|PACOTE)/.test(unitRaw) ? 'PCT'
      : /^(CX|CAIXA)/.test(unitRaw) ? 'CX'
      : /^(FD|FARDO)/.test(unitRaw) ? 'FD' : 'UN'
    let start = match.index
    let end = start + match[0].length
    // Remove os parênteses apenas se envolverem exatamente a restrição.
    const before = raw.slice(0, start).match(/\(\s*$/)
    const after = raw.slice(end).match(/^\s*\)/)
    if (before && after) { start -= before[0].length; end += after[0].length }
    return {
      limit: `LIMITE ${String(qty).replace('.', ',')} ${normalizedUnit} POR ${(match[3] || 'CLIENTE').toUpperCase()}`,
      rest: `${raw.slice(0, start)} ${raw.slice(end)}`.replace(/\s+/g, ' ').trim().replace(/\s*[-–—|:]\s*$/, '').trim(),
    }
  }
  return { limit: null, rest: raw }
}
