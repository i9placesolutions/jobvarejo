import { describe, it, expect } from 'vitest'
import { normalizeBusinessProfile } from '../../utils/businessProfile'
import { mergeBusinessProfile } from '../../server/utils/business-profile'
import { normalizeLogoPreference, applyLogoPreferenceToFabric, logoPreferenceFromFabric, applyLogoPreferenceToArt } from '../../utils/logoPreference'
import { artLogoOptions } from '../../utils/art-studio/logo'

describe('account logo preference', () => {
  it('distinguishes no preference from explicitly disabling template effects', () => {
    expect(normalizeLogoPreference(undefined)).toBeNull()
    const logo = { quickLogoBackdropMode: 'round', __stickerOutlineEnabled: true, stroke: '#ff0000', strokeWidth: 8 }
    expect(applyLogoPreferenceToFabric(logo, null)).toBe(false)
    applyLogoPreferenceToFabric(logo, { backdrop: 'none', outline: false, border: false })
    expect(logo).toMatchObject({ quickLogoBackdropMode: 'none', __stickerOutlineEnabled: false, stroke: null, strokeWidth: 0 })
  })
  it('survives profile normalization, contact edits and logo replacement', () => {
    const preference = normalizeLogoPreference({ backdrop: 'oval', outline: true, outlineColor: '#123456', outlineWidth: 9, border: true, borderWidth: 3 })!
    const current = normalizeBusinessProfile({ logo: 'logo/a.png', logoPreference: preference })
    const next = mergeBusinessProfile(current, { logo: 'logo/b.png', address: 'Rua Nova' })
    expect(next.logoPreference).toEqual(preference)
    const replacement = { type: 'image' }
    applyLogoPreferenceToFabric(replacement, next.logoPreference)
    expect(logoPreferenceFromFabric(replacement)).toEqual(preference)
    expect(applyLogoPreferenceToFabric(replacement, next.logoPreference)).toBe(false)
  })
  it('keeps decorative images and seals unchanged in Art Studio', () => {
    const p = normalizeLogoPreference({ backdrop: 'round', outline: true, outlineWidth: 7 })!
    const seal: any = { binding: '', width: 300, height: 200, logoOutline: false }
    applyLogoPreferenceToArt(seal, p)
    expect(seal.logoOutline).toBe(false)
    expect(artLogoOptions(seal, p).outline).toBe(false)
    const logo: any = { ...seal, binding: 'logo' }
    applyLogoPreferenceToArt(logo, p)
    expect(artLogoOptions(logo, p)).toMatchObject({ backdrop: 'round', outline: true, outlineWidth: 7 })
  })
  it('bounds effect values and rejects malformed colors', () => {
    expect(normalizeLogoPreference({ outlineWidth: 500, outlineOpacity: -3, outlineColor: 'url(x)', borderWidth: -7 })).toMatchObject({ outlineWidth: 40, outlineOpacity: 0, outlineColor: '#ffffff', borderWidth: 0 })
  })
})
