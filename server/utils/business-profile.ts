import { pgQuery } from './postgres'
import {
  EMPTY_BUSINESS_PROFILE,
  normalizeBusinessProfile as normalizeSharedBusinessProfile,
  type BusinessProfile,
} from '../../utils/businessProfile'

export { EMPTY_BUSINESS_PROFILE }

let businessProfileColumnEnsured = false

export const ensureBusinessProfileColumn = async (): Promise<void> => {
  if (businessProfileColumnEnsured) return

  await pgQuery(`
    alter table public.profiles
      add column if not exists business_profile jsonb not null default '{}'::jsonb
  `)
  businessProfileColumnEnsured = true
}

export const normalizeBusinessProfile = (value: unknown): BusinessProfile =>
  normalizeSharedBusinessProfile(value)

export const mergeBusinessProfile = (current: unknown, incoming: unknown): BusinessProfile => {
  const currentProfile = normalizeBusinessProfile(current)
  const currentSource = current && typeof current === 'object'
    ? current as Record<string, unknown>
    : {}
  const incomingSource = incoming && typeof incoming === 'object'
    ? incoming as Record<string, unknown>
    : {}
  const next = { ...currentProfile, ...incomingSource } as Record<string, unknown>

  // Older callers still send one string. Promote that patch to the repeatable
  // shape so editing the first value never gets overwritten by stale arrays.
  const hasWhatsappList = ['whatsappNumbers', 'whatsapp_numbers', 'whatsapps', 'whatsappList']
    .some(key => Object.prototype.hasOwnProperty.call(incomingSource, key))
  if (!hasWhatsappList && Object.prototype.hasOwnProperty.call(incomingSource, 'whatsapp')) {
    const value = String(incomingSource.whatsapp ?? '').trim()
    next.whatsappNumbers = value
      ? [{ id: currentProfile.whatsappNumbers[0]?.id || 'whatsapp-1', value }]
      : []
  }

  const hasAddressList = ['addresses', 'enderecos', 'addressList']
    .some(key => Object.prototype.hasOwnProperty.call(incomingSource, key))
  if (!hasAddressList && Object.prototype.hasOwnProperty.call(incomingSource, 'address')) {
    const value = String(incomingSource.address ?? '').trim()
    next.addresses = value
      ? [{ id: currentProfile.addresses[0]?.id || 'address-1', value }]
      : []
  }

  // `normalizeBusinessProfile` supplies useful default card brands for old
  // screens, but the quick-editor must know whether the store owner actually
  // chose them. Keep that distinction in the persisted profile so a theme
  // with payment logos can ask the owner instead of silently assuming it.
  const paymentMethodsWereProvided = ['paymentMethods', 'payment_methods']
    .some(key => Object.prototype.hasOwnProperty.call(incomingSource, key))
  const legacyProfileHadPaymentMethods = ['paymentMethods', 'payment_methods']
    .some(key => Object.prototype.hasOwnProperty.call(currentSource, key))
  const paymentMethodsConfigured = paymentMethodsWereProvided
    || currentSource.__paymentMethodsConfigured === true
    || (currentSource.__paymentMethodsConfigured === undefined && legacyProfileHadPaymentMethods)

  return {
    ...normalizeBusinessProfile(next),
    __paymentMethodsConfigured: paymentMethodsConfigured
  } as BusinessProfile
}
