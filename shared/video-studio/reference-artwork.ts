import React, {createElement as h} from 'react'
import {Img} from 'remotion'
import type {RetailReferenceArtwork, ReferenceArtworkRect} from '../retail-reference-artwork'
import {projectReferenceArtworkBox} from '../retail-reference-artwork'
import type {FlyerRecipe} from './flyer-recipes'
import type {VideoRenderProps} from './model'
import {Logo, SocialIcon} from './showcase'
import {EditableElement} from './editable-element'

const box = (rect: ReferenceArtworkRect): React.CSSProperties => ({
  position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height
})

export function referenceArtworkSource(src: string, templateBase?: string): string {
  const prefix = '/video-studio/templates/'
  return src.startsWith(prefix) ? `${templateBase || '/video-studio/templates'}/${src.slice(prefix.length)}` : src
}

/** Facebook pertence ao raster original e não deve reaparecer no fechamento dinâmico. */
export function referenceArtworkEndingProps(props: VideoRenderProps, enabled: boolean): VideoRenderProps {
  return enabled
    ? {...props, document: {...props.document, brand: {...props.document.brand, facebook: ''}}}
    : props
}

export function ReferenceArtwork({
  props, recipe, frame, scene, artOpacity, identityOpacity, rotation = 0, scale = 1, translateY = 0
}: {
  props: VideoRenderProps
  recipe: FlyerRecipe
  frame: ReferenceArtworkRect
  scene: string
  artOpacity: number
  identityOpacity: number
  rotation?: number
  scale?: number
  translateY?: number
}) {
  const artwork = recipe.referenceArtwork!
  const internal = (normalized: RetailReferenceArtwork['logoBox']) => projectReferenceArtworkBox({x: 0, y: 0, width: frame.width, height: frame.height}, artwork, normalized)
  const logo = internal(artwork.logoBox)
  const social = internal(artwork.instagramBox)
  const maskStyle = (normalized: RetailReferenceArtwork['logoMask'], color: string): React.CSSProperties => ({
    ...box(internal(normalized)), background: color
  })
  const instagram = props.document.brand.instagram.trim()
  const handle = instagram ? instagram.startsWith('@') ? instagram : `@${instagram}` : ''
  const fontSize = handle ? Math.max(1, Math.min(social.height * .68, social.width / (handle.length * .72 + .9))) : 0
  return h(EditableElement, {
    props, scene, id: 'seal', style: {
      ...box(frame), opacity: 1, rotate: `${rotation}deg`, scale,
      translate: `0px ${translateY}px`, overflow: 'hidden'
    }
  }, h('div', {style: {position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}},
    h('div', {'data-reference-artwork-source-group': true, style: {position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: artOpacity}},
      h(Img, {src: referenceArtworkSource(artwork.src, props.templateBase), style: {
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center'
      }}),
      h('div', {'data-reference-artwork-mask': 'logo', style: maskStyle(artwork.logoMask, artwork.colors.logo)}),
      h('div', {'data-reference-artwork-mask': 'social', style: maskStyle(artwork.socialMask, artwork.colors.social)}),
      ...(artwork.additionalMasks || []).map((mask, index) => h('div', {key: `additional-mask-${index}`, 'data-reference-artwork-mask': `additional-${index + 1}`, style: maskStyle(mask.box, mask.color)}))
    ),
    h(EditableElement, {props, scene, id: 'logo', style: {...box(logo), opacity: identityOpacity}},
      h(Logo, {props, width: logo.width, height: logo.height})),
    h(EditableElement, {props, scene, id: 'reference-instagram', style: {...box(social), opacity: identityOpacity}},
      handle ? h('div', {style: {width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: fontSize * .12, color: artwork.colors.logoText, fontFamily: 'ShowcaseCondensed', fontWeight: 800, fontSize, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden'}},
        h(SocialIcon, {kind: 'instagram', size: fontSize * .67}), h('span', {style: {minWidth: 0, overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap'}}, handle)) : null)
  ))
}
