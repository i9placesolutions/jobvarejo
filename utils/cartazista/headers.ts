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
  if(header.layout && header.mascot) return applySuinaHeader(next,header)
  return next
}


function applySuinaHeader(next: ArtComposition, header: CartazistaHeader): ArtComposition {
  const w=next.width,h=next.height,wide=w/h>2,light=header.layout==='suina-ouro',ink=light?'#10100e':'#ffffff'
  const set=(id:string,patch:Partial<ArtLayer>)=>{const l=next.layers.find(l=>l.id===id);if(l)Object.assign(l,patch)}
  const image=(id:string,src:string,x:number,y:number,width:number,height:number):ArtLayer=>({id,name:id,kind:'image',src,x,y,width,height,fit:'contain',rotation:0,opacity:1,visible:true,locked:false,fill:'transparent'})
  const top=wide?h:h*.285
  set('cartaz-campaign-base',{width:wide?w*.27:w,height:top})
  set('cartaz-campaign-background',{width:wide?w*.27:w,height:top})
  set('cartaz-campaign-seal',{x:wide?w*.08:w*.23,y:h*.005,width:wide?w*.18:w*.39,height:wide?h*.52:h*.265})
  next.layers.splice(2,0,image('cartaz-campaign-mascot',header.mascot!,0,h*.01,wide?w*.13:w*.30,wide?h*.52:h*.26))
  set('cartaz-logo',{x:wide?w*.025:w*.65,y:wide?h*.60:h*.055,width:wide?w*.22:w*.32,height:wide?h*.27:h*.15})
  if(wide){
    set('cartaz-product-name',{x:w*.29,y:h*.12,width:w*.30,height:h*.42,fontSize:h*.17})
    set('cartaz-unit',{x:w*.30,y:h*.58,width:w*.27,height:h*.07,fontSize:h*.06})
  }else{
    set('cartaz-product-name',{y:h*.30,height:h*.19,fontSize:h*.12,fill:ink})
    set('cartaz-unit',{y:h*.50,height:h*.055,fontSize:h*.04,fill:ink})
    set('cartaz-primary-label',{y:h*.565,height:h*.05,fontSize:h*.037,fill:ink})
    set('cartaz-price-brush',{y:h*.64,height:h*.205,shape:'rect',pathData:undefined,cornerRadius:w*.04,fill:light?'#10100e':'#cf1005'})
    set('cartaz-price',{y:h*.63,height:h*.21,fontSize:h*.195,fill:'#ffffff',fontFamily:'Barlow Condensed',fontWeight:800})
    set('cartaz-price-cents',{y:h*.64,height:h*.12,fontSize:h*.10,fill:'#ffffff',fontFamily:'Barlow Condensed',fontWeight:800})
    set('cartaz-price-unit',{y:h*.775,height:h*.045,fontSize:h*.03,fill:'#fff000'})
    set('cartaz-price-currency',{y:h*.65,height:h*.05,fontSize:h*.035,fill:'#fff000'})
    set('cartaz-validity',{x:w*.04,y:h*.865,width:w*.92,height:h*.04,fontSize:h*.018,fill:ink,align:'center'})
    set('cartaz-description-rule',{visible:false})
  }
  set('cartaz-product-name',{fontFamily:'Barlow Condensed',fontWeight:800})
  set('cartaz-price-brush',{shape:'rect',pathData:undefined,cornerRadius:w*.025,fill:light?'#10100e':'#cf1005'})
  const fy=h*.925,fx=wide?w*.29:0,fw=w-fx
  next.layers.push({id:'cartaz-campaign-contact-bg',name:'Rodapé',kind:'shape',shape:'rect',x:fx,y:fy,width:fw,height:h-fy,fill:light?'#10100e':'#fff000',rotation:0,opacity:1,visible:true,locked:false})
  for(const [id,binding,x,width]of [['phone','phone',fx+fw*.025,fw*.38],['address','address',fx+fw*.44,fw*.53]] as const)next.layers.push({id:'cartaz-campaign-'+id,name:id,kind:'text',binding,x,y:fy+h*.01,width,height:h*.055,fill:light?'#ffffff':'#10100e',text:'',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:h*.022,align:'left',lineHeight:1,rotation:0,opacity:1,visible:false,locked:false})
  next.layers.push({id:'cartaz-campaign-instagram',name:'Instagram',kind:'text',binding:'instagram',x:wide?w*.025:w*.65,y:wide?h*.88:h*.22,width:wide?w*.22:w*.32,height:h*.03,fill:'#ffffff',text:'',fontFamily:'Barlow Condensed',fontSize:h*.016,fontWeight:800,align:'center',rotation:0,opacity:1,visible:false,locked:false})
  return next
}
