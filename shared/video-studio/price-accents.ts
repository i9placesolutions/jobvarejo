import React,{createElement as h} from 'react'
import {interpolate,Easing} from 'remotion'
import type {PriceAccent,VideoMotionSettings} from './effect-catalog'

const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
const mix=(f:number,a:number,b:number,x:number,y:number)=>interpolate(f,[a,b],[x,y],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})
const rnd=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}

/** Escala extra do preço (carimbo) somada à entrada; 1 quando não há carimbo. */
export function priceAccentScale(kind:PriceAccent,frame:number){
 if(kind!=='stamp')return 1
 const t=frame-9;return t<0||t>10?1:1+Math.sin(t/10*Math.PI)*.14
}

/** Camada sobre a etiqueta: começa logo depois que o preço assenta (frame ~8 da cena). */
// Confete e pulso ficam atrás da etiqueta (não cobrem os números); brilho e estrelas ficam na frente.
export const accentBehindPrice=(kind:PriceAccent)=>kind==='confetti'||kind==='glow-pulse'
export function PriceAccentLayer({kind,frame,width,height,accent,layer}:{kind:PriceAccent;frame:number;width:number;height:number;accent:string;layer:'back'|'front'}){
 if(kind==='none'||kind==='stamp'||accentBehindPrice(kind)!==(layer==='back'))return null
 const items:React.ReactNode[]=[]
 if(kind==='shine'){
  // Faixa de luz atravessa a etiqueta duas vezes, como reflexo em vitrine.
  for(const start of [9,48]){const p=mix(frame,start,start+16,0,1);if(p>0&&p<1)items.push(div({position:'absolute',top:'-20%',height:'140%',left:`${-40+p*150}%`,width:'26%',background:'linear-gradient(100deg,transparent,#ffffffcc 50%,transparent)',transform:'skewX(-18deg)',mixBlendMode:'overlay'}))}
 }
 if(kind==='glow-pulse'){
  const pulse=frame<8?0:.55+Math.sin((frame-8)/7)*.45
  items.push(div({position:'absolute',inset:'-6%',borderRadius:'14%',boxShadow:`0 0 ${30+pulse*40}px ${10+pulse*14}px ${accent}`,opacity:Math.min(1,(frame-8)/6)*pulse}))
 }
 if(kind==='sparkle')for(let i=0;i<7;i++){
  const cycle=(frame+i*9)%36,on=frame>8?Math.sin(cycle/36*Math.PI):0,size=Math.min(width,height)*(.07+rnd(i)*.06)
  items.push(div({position:'absolute',left:`${rnd(i+3)*100}%`,top:`${rnd(i+9)*100}%`,width:size,height:size,marginLeft:-size/2,marginTop:-size/2,background:'#fff',clipPath:'polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)',opacity:on,transform:`scale(${.4+on*.8}) rotate(${frame*4}deg)`,filter:`drop-shadow(0 0 6px ${accent})`}))
 }
 if(kind==='confetti'){
  const age=frame-8
  if(age>=0&&age<40)for(let i=0;i<34;i++){
   const a=rnd(i+40)*Math.PI*2,d=age*(4+rnd(i+80)*6),g=age*age*.18
   items.push(div({position:'absolute',left:'50%',top:'45%',width:width*.025,height:width*.04,background:i%3===0?accent:i%3===1?'#ffffff':'#ffd400',transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d+g}px) rotate(${age*18+i*40}deg)`,opacity:1-age/40}))
  }
 }
 return div({position:'absolute',inset:0,pointerEvents:'none',overflow:kind==='shine'?'hidden':'visible',borderRadius:kind==='shine'?'10%':0},...items)
}

/** Filtro do acabamento da embalagem (usado por oferta no modo variado). */
export function productFinishFilter(finish:VideoMotionSettings['finish'],accent:string,progress:number){
 const base='drop-shadow(0 18px 12px #0006)'
 switch(finish){
  case 'glow':return `${base} drop-shadow(0 0 18px ${accent})`
  case 'outline':return `${base} drop-shadow(3px 0 #fff) drop-shadow(-3px 0 #fff) drop-shadow(0 3px #fff) drop-shadow(0 -3px #fff)`
  case 'shine':return `${base} brightness(${1+Math.max(0,1-progress)*.35})`
  case 'zoom-blur':return `${base} blur(${Math.max(0,1-progress)*6}px)`
  default:return base
 }
}
