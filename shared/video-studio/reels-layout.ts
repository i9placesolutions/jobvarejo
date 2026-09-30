import type {FlyerLayout,LayoutBox} from './flyer-recipes'

/** Faixas comuns a todos os Reels, em 1080 × 1920. */
export const REELS_OFFER_LAYOUT:FlyerLayout={
 // Cresce para cima: o limite inferior continua em 625, preservando a área da oferta.
 seal:[80,60,920,565],
 name:[70,649,940,100],
 product:[60,769,960,611],
 price:[90,1320,900,280],
 condition:[90,1606,900,20],
 logo:[110,1633,860,160],
 validity:[70,1810,940,60],
}

/** Retira o vazio da caixa do selo sem esticar sua imagem. */
export function reelsOfferLayout(sealAspect?:number):FlyerLayout{
 const layout=REELS_OFFER_LAYOUT
 const [x,y,w,h]=layout.seal
 const aspect=typeof sealAspect==='number'&&Number.isFinite(sealAspect)&&sealAspect>0?sealAspect:w/h
 const height=Math.min(h,w/aspect),width=height*aspect
 const seal:LayoutBox=[x+(w-width)/2,y,width,height]
 const nameY=y+height+24,productY=nameY+layout.name[3]+20
 return {...layout,seal,name:[70,nameY,940,100],product:[60,productY,960,1380-productY]}
}
