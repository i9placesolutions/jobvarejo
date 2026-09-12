/** A validade em três linhas mantém a composição do modelo ao trocar as datas. */
export const isSplitFooterValidity = (object: any): boolean =>
  object?.quickValidityLayout === 'split-footer' ||
  (object?.name === 'dynamic-validity' && object?.quickDataField === 'validity')

export const splitFooterValidityText = (value: { startDate?: string; endDate?: string; mode?: string; whileStocks?: boolean }) => {
  const parse = (raw?: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || ''))
    if (!match) return null
    const [, year, month, day] = match
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
      ? { year, month, day: Number(day), label: date.toLocaleString('pt-BR', { month: 'long' }).toUpperCase() } : null
  }
  const start = parse(value.startDate), end = parse(value.endDate)
  const full = (date: NonNullable<typeof start>, year = false) => `${date.day} DE ${date.label}${year ? ` DE ${date.year}` : ''}`
  const stocksOnly = value.mode === 'while_stocks'
  let period = ''
  if (stocksOnly) period = 'ENQUANTO DURAREM OS ESTOQUES'
  else if (start && end && value.mode !== 'single_day' && value.startDate !== value.endDate) {
    period = start.year === end.year && start.month === end.month
      ? `${start.day} A ${full(end)}`
      : `${full(start, start.year !== end.year)} A ${full(end, start.year !== end.year)}`
  } else if (start || end) period = full((start || end)!)
  return { heading: stocksOnly ? 'OFERTA VÁLIDA' : 'OFERTA VÁLIDA DE', period,
    stock: !stocksOnly && value.whileStocks !== false ? 'OU ENQUANTO DURAREM OS ESTOQUES' : '' }
}

/** Modelos antigos podem ter só o período, sem os outros dois objetos. */
export const hasSplitFooterValidityCompanions = (object: any, siblings: any[]): boolean =>
  ['validity-heading', 'stock-validity'].every(name => siblings.some(sibling =>
    sibling?.name === name && sibling.parentFrameId === object?.parentFrameId
  ))

export const resolveSplitFooterValidityText = (
  object: any,
  siblings: any[],
  value: Parameters<typeof splitFooterValidityText>[0]
): string => {
  const copy = splitFooterValidityText(value)
  if (!copy.period) return ''
  return hasSplitFooterValidityCompanions(object, siblings)
    ? copy.period
    : [copy.heading, copy.period, copy.stock].filter(Boolean).join('\n')
}
