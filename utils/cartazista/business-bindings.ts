import type { ArtComposition } from '~/types/art-studio'
import type { BusinessProfile } from '~/utils/businessProfile'
import { applyLogoPreferenceToArt, normalizeLogoPreference } from '../logoPreference'
import { formatBrazilWhatsApp } from '~/utils/whatsapp-auth'

/** Perfil da conta atual, inclusive remoção dos valores da conta anterior. */
export function hydrateCartazistaBusiness(source: ArtComposition, profile: Pick<BusinessProfile, 'companyName'|'whatsapp'|'address'|'instagram'|'logoPreference'>, logoSrc: string, showLogo = true): ArtComposition {
  const next = structuredClone(source)
  const preference = normalizeLogoPreference(profile.logoPreference) ?? normalizeLogoPreference({})!
  for (const layer of next.layers) {
    if(layer.id==='cartaz-logo-backdrop'){layer.visible=showLogo&&!!logoSrc&&(layer.kind==='image'||preference.backdrop!=='none');continue}
    if (layer.binding === 'logo' || layer.id === 'cartaz-logo') {
      layer.binding = 'logo'
      applyLogoPreferenceToArt(layer, preference)
      layer.src = showLogo ? logoSrc : ''
      layer.visible = !!layer.src
    } else {
      const value = layer.binding === 'phone' ? formatBrazilWhatsApp(profile.whatsapp) : layer.binding === 'address' ? profile.address : layer.binding === 'instagram' ? profile.instagram : layer.binding === 'companyName' || layer.id === 'cartaz-company' ? profile.companyName : undefined
      if (value !== undefined) { layer.text = value; layer.visible = !!value }
    }
  }
  return next
}
