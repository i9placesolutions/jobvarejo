import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import type { CartazistaHeader } from '~/types/cartazista'

export const CARTAZISTA_CAMPAIGN_MODELS = ['landscape', 'leve-3-2', 'leve-x-y', 'leve-por-legacy']

export function applyCartazistaHeader(source: ArtComposition, header?: CartazistaHeader): ArtComposition {
  if (!header) return source
  const next: ArtComposition = JSON.parse(JSON.stringify(source))
  next.layers = next.layers.filter(l => !['cartaz-header-brush', 'cartaz-offer-label'].includes(l.id) && !l.id.startsWith('cartaz-campaign-'))
  const name=next.layers.find(l=>l.id==='cartaz-product-name')
  if(name && next.height>next.width && name.y<next.height*.235){name.height-=next.height*.235-name.y;name.y=next.height*.235}
  const base = { x: 0, y: 0, width: next.width, height: next.height*.215, rotation: 0, opacity: 1, visible: true, locked: false, fill: header.color }
  const layers: ArtLayer[] = [{...base,id:'cartaz-campaign-base',name:header.name,kind:'shape',shape:'rect'}]
  if(header.background)layers.push({...base,id:'cartaz-campaign-background',name:`Fundo · ${header.name}`,kind:'image',src:header.background,fit:'cover'})
  layers.push({...base,id:'cartaz-campaign-seal',name:`Cabeçalho · ${header.name}`,kind:'image',src:header.seal,fit:'contain',x:next.width*.07,y:next.height*.008,width:next.width*.86,height:next.height*.198})
  if(next.width/next.height>2){
    // Na faixa, a campanha ocupa a coluna lateral sem cobrir nome ou preço.
    for(const layer of layers){layer.x=0;layer.y=0;layer.width=next.width*.125;layer.height=next.height}
    const seal=layers.find(layer=>layer.id==='cartaz-campaign-seal')!
    Object.assign(seal,{x:next.width*.006,y:next.height*.08,width:next.width*.113,height:next.height*.84})
  }
  next.layers.unshift(...layers)
  return next
}
