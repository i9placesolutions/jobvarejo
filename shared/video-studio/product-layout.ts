import type {LayoutBox} from './flyer-recipes'
export interface ProductLayer {box:LayoutBox;rotation:number;motionIndex:number;front:boolean}
/** Cópias agrupadas como no encarte; a última entra à frente, abaixo do preço. */
export function productLayers(b:LayoutBox,vertical:boolean,duplicate:boolean,aspect:number,copies?:1|2|3):ProductLayer[]{
 const [x,y,w,h]=b
 if(copies===1||(!copies&&!duplicate))return [{box:b,rotation:0,motionIndex:0,front:true}]
 const ratio=Number.isFinite(aspect)&&aspect>0?aspect:1
 const width=Math.min(w,h*ratio),height=width/ratio
 if(!copies&&width*height/(w*h)>=.82)return [{box:b,rotation:0,motionIndex:0,front:true}]
 const stacked=ratio>=w/h,extent=stacked?h:w,item=stacked?height:width
 const count=copies||Math.min(vertical?2:3,Math.ceil(extent/item))
 // Use a dimensão visível da foto, não caixas largas com vazios do object-fit.
 // A composição fica centralizada e as cópias se tocam mesmo em fotos estreitas.
 // Calcule a aproximação pela proporção da foto e pelo espaço disponível.
 // Encolha apenas quando preencher a área exigiria esconder demais as cópias.
 const minimumOverlap=count===2?.08:.12,maximumOverlap=stacked?.55:.25
 const fillOverlap=1-(extent/item-1)/(count-1)
 const overlap=Math.max(minimumOverlap,Math.min(maximumOverlap,fillOverlap))
 const spanFactor=count-(count-1)*overlap
 const scale=Math.min(1,extent/(item*spanFactor))
 const itemWidth=width*scale,itemHeight=height*scale
 const step=(stacked?itemHeight:itemWidth)*(1-overlap)
 const span=(stacked?itemHeight:itemWidth)+step*(count-1)
 return Array.from({length:count},(_,i)=>({
  box:[x+Math.max(0,stacked?(w-itemWidth)/2:(w-span)/2)+(!stacked?step*i:0),y+Math.max(0,stacked?(h-span)/2:(h-itemHeight)/2)+(stacked?step*i:0),itemWidth,itemHeight] as LayoutBox,
  rotation:0,motionIndex:i===count-1?0:i+1,front:i===count-1,
 }))
}
