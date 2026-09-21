import type {LayoutBox} from './flyer-recipes'
export interface ProductLayer {box:LayoutBox;rotation:number;motionIndex:number;front:boolean}
/** Side copies enter first; the larger hero lands in front, below the price layer. */
export function productLayers(b:LayoutBox,vertical:boolean,duplicate:boolean,aspect:number,copies?:1|2|3):ProductLayer[]{
 const [x,y,w,h]=b
 if(copies===1||(!copies&&(!duplicate||aspect>=.9)))return [{box:b,rotation:0,motionIndex:0,front:true}]
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
