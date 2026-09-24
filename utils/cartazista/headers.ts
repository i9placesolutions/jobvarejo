import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import type { CartazistaHeader } from '~/types/cartazista'

export const CARTAZISTA_CAMPAIGN_MODELS = ['landscape', 'leve-3-2', 'leve-x-y', 'leve-por-legacy']

/** A campanha ocupa apenas o cabeçalho; o corpo pertence ao Cartazista. */
export function applyCartazistaHeader(source: ArtComposition, header?: CartazistaHeader): ArtComposition {
  if (!header) return source
  const next: ArtComposition = JSON.parse(JSON.stringify(source))
  next.layers = next.layers.filter(l => !['cartaz-header-brush', 'cartaz-offer-label', 'cartaz-logo-backdrop'].includes(l.id) && !l.id.startsWith('cartaz-campaign-'))
  const w = next.width, h = next.height, banner = w / h > 2
  const base = { x: 0, y: 0, width: banner ? w * .125 : w, height: banner ? h : h * .19, rotation: 0, opacity: 1, visible: true, locked: false, fill: header.color }
  const layers: ArtLayer[] = [{ ...base, id: 'cartaz-campaign-base', name: header.name, kind: 'shape', shape: 'rect' }]
  if (header.background) layers.push({ ...base, id: 'cartaz-campaign-background', name: `Fundo · ${header.name}`, kind: 'image', src: header.background, fit: 'cover' })
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
