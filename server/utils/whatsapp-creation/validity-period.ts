/** Conversão pura da validade escrita pelo cliente em datas; sem dependência de banco ou storage. */

const VALIDITY_MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/**
 * Converte a validade escrita pelo cliente ("06 e 07 de outubro", "06/10 a 07/10",
 * "05/10/2026", "sem validade") no mesmo estado de datas do Editor Rápido.
 * Texto ambíguo retorna null e continua literal.
 */
export function parseLiteralValidityPeriod(literal: string, today = new Date()): { startDate: string; endDate: string; mode: 'single_day' | 'date_range' } | { mode: 'while_stocks' } | null {
  const text = literal.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/^(?:ofertas?\s+validas?\s*)?(?:(?:de|do|no|nos|dia|dias|valid[ao]s?)\s+)*/, '').replace(/[.!]$/, '').trim()
  if (!text) return null
  if (/^(?:sem validade|enquanto durarem os estoques)$/.test(text)) return { mode: 'while_stocks' }
  const sp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today)
  const [currentYear, currentMonth, currentDay] = sp.split('-').map(Number) as [number, number, number]
  const toIso = (day: number, month: number, year?: number): string | null => {
    let resolvedYear = year === undefined ? currentYear : year < 100 ? 2000 + year : year
    // Sem ano informado, uma data muito no passado se refere ao próximo ano (ex.: em dezembro, "05/01").
    if (year === undefined && Date.UTC(resolvedYear, month - 1, day) < Date.UTC(currentYear, currentMonth - 1, currentDay) - 60 * 86_400_000) resolvedYear++
    const date = new Date(Date.UTC(resolvedYear, month - 1, day))
    if (date.getUTCFullYear() !== resolvedYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    return date.toISOString().slice(0, 10)
  }
  const period = (start: string | null, end: string | null) => {
    if (!start || !end || end < start) return null
    return start === end ? { startDate: start, endDate: end, mode: 'single_day' as const } : { startDate: start, endDate: end, mode: 'date_range' as const }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) { const date = toIso(Number(iso[3]), Number(iso[2]), Number(iso[1])); return period(date, date) }
  const connector = '\\s*(?:a|ate|e|-|–)\\s*'
  const numeric = '(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2}|\\d{4}))?'
  const numericRange = new RegExp(`^${numeric}(?:${connector}${numeric})?$`).exec(text)
  if (numericRange) {
    const endYear = numericRange[6] ? Number(numericRange[6]) : undefined
    const start = toIso(Number(numericRange[1]), Number(numericRange[2]), numericRange[3] ? Number(numericRange[3]) : endYear)
    const end = numericRange[4] ? toIso(Number(numericRange[4]), Number(numericRange[5]), endYear) : start
    return period(start, end)
  }
  const month = `(${VALIDITY_MONTHS.join('|')})`
  const textual = new RegExp(`^(\\d{1,2})(?:\\s+de\\s+${month}(?:\\s+de\\s+(\\d{4}))?)?(?:${connector}(\\d{1,2}))?\\s+de\\s+${month}(?:\\s+de\\s+(\\d{4}))?$`).exec(text)
  if (textual) {
    const endMonth = VALIDITY_MONTHS.indexOf(textual[5]!) + 1
    const endYear = textual[6] ? Number(textual[6]) : undefined
    const startMonth = textual[2] ? VALIDITY_MONTHS.indexOf(textual[2]) + 1 : endMonth
    // Um único dia ("6 de outubro") ou intervalo ("06 e 07 de outubro", "30 de setembro a 2 de outubro").
    if (!textual[4] && textual[2]) return null
    const start = toIso(Number(textual[1]), startMonth, textual[3] ? Number(textual[3]) : endYear)
    const end = textual[4] ? toIso(Number(textual[4]), endMonth, endYear) : start
    return period(start, end)
  }
  return null
}
