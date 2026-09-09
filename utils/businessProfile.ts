import {
  BUSINESS_PAYMENT_CARD_NAMES,
  BUSINESS_PAYMENT_CARD_OPTIONS,
  isBusinessPaymentCardId,
  getBusinessPaymentCardName,
} from './paymentCards'

export type BusinessEntry = {
  id: string
  label: string
  value: string
}

export type BusinessProfile = {
  companyName: string
  logo: string
  phone: string
  whatsapp: string
  whatsappNumbers: BusinessEntry[]
  address: string
  addresses: BusinessEntry[]
  instagram: string
  facebook: string
  website: string
  slogan: string
  cep: string
  hours: string
  paymentNotes: string
  paymentMethods: string[]
}

export type BusinessPaymentOption = {
  id: string
  label: string
  group: 'instant' | 'cards' | 'meal' | 'other'
  color: string
  /** Key used by the inline SVG catalog. `amex` uses `americanexpress`. */
  assetKey?: string
}

export const DEFAULT_BUSINESS_PAYMENT_METHODS = [
  'pix',
  'dinheiro',
  'visa',
  'mastercard',
  'elo'
]

export const BUSINESS_PAYMENT_OPTIONS: BusinessPaymentOption[] = [
  { id: 'pix', label: 'PIX', group: 'instant', color: '#32BCAD', assetKey: 'pix' },
  { id: 'dinheiro', label: 'Dinheiro', group: 'instant', color: '#2d6a4f', assetKey: 'dinheiro' },
  { id: 'visa', label: 'Visa', group: 'cards', color: '#1A1F71', assetKey: 'visa' },
  { id: 'mastercard', label: 'Mastercard', group: 'cards', color: '#EB001B', assetKey: 'mastercard' },
  { id: 'elo', label: 'Elo', group: 'cards', color: '#000000', assetKey: 'elo' },
  { id: 'hipercard', label: 'Hipercard', group: 'cards', color: '#822124', assetKey: 'hipercard' },
  { id: 'amex', label: 'American Express', group: 'cards', color: '#016FD0', assetKey: 'americanexpress' },
  { id: 'alelo', label: 'Alelo', group: 'meal', color: '#00965E', assetKey: 'alelo' },
  { id: 'sodexo', label: 'Sodexo', group: 'meal', color: '#ED1C24', assetKey: 'sodexo' },
  { id: 'ticket', label: 'Ticket', group: 'meal', color: '#DC0032', assetKey: 'ticket' },
  { id: 'vr', label: 'VR', group: 'meal', color: '#003399', assetKey: 'vr' },
  { id: 'greencard', label: 'GreenCard', group: 'meal', color: '#006837' },
  { id: 'ben', label: 'Ben', group: 'other', color: '#FF6900' },
  { id: 'goodcard', label: 'GoodCard', group: 'other', color: '#0066B3' },
  { id: 'cabal', label: 'Cabal', group: 'other', color: '#00529B', assetKey: 'cabal' },
  { id: 'banescard', label: 'Banescard', group: 'other', color: '#003366' }
]

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  companyName: '',
  logo: '',
  phone: '',
  whatsapp: '',
  whatsappNumbers: [],
  address: '',
  addresses: [],
  instagram: '',
  facebook: '',
  website: '',
  slogan: '',
  cep: '',
  hours: '',
  paymentNotes: '',
  paymentMethods: [...DEFAULT_BUSINESS_PAYMENT_METHODS]
}

export const normalizeBusinessText = (value: unknown, maxLength: number): string =>
  String(value ?? '').trim().slice(0, maxLength)

type BusinessEntrySource = string | Record<string, unknown>

const asEntrySources = (value: unknown): BusinessEntrySource[] => {
  if (Array.isArray(value)) return value as BusinessEntrySource[]
  if (typeof value === 'string' && value.trim()) return value.split(/\r?\n/)
  return []
}

/**
 * Normalizes repeatable WhatsApp/address values while keeping deterministic IDs.
 * Deterministic IDs avoid changing canvas bindings whenever the profile is
 * fetched again, and preserve old profiles that only had one string value.
 */
export const normalizeBusinessEntries = (
  value: unknown,
  legacyValue: unknown,
  prefix: string,
  maxLength: number,
  maxItems = 8
): BusinessEntry[] => {
  const hasExplicitValue = value !== undefined && value !== null
  const sources = hasExplicitValue ? asEntrySources(value) : asEntrySources(legacyValue)
  const seen = new Set<string>()
  const entries: BusinessEntry[] = []

  for (const source of sources) {
    const record = source && typeof source === 'object' ? source as Record<string, unknown> : null
    const entryValue = normalizeBusinessText(
      record?.value ?? record?.number ?? record?.phone ?? record?.address ?? record?.text ?? source,
      maxLength
    )
    if (!entryValue) continue

    const key = entryValue.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      id: normalizeBusinessText(record?.id, 80) || `${prefix}-${entries.length + 1}`,
      label: normalizeBusinessText(record?.label ?? record?.name ?? record?.title, 60),
      value: entryValue
    })
    if (entries.length >= maxItems) break
  }

  return entries
}

