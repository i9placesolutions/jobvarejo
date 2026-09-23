import type { TextStyle } from 'fabric'
import type { ArtLayer } from '~/types/art-studio'

/** Um único texto editável; a vírgula e os centavos recebem somente estilo tipográfico. */
export function cartazistaPriceStyles(layer: ArtLayer, fontSize = layer.fontSize || 48): TextStyle {
  if (!layer.richPrice) return {}
  const comma = (layer.text || '').lastIndexOf(',')
  if (comma < 0) return {}
  const styles: Record<number, {fontSize:number;deltaY:number}> = {}
  for(let i=comma;i<(layer.text||'').length;i++)styles[i]={fontSize:fontSize*.55,deltaY:-fontSize*.32}
  return {0:styles}
}
