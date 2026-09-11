import type { ArtLayer } from '~/types/art-studio'
export const hasArtLogoTreatment = (layer: ArtLayer) =>
  layer.binding === 'logo' ||
  layer.autoTrim === true ||
  !!layer.logoBackdrop ||
  layer.logoOutline === true
export const artLogoOptions = (layer: ArtLayer) => ({
  width: Math.max(1, Math.round(layer.width)),
  height: Math.max(1, Math.round(layer.height)),
  trim: layer.autoTrim !== false,
  backdrop: layer.logoBackdrop || 'none',
  padding: layer.logoPadding ?? 12,
  outline: layer.logoOutline === true,
  outlineColor: layer.logoOutlineColor || '#ffffff',
  outlineWidth: layer.logoOutlineWidth ?? 4
})
export const artLayerImageSrc = (layer: ArtLayer) => {
  if (!layer.src || !hasArtLogoTreatment(layer)) return layer.src || ''
  const source =
    layer.src === '/api/art-studio/brand-logo'
      ? 'brand'
      : layer.src.split('/').pop() || ''
  const options = artLogoOptions(layer)
  return `/api/art-studio/image-view?${new URLSearchParams({
    v: '3', source, ...Object.fromEntries(Object.entries(options).map(([k, v]) => [k, String(v)])) })}`
}
