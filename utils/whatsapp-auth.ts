/** Canonical E.164 representation for Brazilian WhatsApp login numbers. */
export const normalizeBrazilWhatsApp = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return ''

  const digits = raw.replace(/\D/g, '')
  const hasPlus = raw.startsWith('+')
  let nationalNumber = digits

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    nationalNumber = digits.slice(2)
  } else if (hasPlus) {
    return ''
  }

  if (!/^\d{10,11}$/.test(nationalNumber)) return ''
  const areaCode = Number(nationalNumber.slice(0, 2))
  if (areaCode < 11 || areaCode > 99) return ''

  return `+55${nationalNumber}`
}

/** Formats a Brazilian number as (DD) 99999-9999 while the user types. */
export const formatBrazilWhatsApp = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '')
  let nationalNumber = digits

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    nationalNumber = digits.slice(2)
  }

  const truncated = nationalNumber.slice(0, 11)
  if (!truncated) return ''
  if (truncated.length <= 2) return `(${truncated}`

  const areaCode = truncated.slice(0, 2)
  const subscriber = truncated.slice(2)
  const subscriberPrefixLength = truncated.length === 11 ? 5 : 4

  if (subscriber.length <= subscriberPrefixLength) {
    return `(${areaCode}) ${subscriber}`
  }

  return `(${areaCode}) ${subscriber.slice(0, subscriberPrefixLength)}-${subscriber.slice(subscriberPrefixLength)}`
}