/** Máscara apenas de apresentação; não altera o número salvo nem inventa DDD. */
export const formatBrazilianBusinessPhone = (value: unknown): string => {
  const text = String(value ?? '').trim()
  if (!/^[+\d\s().-]+$/.test(text)) return text
  let digits = text.replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return text
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`
}

const formatEntries = (
  value: unknown,
  legacyValue: unknown,
  prefix: 'whatsapp' | 'address',
  maxLength: number
): string => {
  const entries = normalizeBusinessEntries(value, legacyValue, prefix, maxLength)
  // An explicit empty list means the user removed the repeatable values. Do
  // not resurrect a stale legacy string that may still be present alongside
  // the new array in older profile records.
  if (!entries.length) {
    const hasExplicitValue = value !== undefined && value !== null
    return hasExplicitValue ? '' : normalizeBusinessText(legacyValue, 1200)
  }
  return entries
    .map(entry => {
      const rawText = normalizeBusinessText(entry.value, 300)
      const text = prefix === 'whatsapp' ? formatBrazilianBusinessPhone(rawText) : rawText
      const label = normalizeBusinessText(entry.label, 60)
      // Labels are useful for repeatable WhatsApp numbers ("Delivery:") but
      // an address label is metadata, not part of the postal address. Prefixing
      // it here made values such as "Cidade: Rua ..." appear in the flyer and
      // could put the city before the actual address entered by the user.
      return text ? (prefix === 'whatsapp' && label ? `${label}: ${text}` : text) : ''
    })
    .filter(Boolean)
    .join(' · ')
}

export const formatBusinessContactValues = (value: unknown, legacyValue?: unknown): string =>
  formatEntries(value, legacyValue, 'whatsapp', 80)

export const formatBusinessAddressValues = (value: unknown, legacyValue?: unknown): string =>
  formatEntries(value, legacyValue, 'address', 300)

export const getBusinessPaymentAssetKey = (value: unknown): string => {
  const key = String(value || '').trim()
  return key === 'amex' ? 'americanexpress' : key
}

export const normalizeBusinessPaymentMethods = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [...DEFAULT_BUSINESS_PAYMENT_METHODS]
  return Array.from(new Set(value
    .map(item => normalizeBusinessText(item, 80))
    .filter(Boolean)))
    .slice(0, 128)
}

export const formatBusinessPaymentMethods = (value: unknown): string => {
  if (!Array.isArray(value)) return ''
  const labels = value
    .map(item => {
      const key = String(item || '').trim()
      if (!key) return ''
      return BUSINESS_PAYMENT_OPTIONS.find(option => option.id === key)?.label
        || (isBusinessPaymentCardId(key) ? getBusinessPaymentCardName(key) : key)
    })
    .filter(Boolean)
  return labels.join(' · ')
}

/** Shared client/server normalization for the JSONB profile contract. */
export const normalizeBusinessProfile = (value: unknown): BusinessProfile => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const whatsappNumbers = normalizeBusinessEntries(
    source.whatsappNumbers ?? source.whatsapp_numbers ?? source.whatsapps ?? source.whatsappList,
    source.whatsapp ?? source.whatsApp,
    'whatsapp',
    80
  )
  const addresses = normalizeBusinessEntries(
    source.addresses ?? source.enderecos ?? source.addressList,
    source.address,
    'address',
    300
  )
  const rawPaymentMethods = source.paymentMethods ?? source.payment_methods
  const paymentMethods = normalizeBusinessPaymentMethods(rawPaymentMethods)

  return {
    companyName: normalizeBusinessText(source.companyName ?? source.name, 160),
    logo: normalizeBusinessText(
      source.logo ??
      source.logoUrl ??
      source.logo_url ??
      source.custom_logo ??
      source.customLogo,
      2048
    ),
    phone: normalizeBusinessText(source.phone, 40),
    whatsapp: whatsappNumbers[0]?.value || normalizeBusinessText(source.whatsapp, 80),
    whatsappNumbers,
    address: addresses[0]?.value || normalizeBusinessText(source.address, 300),
    addresses,
    instagram: normalizeBusinessText(source.instagram, 120),
    facebook: normalizeBusinessText(source.facebook, 120),
    website: normalizeBusinessText(source.website, 240),
    slogan: normalizeBusinessText(source.slogan, 180),
    cep: normalizeBusinessText(source.cep, 20),
    hours: normalizeBusinessText(source.hours ?? source.openingHours, 180),
    paymentNotes: normalizeBusinessText(source.paymentNotes ?? source.payment_notes, 240),
    paymentMethods
  }
}
