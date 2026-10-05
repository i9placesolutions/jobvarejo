import {describe, expect, it} from 'vitest'
import {fitReferenceHeader, projectReferenceArtworkBox, referenceHeaderAspect, type RetailReferenceArtwork} from '~/shared/retail-reference-artwork'
import {referenceArtworkEndingProps, referenceArtworkSource, ReferenceArtwork} from '~/shared/video-studio/reference-artwork'
import type {VideoRenderProps} from '~/shared/video-studio/model'
import {Children} from 'react'
type InspectableElement = {props: Record<string, any>}

const artwork: RetailReferenceArtwork = {
  src: '/video-studio/templates/catalog/reference-20261004-01.png', width: 1600, height: 900, headerBottom: .24,
  logoMask: [.67, .03, .27, .11], logoBox: [.69, .05, .22, .08],
  socialMask: [.66, .145, .31, .085], instagramBox: [.68, .155, .27, .07],
  additionalMasks: [{box: [.02, .16, .2, .05], color: '#345678'}],
  colors: {logo: '#123456', social: '#234567', logoText: '#ffffff'}, sourceIndex: 7
}

describe('arte de referência em vídeo', () => {
  it('usa a proporção da faixa superior e projeta as caixas da imagem completa no recorte', () => {
    expect(referenceHeaderAspect(artwork)).toBeCloseTo(1600 / (900 * .24))
    const fitted = fitReferenceHeader({x: 20, y: 30, width: 800, height: 300}, artwork)
    expect(fitted).toMatchObject({x: 20, y: 30, width: 800})
    expect(fitted.width / fitted.height).toBeCloseTo(referenceHeaderAspect(artwork))
    expect(projectReferenceArtworkBox(fitted, artwork, artwork.logoBox)).toMatchObject({
      x: 20 + 800 * .69, y: 30 + fitted.height * (.05 / .24), width: 800 * .22, height: fitted.height * (.08 / .24)
    })
    expect(projectReferenceArtworkBox(fitted, artwork, artwork.socialMask).y).toBeGreaterThan(fitted.y)
  })

  it('resolve caminho local do catálogo no preview e no renderizador Node', () => {
    expect(referenceArtworkSource(artwork.src)).toBe('/video-studio/templates/catalog/reference-20261004-01.png')
    expect(referenceArtworkSource(artwork.src, 'http://127.0.0.1:4567/templates')).toBe('http://127.0.0.1:4567/templates/catalog/reference-20261004-01.png')
    expect(referenceArtworkSource('/api/storage/p?key=logos%2Floja.png', 'http://127.0.0.1:4567/templates')).toBe('/api/storage/p?key=logos%2Floja.png')
  })

  it('remove Facebook somente do fechamento da receita de referência e preserva os demais contatos', () => {
    const props = {document: {brand: {facebook: 'facebook.com/loja', instagram: 'loja', whatsapp: '11999999999', address: 'Rua 1'}}} as unknown as VideoRenderProps
    const updated = referenceArtworkEndingProps(props, true)
    expect(updated.document.brand).toMatchObject({facebook: '', instagram: 'loja', whatsapp: '11999999999', address: 'Rua 1'})
    expect(props.document.brand.facebook).toBe('facebook.com/loja')
    expect(referenceArtworkEndingProps(props, false)).toBe(props)
  })

  it('mantém raster e máscaras no mesmo grupo de fade, com as máscaras opacas e a identidade por cima', () => {
    const props = {document: {brand: {instagram: `@${'mercado'.repeat(10)}`}}} as unknown as VideoRenderProps
    const root = ReferenceArtwork({props, recipe: {referenceArtwork: artwork} as never, frame: {x: 0, y: 0, width: 800, height: 108}, scene: 'intro', artOpacity: .5, identityOpacity: 1}) as unknown as InspectableElement
    const canvas = root.props.children as InspectableElement
    const children = Children.toArray(canvas.props.children) as InspectableElement[]
    const group = children[0]!, logo = children[1]!, instagram = children[2]!
    expect(group.props['data-reference-artwork-source-group']).toBe(true)
    expect(group.props.style.opacity).toBe(.5)
    const groupedLayers = Children.toArray(group.props.children) as InspectableElement[]
    expect(groupedLayers).toHaveLength(4)
    expect(groupedLayers.slice(1).every(layer => layer.props.style.opacity === undefined)).toBe(true)
    expect(logo.props.id).toBe('logo')
    expect(instagram.props.id).toBe('reference-instagram')
    expect(instagram.props.style.opacity).toBe(1)
    const instagramContent = instagram.props.children as InspectableElement
    const fontSize = instagramContent.props.style.fontSize as number
    expect(fontSize).toBeLessThanOrEqual(instagram.props.style.height * .68)
    expect(fontSize * (`@${'mercado'.repeat(10)}`.length * .72 + .9)).toBeLessThanOrEqual(instagram.props.style.width + 0.001)
  })
})
