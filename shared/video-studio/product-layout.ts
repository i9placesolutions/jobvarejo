import type {LayoutBox} from './flyer-recipes'
export interface ProductLayer {box:LayoutBox;rotation:number;motionIndex:number;front:boolean}
/** Side copies enter first; the larger hero lands in front, below the price layer. */
export function productLayers(b:LayoutBox,vertical:boolean,duplicate:boolean,aspect:number,copies?:1|2|3):ProductLayer[]{
 const [x,y,w,h]=b
 if(copies===1||(!copies&&!duplicate))return [{box:b,rotation:0,motionIndex:0,front:true}]
 if(!copies){
  const ratio=Number.isFinite(aspect)&&aspect>0?aspect:1
  const width=Math.min(w,h*ratio),height=width/ratio
  const occupancy=width*height/(w*h)
  if(occupancy>=.62)return [{box:b,rotation:0,motionIndex:0,front:true}]
  // Fill only the unused axis. Every copy keeps the maximum contain size.
  const stacked=width/w>height/h,extent=stacked?h:w,item=stacked?height:width
  const count=Math.min(vertical?2:3,Math.ceil(extent/item))
  const step=(extent-item)/(count-1)
  return Array.from({length:count},(_,i)=>({
   box:[x+(stacked?(w-width)/2:step*i),y+(stacked?step*i:(h-height)/2),width,height] as LayoutBox,
   rotation:0,motionIndex:i===count-1?0:i+1,front:i===count-1,
  }))
 }
 if(vertical){
  const count=copies||2,ratio=Number.isFinite(aspect)&&aspect>0?aspect:1
  // Imagens largas ocupam melhor a altura empilhadas; embalagens altas ficam lado a lado.
  const stacked=ratio>=w/h
  const overlap=stacked?.46:.16,part=1/(count-(count-1)*overlap)
  const itemHeight=stacked?Math.min(h*part,w/ratio):h
  const itemWidth=stacked?w:w*part
  const step=(stacked?itemHeight:itemWidth)*(1-overlap)
  const top=stacked?y+(h-(itemHeight+step*(count-1)))/2:y
  return Array.from({length:count},(_,i)=>({
   box:(stacked?[x,top+step*i,itemWidth,itemHeight]:[x+step*i,y,itemWidth,itemHeight]) as LayoutBox,
   rotation:0,motionIndex:i===count-1?0:i+1,front:i===count-1,
  }))
 }
 if(!vertical&&copies===2)return [
  {box:[x+w*.03,y+h*.06,w*.55,h*.94],rotation:-7,motionIndex:1,front:false},
  {box:[x+w*.42,y,w*.57,h],rotation:3,motionIndex:0,front:true},
 ]
 if(copies===3||(!vertical&&copies!==2))return [
  {box:[x,y+h*.06,w*.49,h*.92],rotation:-7,motionIndex:1,front:false},
  {box:[x+w*.5,y+h*.04,w*.49,h*.94],rotation:7,motionIndex:2,front:false},
  {box:[x+w*.22,y,w*.56,h],rotation:-2,motionIndex:0,front:true},
 ]
 return [
  {box:[x-w*.06,y+h*.075,w*.84,h*.93],rotation:-9,motionIndex:1,front:false},
  {box:[x+w*.03,y,w*.98,h],rotation:5,motionIndex:0,front:true},
 ]
}
