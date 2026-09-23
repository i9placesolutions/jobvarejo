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
  if(header.layout==='thematic-seal') return applyThematicSealHeader(next,header)
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


/** Selos completos com personagem integrado: uma unica imagem e logo independente. */
function applyThematicSealHeader(source: ArtComposition, header: CartazistaHeader): ArtComposition {
  const next=applySuinaHeader(source,{...header,layout:'suina-rustica',mascot:header.seal})
  const w=next.width,h=next.height,wide=w/h>2,accent=header.accent||'#ffd21c'
  next.background=header.color
  // O cenário continua por trás da oferta; a sombra mantém a leitura do texto.
  if(header.background){
    next.layers.unshift({id:'cartaz-campaign-scene',name:'Cenário temático',kind:'image',src:header.background,fit:'cover',x:0,y:0,width:w,height:h,rotation:0,opacity:.65,visible:true,locked:false,fill:'transparent'})
    next.layers.splice(1,0,{id:'cartaz-campaign-scene-shade',name:'Contraste da oferta',kind:'shape',shape:'rect',x:wide?w*.27:0,y:wide?0:h*.285,width:wide?w*.73:w,height:wide?h:h*.64,rotation:0,opacity:.64,visible:true,locked:false,fill:header.color})
  }
  if(wide){
    const name=next.layers.find(layer=>layer.id==='cartaz-product-name')!
    Object.assign(name,{x:w*.29,width:w*.20,fontSize:h*.13})
    const unit=next.layers.find(layer=>layer.id==='cartaz-unit')!
    Object.assign(unit,{x:w*.29,width:w*.20})
  }
  next.layers=next.layers.filter(layer=>layer.id!=='cartaz-campaign-mascot')
  const set=(id:string,patch:Partial<ArtLayer>)=>{const layer=next.layers.find(layer=>layer.id===id);if(layer)Object.assign(layer,patch)}
  set('cartaz-campaign-seal',{x:wide?w*.015:w*.02,y:h*.008,width:wide?w*.24:w*.48,height:wide?h*.56:h*.27})
  set('cartaz-logo',{x:wide?w*.025:w*.53,y:wide?h*.62:h*.055,width:wide?w*.22:w*.44,height:wide?h*.25:h*.15})
  set('cartaz-campaign-instagram',{x:wide?w*.025:w*.53,width:wide?w*.22:w*.44,y:wide?h*.89:h*.252})
  const logo=next.layers.find(layer=>layer.id==='cartaz-logo')!
  const logoIndex=next.layers.indexOf(logo)
  next.layers.splice(logoIndex,0,{id:'cartaz-logo-backdrop',name:'Base da logo',kind:'shape',shape:'rect',x:logo.x-w*.01,y:logo.y-h*.01,width:logo.width+w*.02,height:logo.height+h*.02,fill:'#fff9e9',cornerRadius:w*.018,rotation:0,opacity:1,visible:false,locked:false})
  set('cartaz-price-brush',{fill:header.secondary||'#d51d13', ...(header.priceCornerRadius !== undefined ? {cornerRadius:w*header.priceCornerRadius} : {})})
  set('cartaz-price-currency',{fill:accent})
  set('cartaz-price-unit',{fill:accent})
  set('cartaz-campaign-contact-bg',{fill:accent})
  if(!wide)next.layers.push({id:'cartaz-campaign-header-detail',name:'Chamada da campanha',kind:'text',text:'QUALIDADE NA SUA MESA',x:w*.53,y:h*.220,width:w*.44,height:h*.024,fontFamily:'Barlow Condensed',fontWeight:800,fontSize:h*.015,align:'center',fill:accent,rotation:0,opacity:1,visible:true,locked:false})
  if(header.tagline){
    set('cartaz-logo-backdrop',{fill:accent,y:logo.y-h*.005,height:logo.height+h*.01})
    set('cartaz-campaign-header-detail',{text:header.tagline,fontFamily:'Caveat',fontWeight:700,fontSize:h*.022,y:h*.213,height:h*.033,fill:'#ffffff'})
  }
  if(header.retailFinish){
    const finish=header.retailFinish
    next.layers=next.layers.filter(l=>l.id!=='cartaz-campaign-header-detail')
    set('cartaz-campaign-background',{height:wide?h:h*.35})
    set('cartaz-campaign-base',{height:wide?h:h*.35})
    set('cartaz-campaign-seal',{x:0,y:h*.004,width:wide?w*.29:w*.58,height:wide?h*.64:h*.345})
    set('cartaz-logo',{x:wide?w*.015:w*.565,y:wide?h*.68:h*.085,width:wide?w*.27:w*.42,height:wide?h*.24:h*.19})
    const logo=next.layers.find(l=>l.id==='cartaz-logo')!
    set('cartaz-logo-backdrop',{x:logo.x,y:logo.y,width:logo.width,height:logo.height,fill:accent,cornerRadius:w*.012})
    set('cartaz-campaign-instagram',{x:logo.x,width:logo.width,y:wide?h*.92:h*.31})
    set('cartaz-product-name',{y:wide?h*.16:h*.365,height:wide?h*.35:h*.17,fontSize:wide?h*.14:h*.10,fill:'#ffffff'})
    if(!wide)set('cartaz-unit',{y:h*.54,height:h*.035,fontSize:h*.026,fill:accent})
    set('cartaz-price-brush',{fill:finish.labelFill,...(!wide?{x:w*.14,width:w*.72}:{})})
    if(!wide)set('cartaz-price-currency',{x:w*.155})
    for(const id of ['cartaz-price','cartaz-price-cents'])set(id,{fill:finish.labelInk,fontFamily:'Barlow Condensed',fontWeight:800})
    for(const id of ['cartaz-price-unit','cartaz-price-currency'])set(id,{fill:finish.labelInk,fontFamily:'Barlow Condensed',fontWeight:800})
    next.layers=next.layers.filter(l=>l.id!=='cartaz-price-cents')
    set('cartaz-price',{richPrice:true,align:'center'})
    const brush=next.layers.find(l=>l.id==='cartaz-price-brush')!
    const edge={...brush,id:'cartaz-campaign-price-edge',name:'Borda da etiqueta',x:brush.x-w*.009,y:brush.y-h*.009,width:brush.width+w*.018,height:brush.height+h*.018,fill:finish.labelEdge}
    const depth={...edge,id:'cartaz-campaign-price-depth',name:'Profundidade da etiqueta',y:edge.y+h*.012,fill:'#27100a'}
    next.layers.splice(next.layers.indexOf(brush),0,depth,edge)
    const deco:ArtLayer={id:'cartaz-campaign-corner',name:'Acabamento 3D',kind:'image',src:finish.decoration,fit:'contain',x:wide?w*.235:w*.79,y:wide?h*.40:h*.24,width:wide?w*.07:w*.21,height:wide?h*.24:h*.15,rotation:0,opacity:1,visible:true,locked:false,fill:'transparent'}
    if(finish.decoration)next.layers.splice(next.layers.findIndex(l=>l.id==='cartaz-campaign-seal'),0,deco)
  }
  return next
}
