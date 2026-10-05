import {describe, expect, it} from 'vitest'
import type {RetailReferenceArtwork} from '~/shared/retail-reference-artwork'
import {applyCartazistaHeader} from '~/utils/cartazista/headers'
import {createCartazistaDocument} from '~/utils/cartazista/composition'
import {cartazistaDocumentSchema} from '~/utils/cartazista/schema'

const artwork: RetailReferenceArtwork = {
  src: '/video-studio/templates/catalog/reference-20261004-01.png', width: 1600, height: 900, headerBottom: .24,
  logoMask: [.67, .03, .27, .11], logoBox: [.69, .05, .22, .08],
  socialMask: [.66, .145, .31, .085], instagramBox: [.68, .155, .27, .07],
  additionalMasks: [{box: [.02, .16, .2, .05], color: '#345678'}],
  colors: {logo: '#123456', social: '#234567', logoText: '#ffffff'}, sourceIndex: 7
}

describe('Cartazista com arte de referência', () => {
  it('valida e mantém a configuração opcional de arte de referência', () => {
    const document = createCartazistaDocument({modelId: 'standard', formatId: 'a4'})
    document.settings.header = {id: '11111111-1111-4111-8111-111111111111', name: 'Referência', background: '', seal: artwork.src, color: '#123456', referenceArtwork: artwork}
    expect(cartazistaDocumentSchema.safeParse(document).success).toBe(true)
    document.settings.header.referenceArtwork = {...artwork, headerBottom: 0}
    expect(cartazistaDocumentSchema.safeParse(document).success).toBe(false)
  })

  it('recorta só o cabeçalho, mantém escala proporcional e cobre as marcas com camadas nativas', () => {
    const source = {version: 1 as const, width: 800, height: 1200, background: '#ffffff', layers: [
      {id: 'cartaz-logo', name: 'Logo', kind: 'image' as const, x: 20, y: 1100, width: 100, height: 50, rotation: 0, opacity: 1, visible: false, locked: false, fill: '#000000', src: '', binding: 'logo' as const}
    ]}
    const header = {id: 'referencia', name: 'Referência', background: '', seal: artwork.src, color: '#000000', referenceArtwork: artwork}
    const result = applyCartazistaHeader(source, header)
    expect(source.layers[0]).toMatchObject({x: 20, y: 1100, visible: false})
    const image = result.layers.find(layer => layer.id === 'cartaz-campaign-reference-artwork')!
    expect(image).toMatchObject({src: artwork.src, fit: 'cover', cropY: 0, y: 0})
    expect(image.width / image.height).toBeCloseTo(artwork.width / (artwork.height * artwork.headerBottom))
    expect(result.layers.find(layer => layer.id === 'cartaz-campaign-reference-logo-mask')).toMatchObject({kind: 'shape', shape: 'rect', fill: artwork.colors.logo})
    expect(result.layers.find(layer => layer.id === 'cartaz-campaign-reference-social-mask')).toMatchObject({kind: 'shape', fill: artwork.colors.social})
    expect(result.layers.find(layer => layer.id === 'cartaz-campaign-reference-mask-1')).toMatchObject({kind: 'shape', fill: '#345678', opacity: 1})
    expect(result.layers.find(layer => layer.id === 'cartaz-logo')).toMatchObject({binding: 'logo', visible: true, x: expect.any(Number)})
    expect(result.layers.find(layer => layer.id === 'cartaz-reference-instagram')).toMatchObject({kind: 'text', binding: 'instagram', fill: artwork.colors.logoText})
  })

  it('substitui a identidade anterior ao trocar o cabeçalho', () => {
    const source = createCartazistaDocument({modelId: 'standard', formatId: 'a4'}).composition
    const header = {id: 'referencia', name: 'Referência', background: '', seal: artwork.src, color: '#000000', referenceArtwork: artwork}
    const first = applyCartazistaHeader(source, header)
    const second = applyCartazistaHeader(first, {...header, id: 'outra'})
    expect(second.layers.filter(layer => layer.id === 'cartaz-reference-instagram')).toHaveLength(1)
    expect(second.layers.filter(layer => layer.id === 'cartaz-campaign-reference-artwork')).toHaveLength(1)
    const legacy = applyCartazistaHeader(second, {...header, referenceArtwork: undefined})
    expect(legacy.layers.some(layer => layer.id === 'cartaz-reference-instagram')).toBe(false)
  })

  it('reserva apenas a coluna do cabeçalho no banner horizontal', () => {
    const source = createCartazistaDocument({modelId: 'banner-2m'}).composition
    const result = applyCartazistaHeader(source, {id: 'referencia', name: 'Referência', background: '', seal: artwork.src, color: '#000000', referenceArtwork: artwork})
    const image = result.layers.find(layer => layer.id === 'cartaz-campaign-reference-artwork')!
    expect(image.x + image.width).toBeLessThanOrEqual(source.width * .125)
    expect(image.height).toBeLessThanOrEqual(source.height)
  })
})
