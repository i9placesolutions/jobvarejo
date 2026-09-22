import { ART_FONTS, type ArtComposition } from '~/types/art-studio'

// Alternativas licenciadas; não representam identificação da fonte proprietária da referência.
export const CARTAZISTA_LETTERING_FONTS = [
  { family:'Luckiest Guy', label:'Cartaz irregular · Luckiest Guy', file:'LuckiestGuy-Regular.ttf', weight:400 },
  { family:'Bangers', label:'Pincel de impacto · Bangers', file:'Bangers-Regular.ttf', weight:400 },
  { family:'Permanent Marker', label:'Marcador à mão · Permanent Marker', file:'PermanentMarker-Regular.ttf', weight:400 },
  { family:'Kalam', label:'Escrita à mão · Kalam', file:'Kalam-Bold.ttf', weight:700 },
  { family:'Knewave', label:'Pincel inclinado · Knewave', weight:400 },
  { family:'Caveat', label:'Manuscrita · Caveat', weight:700 }
] as const

export const CARTAZISTA_OTHER_FONTS = ART_FONTS.filter(font=>!CARTAZISTA_LETTERING_FONTS.some(item=>item.family===font))
export const CARTAZISTA_TYPE_STYLES = [
  { id:'retail-hand', label:'Cartaz irregular — próximo da referência', display:'Luckiest Guy', detail:'Bangers', weight:400 },
  { id:'brush', label:'Pincel de impacto', display:'Bangers', detail:'Bangers', weight:400 },
  { id:'marker', label:'Marcador à mão', display:'Permanent Marker', detail:'Barlow Condensed', weight:400 },
  { id:'handwritten', label:'Escrita à mão', display:'Kalam', detail:'Kalam', weight:700 },
  { id:'original', label:'Pincel inclinado original', display:'Knewave', detail:'Barlow Condensed', weight:400 }
] as const
export type CartazistaTypeStyle = typeof CARTAZISTA_TYPE_STYLES[number]['id']

export function applyCartazistaTypography(source:ArtComposition, styleId:string):ArtComposition {
  const style=CARTAZISTA_TYPE_STYLES.find(style=>style.id===styleId)
  const next:ArtComposition=JSON.parse(JSON.stringify(source))
  if(!style)return next
  for(const layer of next.layers){
    if(layer.kind!=='text'||layer.locked||layer.id.startsWith('custom-'))continue
    const display=['cartaz-offer-label','cartaz-product-name','cartaz-price','cartaz-price-cents','cartaz-secondary-price','cartaz-secondary-price-cents'].includes(layer.id)
    // Avisos e rodapé permanecem em fonte legível, mesmo no estilo manuscrito.
    if(['cartaz-validity','cartaz-limit','cartaz-fold-guide','cartaz-near-expiry'].includes(layer.id))continue
    layer.fontFamily=display?style.display:style.detail
    layer.fontWeight=layer.fontFamily==='Barlow Condensed'?800:style.weight
  }
  return next
}
