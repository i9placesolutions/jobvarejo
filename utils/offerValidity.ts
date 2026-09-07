export type OfferScopeMode = 'all' | 'city_only' | 'city' | 'store'

/** Forma como o período de validade será exibido no encarte. */
export type OfferValidityMode = 'single_day' | 'date_range' | 'while_stocks'

export type OfferValidityScope = {
  mode: OfferScopeMode
  city: string
  state: string
  storeName: string
}

export const DEFAULT_OFFER_VALIDITY_SCOPE: OfferValidityScope = {
  mode: 'all',
  city: '',
  state: '',
  storeName: '',
}

export const DEFAULT_OFFER_VALIDITY_MODE: OfferValidityMode = 'while_stocks'

const normalizeText = (value: unknown, maxLength: number): string =>
  String(value ?? '').trim().slice(0, maxLength)

export const normalizeOfferValidityMode = (value: unknown): OfferValidityMode => {
  const raw = String(value ?? '').trim().toLocaleLowerCase('pt-BR').replace(/[\s-]+/g, '_')
  if (raw === 'single_day' || raw === 'single' || raw === 'day' || raw === 'one_day' || raw === '1_day') {
    return 'single_day'
  }
  if (raw === 'date_range' || raw === 'range' || raw === 'period' || raw === 'between_dates') {
    return 'date_range'
  }
  if (
    raw === 'while_stocks' ||
    raw === 'while_stock' ||
    raw === 'stocks' ||
    raw === 'stock' ||
    raw === 'until_stock' ||
    raw === 'until_stocks'
  ) {
    return 'while_stocks'
  }
  return DEFAULT_OFFER_VALIDITY_MODE
}

export const inferOfferValidityMode = (startDate: unknown, endDate: unknown): OfferValidityMode => {
  const start = String(startDate ?? '').trim()
  const end = String(endDate ?? '').trim()
  if (!start && !end) return DEFAULT_OFFER_VALIDITY_MODE
  if (start && end && start === end) return 'single_day'
  return 'date_range'
}

export const normalizeOfferValidityScope = (value: unknown): OfferValidityScope => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawMode = String(source.mode || '').trim().toLocaleLowerCase('pt-BR')
  const mode = rawMode === 'city_only' || rawMode === 'city-only' || rawMode === 'cityonly'
    ? 'city_only'
    : rawMode === 'city'
      ? 'city'
      : rawMode === 'store' || rawMode === 'branch'
        ? 'store'
        : 'all'
  return {
    mode,
    city: normalizeText(source.city ?? source.municipality, 100),
    state: normalizeText(source.state ?? source.uf, 2).toLocaleUpperCase('pt-BR'),
    storeName: normalizeText(source.storeName ?? source.store ?? source.branch, 140),
  }
}

const formatPlace = (scope: OfferValidityScope): string => {
  const city = scope.city
  const state = scope.state
  if (!city) return ''
  return `${city}${state ? ` - ${state}` : ''}`
}

/**
 * Builds the sentence printed in the offer validity field. Empty required
 * fields intentionally produce no suffix so an incomplete configuration is
 * never exported as a misleading commercial promise.
 */
export const formatOfferValidityScope = (value: unknown): string => {
  const scope = normalizeOfferValidityScope(value)
  const place = formatPlace(scope)
  if (scope.mode === 'city_only') {
    return place ? `Oferta válida somente em ${place}` : ''
  }
  if (scope.mode === 'city') {
    return place ? `Oferta válida em todas as lojas de ${place}` : ''
  }
  if (scope.mode === 'store') {
    if (!scope.storeName || !place) return ''
    return `Oferta válida somente na loja ${scope.storeName} em ${place}`
  }
  return ''
}

