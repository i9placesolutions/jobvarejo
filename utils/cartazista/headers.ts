import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import type { CartazistaHeader } from '~/types/cartazista'
import { fitReferenceHeader, projectReferenceArtworkBox } from '~/shared/retail-reference-artwork'

export const CARTAZISTA_CAMPAIGN_MODELS = ['landscape', 'leve-3-2', 'leve-x-y', 'leve-por-legacy']

/** A campanha ocupa apenas o cabeçalho; o corpo pertence ao Cartazista. */
export function applyCartazistaHeader(source: ArtComposition, header?: CartazistaHeader): ArtComposition {
  if (!header) return source
  const next: ArtComposition = JSON.parse(JSON.stringify(source))
  next.layers = next.layers.filter(l => !['cartaz-header-brush', 'cartaz-offer-label', 'cartaz-logo-backdrop', 'cartaz-reference-instagram'].includes(l.id) && !l.id.startsWith('cartaz-campaign-'))
  const w = next.width, h = next.height, banner = w / h > 2
  if (header.referenceArtwork) {
    const artwork = header.referenceArtwork
    const bounds = { x: 0, y: 0, width: banner ? w * .125 : w, height: banner ? h : h * .19 }
    const crop = fitReferenceHeader(bounds, artwork)
    const base = { rotation: 0, opacity: 1, visible: true, locked: false, fill: header.color }
    const project = (id: string, name: string, normalized: readonly [number, number, number, number], fill: string): ArtLayer => {
      const box = projectReferenceArtworkBox(crop, artwork, normalized)
      return { ...base, id, name, kind: 'shape', shape: 'rect', x: box.x, y: box.y, width: box.width, height: box.height, fill }
    }
    const layers: ArtLayer[] = [
      { ...base, id: 'cartaz-campaign-reference-artwork', name: `Referência · ${header.name}`, kind: 'image', x: crop.x, y: crop.y, width: crop.width, height: crop.height, fill: header.color, src: artwork.src, fit: 'cover', cropX: .5, cropY: 0 },
      project('cartaz-campaign-reference-logo-mask', 'Máscara nativa da logo', artwork.logoMask, artwork.colors.logo),
      project('cartaz-campaign-reference-social-mask', 'Máscara nativa das redes sociais', artwork.socialMask, artwork.colors.social)
    ]
    for (const [index, mask] of (artwork.additionalMasks || []).entries()) {
      layers.push(project(`cartaz-campaign-reference-mask-${index + 1}`, `Máscara nativa adicional ${index + 1}`, mask.box, mask.color))
    }
    const logoBox = projectReferenceArtworkBox(crop, artwork, artwork.logoBox)
    const logo = next.layers.find(layer => layer.id === 'cartaz-logo')
    if (logo) Object.assign(logo, { x: logoBox.x, y: logoBox.y, width: logoBox.width, height: logoBox.height, fill: artwork.colors.logo, src: '', binding: 'logo', fit: 'contain', autoTrim: true, visible: true, locked: false })
    else layers.push({ ...base, id: 'cartaz-logo', name: 'Logo da loja', kind: 'image', x: logoBox.x, y: logoBox.y, width: logoBox.width, height: logoBox.height, fill: artwork.colors.logo, src: '', binding: 'logo', fit: 'contain', autoTrim: true })
    const instagramBox = projectReferenceArtworkBox(crop, artwork, artwork.instagramBox)
    layers.push({ ...base, id: 'cartaz-reference-instagram', name: 'Instagram da loja', kind: 'text', x: instagramBox.x, y: instagramBox.y, width: instagramBox.width, height: instagramBox.height, fill: artwork.colors.logoText, text: '', binding: 'instagram', fontFamily: 'Barlow Condensed', fontSize: instagramBox.height * .78, fontWeight: 800, align: 'center' })
    next.layers.unshift(...layers)
    return next
  }
  const base = { x: 0, y: 0, width: banner ? w * .125 : w, height: banner ? h : h * .19, rotation: 0, opacity: 1, visible: true, locked: false, fill: header.color }
  const layers: ArtLayer[] = [{ ...base, id: 'cartaz-campaign-base', name: header.name, kind: 'shape', shape: 'rect' }]
  if (header.background) layers.push({ ...base, id: 'cartaz-campaign-background', name: `Fundo · ${header.name}`, kind: 'image', src: header.background, fit: 'cover', cropY: header.backgroundCropY ?? 0.5 })
  layers.push({ ...base, id: 'cartaz-campaign-seal', name: `Cabeçalho · ${header.name}`, kind: 'image', src: header.seal, fit: 'contain', x: banner ? w * .005 : w * .02, y: h * .005, width: banner ? w * .115 : w * .59, height: banner ? h * .62 : h * .18 })
  if (header.mascot && header.layout !== 'thematic-seal') {
    layers.push({ ...base, id: 'cartaz-campaign-mascot', name: 'Personagem do cabeçalho', kind: 'image', src: header.mascot, fit: 'contain', x: 0, y: h * .005, width: banner ? w * .045 : w * .19, height: banner ? h * .60 : h * .18 })
    Object.assign(layers.find(l => l.id === 'cartaz-campaign-seal')!, { x: banner ? w * .042 : w * .18, width: banner ? w * .078 : w * .43 })
  }
  const logo = next.layers.find(l => l.id === 'cartaz-logo')
  if (logo) Object.assign(logo, { x: banner ? w * .008 : w * .65, y: banner ? h * .67 : h * .035, width: banner ? w * .109 : w * .32, height: banner ? h * .25 : h * .12 })
  next.layers.unshift(...layers)
  return next
}
