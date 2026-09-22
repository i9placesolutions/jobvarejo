import type { ArtComposition } from '~/types/art-studio'
import type { BusinessProfile } from '~/utils/businessProfile'

/** Perfil da conta atual, inclusive remoção dos valores da conta anterior. */
export function hydrateCartazistaBusiness(source: ArtComposition, profile: Pick<BusinessProfile, 'companyName'|'whatsapp'|'address'|'instagram'>, logoSrc: string, showLogo = true): ArtComposition {
  const next = structuredClone(source)
  for (const layer of next.layers) {
    if (layer.binding === 'logo' || layer.id === 'cartaz-logo') {
      layer.src = showLogo ? logoSrc : ''
      layer.visible = !!layer.src
    } else {
      const value = layer.binding === 'phone' ? profile.whatsapp : layer.binding === 'address' ? profile.address : layer.binding === 'instagram' ? profile.instagram : layer.binding === 'companyName' || layer.id === 'cartaz-company' ? profile.companyName : undefined
      if (value !== undefined) { layer.text = value; layer.visible = !!value }
    }
  }
  return next
}
