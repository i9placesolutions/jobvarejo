import type {VideoDocument} from './model'
import type {FlyerRecipe,FlyerLayout} from './flyer-recipes'
import {isAlcoholicProduct} from '../../utils/product-card-configuration'
import type {VideoOffer} from './model'
import {videoTemplateCopy} from './template-copy'

export const showVideoAlcoholBadge = (offer:VideoOffer) => offer.alcoholBadgeEnabled ?? isAlcoholicProduct(offer)
export const VIDEO_COLOR_PALETTES=[
  {id:'original',name:'Cores do modelo',textColor:undefined,accent:undefined},
  {id:'gold',name:'Dourado',textColor:'#fff4d2',accent:'#ffce45'},
  {id:'ice',name:'Gelo',textColor:'#e7f6ff',accent:'#74dcff'},
  {id:'mint',name:'Menta',textColor:'#e5ffe8',accent:'#a6f075'},
  {id:'rose',name:'Rosa',textColor:'#ffe5f0',accent:'#ffa6cc'},
] as const

export function personalizedRecipe(recipe:FlyerRecipe,doc:VideoDocument):FlyerRecipe {
  const titleChanged=doc.campaign.trim()!==videoTemplateCopy(recipe).title.trim()
  return {...recipe,vertical:recipe.preserveBrandLayout?recipe.vertical:videoFooterLayout(recipe.vertical,true),horizontal:videoTvOfferLayout(recipe.preserveBrandLayout?recipe.horizontal:videoFooterLayout(recipe.horizontal,false)),
    ...(doc.appearance?.accent?{accent:doc.appearance.accent,nativeTitleColor:doc.appearance.accent}:{}),
    ...(titleChanged?{seal:'',nativeTitle:doc.campaign,sealAspect:1}:{}),
  }
}

export const VIDEO_TEXT_COLORS=[
 {key:'nameColor',label:'Nome do produto'},
 {key:'priceColor',label:'Valor do preço'},
 {key:'currencyColor',label:'Símbolo R$'},
 {key:'unitColor',label:'Unidade do preço'},
 {key:'conditionColor',label:'Limite e condição'},
 {key:'validityColor',label:'Validade das ofertas'},
 {key:'contactColor',label:'Contatos e endereço'},
] as const
export function videoFooterLayout(layout:FlyerLayout,vertical:boolean):FlyerLayout{
 const [x,y,width,height]=layout.logo,top=Math.min(y,vertical?1530:700),h=Math.min(height,(vertical?1750:925)-top)
 return {...layout,logo:[x,top,width,h],validity:[vertical?70:x,top+h+18,vertical?940:width,vertical?90:60]}
}

/** TV: uma faixa exclusiva para o nome, acima da area da foto. */
export function videoTvOfferLayout(layout:FlyerLayout):FlyerLayout{
 const [x,y,w,h]=layout.product,nameY=Math.max(50,y-130),nameHeight=100
 const productY=Math.max(y,nameY+nameHeight+30)
 return {...layout,name:[x,nameY,w,nameHeight],product:[x,productY,w,Math.max(100,y+h-productY)]}
}