export const formatOfferValidity = (
  startDate: unknown,
  endDate: unknown,
  scope: unknown = DEFAULT_OFFER_VALIDITY_SCOPE,
  mode?: unknown,
  whileStocks = false
): string => {
  const start = String(startDate || '').trim()
  const end = String(endDate || '').trim()
  const hasExplicitMode = mode !== undefined && mode !== null && String(mode).trim() !== ''
  // Keep the legacy three-argument helper's range behavior. New callers that
  // need the single-day or stock-limited wording pass the mode explicitly.
  const resolvedMode = hasExplicitMode ? normalizeOfferValidityMode(mode) : 'date_range'
  const dates = resolvedMode === 'while_stocks' && hasExplicitMode
    ? 'Ofertas válidas enquanto durarem os estoques'
    : resolvedMode === 'single_day'
      ? (start || end
          ? `Oferta válida somente em ${start || end}${whileStocks ? ' e enquanto durarem os estoques' : ''}`
          : '')
      : start && end
        ? `Ofertas válidas de ${formatOfferDateInterval(start, end)}${whileStocks ? ' e enquanto durarem os estoques' : ''}`
        : start
          ? `Ofertas válidas a partir de ${start}${whileStocks ? ' e enquanto durarem os estoques' : ''}`
          : end
            ? `Ofertas válidas até ${end}${whileStocks ? ' e enquanto durarem os estoques' : ''}`
            : ''
  const location = formatOfferValidityScope(scope)
  return [dates, location].filter(Boolean).join(' · ')
}

export const formatOfferValidityPeriod = (
  startDate: unknown,
  endDate: unknown,
  mode: unknown = DEFAULT_OFFER_VALIDITY_MODE,
  whileStocks = false
): string => formatOfferValidity(startDate, endDate, DEFAULT_OFFER_VALIDITY_SCOPE, mode, whileStocks)

export type OfferDateFormat = 'numeric' | 'long' | 'hidden'
export const normalizeOfferDateFormat = (value: unknown): OfferDateFormat => value === 'long' || value === 'hidden' ? value : 'numeric'
export const formatOfferDate = (value: unknown, format: OfferDateFormat = 'numeric'): string => {
  if (format === 'hidden') return ''
  const raw = String(value || '').trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!iso && !br) return raw
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : [br![3], br![2], br![1]]
  if (format === 'numeric') return `${day}/${month}/${year}`
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const name = months[Number(month) - 1]
  return name ? `${day} de ${name} de ${year}` : raw
}

/** Inclui o fundo/ícone quando pertencem ao mesmo grupo exclusivo da validade. */
export const getOfferValidityVisibilityTarget = (text: any): any => {
  let target = text
  let parent = text?.group
  while (parent && !parent.isFrame && !parent.isProductZone && typeof parent.getObjects === 'function') {
    const leaves: any[] = []
    const walk = (object: any) => typeof object.getObjects === 'function' ? object.getObjects().forEach(walk) : leaves.push(object)
    parent.getObjects().forEach(walk)
    const texts = leaves.filter(object => String(object.type || '').toLowerCase().includes('text'))
    if (!texts.length || texts.some(object => object !== text && object.quickDataField !== 'validity' && object.businessProfileField !== 'validity')) break
    target = parent
    parent = parent.group
  }
  return target
}

/** Compacta datas por extenso já formatadas, mantendo intervalos numéricos legados. */
export const formatOfferDateInterval = (start: string, end: string): string => {
  const pattern = /^(\d{2}) de ([a-zç]+) de (\d{4})$/i
  const first = start.match(pattern)
  const last = end.match(pattern)
  if (!first || !last) return `${start} a ${end}`
  const [, startDay, startMonth, startYear] = first
  const [, endDay, endMonth, endYear] = last
  if (startYear !== endYear) return `${start} a ${end}`
  if (startMonth === endMonth) return `${startDay} a ${endDay} de ${endMonth} de ${endYear}`
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const month = months.indexOf(startMonth!.toLowerCase()) + 1
  if (!month) return `${start} a ${end}`
  return `${startDay}/${String(month).padStart(2, '0')} a ${endDay} de ${endMonth}`
}
