import { normalizeLogoPreference, type LogoPreference } from '../logoPreference'
import type { ArtLayer } from '~/types/art-studio'
export const hasArtLogoTreatment = (layer: ArtLayer) =>
  layer.binding === 'logo' ||
  layer.autoTrim === true ||
  !!layer.logoBackdrop ||
  layer.logoOutline === true
export const artLogoOptions = (layer: ArtLayer, preference?: LogoPreference | null) => ({
  width: Math.max(1, Math.round(layer.width)),
  height: Math.max(1, Math.round(layer.height)),
  trim: true,
  backdrop: layer.logoBackdrop || 'none',
  padding: layer.logoPadding ?? 12,
  outline: layer.logoOutline === true,
  outlineColor: layer.logoOutlineColor || '#ffffff',
  outlineWidth: layer.logoOutlineWidth ?? 4,
  ...(layer.binding === 'logo' ? normalizeLogoPreference(preference) : null)
})
export const artLayerImageSrc = (layer: ArtLayer, preference?: LogoPreference | null) => {
  if (!layer.src || !hasArtLogoTreatment(layer)) return layer.src || ''
  const source =
    layer.src === '/api/art-studio/brand-logo'
      ? 'brand'
      : layer.src.split('/').pop() || ''
  const options = artLogoOptions(layer, preference)
  return `/api/art-studio/image-view?${new URLSearchParams({
    v: '5', source, binding: layer.binding === 'logo' ? 'logo' : '', ...Object.fromEntries(Object.entries(options).map(([k, v]) => [k, String(v)])) })}`
}
