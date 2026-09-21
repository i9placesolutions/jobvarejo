/** Duas linhas da faixa inclinada, preservando o período real do modelo. */
export const referenceValidityCopy = (value: { startDate?: string; endDate?: string; mode?: string; whileStocks?: boolean }) => {
  const parse = (raw?: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw || '')
    if (!match) return null
    const [, year, month, day] = match
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
      ? { label: `${day}/${month}/${year}`, date } : null
  }
  const start = parse(value.startDate), end = parse(value.endDate)
  if (value.mode === 'while_stocks') return { heading: 'OFERTAS VÁLIDAS', period: 'ENQUANTO DURAREM OS ESTOQUES', stock: '' }
  if (!start && !end) return { heading: '', period: '', stock: '' }
  const single = value.mode === 'single_day' || !start || !end || value.startDate === value.endDate
  const day = (start || end)!
  const weekday = day.date.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase().replace('-FEIRA', '')
  const heading = single ? `OFERTA VÁLIDA SOMENTE ${weekday === 'SÁBADO' || weekday === 'DOMINGO' ? 'NESTE' : 'NESTA'} ${weekday}` : 'OFERTAS VÁLIDAS NESTE PERÍODO'
  const period = single ? day.label : `${start!.label} A ${end!.label}`
  return { heading, period: period + (value.whileStocks !== false ? ' OU ENQUANTO DURAREM OS ESTOQUES' : ''), stock: '' }
}
