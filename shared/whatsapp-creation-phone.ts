import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

/** Return the exact Brazilian WhatsApp number plus its mobile 9-digit variant, if applicable. */
export function getBrazilWhatsAppPhoneCandidates(value: unknown): string[] {
  const normalized = normalizeBrazilWhatsApp(value)
  if (!normalized) return []

  const nationalNumber = normalized.slice(3)
  const areaCode = nationalNumber.slice(0, 2)
  const subscriber = nationalNumber.slice(2)
  let variant: string | null = null

  if (/^[6-9]\d{7}$/.test(subscriber)) {
    variant = `+55${areaCode}9${subscriber}`
  } else if (/^9[6-9]\d{7}$/.test(subscriber)) {
    variant = `+55${areaCode}${subscriber.slice(1)}`
  }

  return variant && variant !== normalized ? [normalized, variant] : [normalized]
}
