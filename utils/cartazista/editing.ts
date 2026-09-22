import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import type { CartazistaDocument, CartazistaProduct } from '~/types/cartazista'

export function syncCartazistaBoundText(document: CartazistaDocument, composition: ArtComposition): CartazistaDocument {
  const next:CartazistaDocument=JSON.parse(JSON.stringify(document))
  const product=next.products.find(product=>product.id===next.activeProductId)
  const value=(source:ArtComposition,id:string)=>source.layers.find(layer=>layer.id===id)?.text
  const changed=(id:string)=>value(composition,id)!==undefined&&value(composition,id)!==value(document.composition,id)
  if(product){
    if(changed('cartaz-product-name'))product.name=value(composition,'cartaz-product-name')!
    if(changed('cartaz-unit'))product.unit=value(composition,'cartaz-unit')!
    for(const id of ['cartaz-price','cartaz-secondary-price']){
      if(!changed(id)&&!changed(`${id}-cents`))continue
      const integer=(value(composition,id)||'').replace(/[^\d]/g,'')
      const cents=(value(composition,`${id}-cents`)||'').replace(/[^\d]/g,'').padEnd(2,'0').slice(0,2)
      const amount=Number(`${integer}.${cents}`)
      if(!integer||!Number.isFinite(amount))continue
      let key:keyof CartazistaProduct='price'
      if(next.modelId==='leve-pague')key=id==='cartaz-price'?'packQuantity':'payQuantity'
      else if(id==='cartaz-secondary-price')key=next.modelId==='wholesale-retail'?'wholesalePrice':next.modelId==='pack'?'packPrice':'secondPrice'
      else if(['leve-3-2','leve-x-y','leve-por-legacy'].includes(next.modelId))key='packPrice'
      ;(product as any)[key]=next.modelId==='leve-pague'?Number(integer):amount
    }
  }
  if(changed('cartaz-offer-label'))next.settings.title=value(composition,'cartaz-offer-label')!.replace(/\n/g,'')
  next.composition=JSON.parse(JSON.stringify(composition))
  return next
}

export function newCartazistaLayer(composition: ArtComposition, kind: 'text'|'rect'|'ellipse'|'image', src = ''): ArtLayer {
  const {width,height}=composition
  return {id:`custom-${crypto.randomUUID()}`,name:kind==='text'?'Novo texto':kind==='image'?'Imagem':'Forma',kind:kind==='text'?'text':kind==='image'?'image':'shape',
    x:width*.1,y:height*.35,width:width*.5,height:height*(kind==='text'?.1:.25),rotation:0,opacity:1,visible:true,locked:false,fill:'#e52421',
    ...(kind==='text'?{text:'SEU TEXTO',fontFamily:'Knewave',fontSize:height*.07,fontWeight:400,align:'center' as const}:kind==='image'?{src,fit:'contain' as const}:{shape:kind})}
}

export function moveCartazistaLayer(composition: ArtComposition, id:string, direction: -1|1): ArtComposition {
  const next=structuredClone(composition), index=next.layers.findIndex(layer=>layer.id===id)
  if(index<0||next.layers[index]!.locked)return next
  const target=Math.min(next.layers.length-1,Math.max(0,index+direction))
  const [layer]=next.layers.splice(index,1);next.layers.splice(target,0,layer!)
  return next
}

export function preserveCartazistaCustomLayers(before: ArtComposition, after: ArtComposition): ArtComposition {
  const next=structuredClone(after)
  for(const layer of before.layers.filter(layer=>layer.id.startsWith('custom-'))){
    const sx=after.width/before.width,sy=after.height/before.height
    next.layers.push({...layer,x:layer.x*sx,y:layer.y*sy,width:layer.width*sx,height:layer.height*sy,...(layer.fontSize?{fontSize:layer.fontSize*sy}:{})})
  }
  return next
}
