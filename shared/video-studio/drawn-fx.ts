import React,{createElement as h} from 'react'
import {AbsoluteFill,Loop,OffthreadVideo,Sequence,interpolate,useCurrentFrame,useVideoConfig} from 'remotion'
import library from './drawn-fx-library.json'
import {pickDrawnFxClip} from './drawn-fx-pick.mjs'
import type {VideoRenderProps} from './model'
import type {DrawnFxCategory,DrawnFxMoment} from './drawn-fx-catalog'
export * from './drawn-fx-catalog'

/**
 * Efeitos desenhados à mão (estilo RTFX: explosões, fogo, fumaça, energia, eletricidade, faíscas, respingos,
 * linhas de velocidade, quadrinhos e transições), vindos do acervo Magnific e convertidos em WebM com alfa
 * (scripts/video-studio/drawn-fx). Cada momento do vídeo escolhe uma categoria; cada oferta recebe um clipe
 * diferente da categoria, sorteado de forma determinística (o mesmo quadro sempre gera a mesma imagem).
 */
export interface DrawnFxClip {id:number;category:Exclude<DrawnFxCategory,'none'>;file:string;frames:number;width:number;height:number;box:{x0:number;y0:number;x1:number;y1:number};coverage:number}
export const DRAWN_FX_CLIPS = (library as {clips:DrawnFxClip[]}).clips
const FX_FPS = 30

/** Clipe da categoria para a posição `slot` (oferta/corte) — mesmo sorteio usado pelo worker. */
export function drawnFxClip(category:DrawnFxCategory|undefined,seed:number,slot:number,moment:DrawnFxMoment,clips:DrawnFxClip[]=DRAWN_FX_CLIPS):DrawnFxClip|null{
  return pickDrawnFxClip(category,seed,slot,moment,clips) as DrawnFxClip|null
}

export interface FxBox {left:number;top:number;width:number;height:number}
/** Posiciona o clipe para o CONTEÚDO desenhado (não o quadro do vídeo) ocupar `target`, centralizado. */
export function drawnFxPlacement(clip:DrawnFxClip,target:FxBox,scale=1.5):FxBox{
  const bw=Math.max(.05,clip.box.x1-clip.box.x0),bh=Math.max(.05,clip.box.y1-clip.box.y0),aspect=clip.height/clip.width
  const contentAspect=bh*aspect/bw,tw=target.width*scale,th=target.height*scale
  const contentW=Math.min(tw,th/contentAspect),width=contentW/bw,height=width*aspect
  const cx=target.left+target.width/2,cy=target.top+target.height/2
  return {left:cx-width*(clip.box.x0+bw/2),top:cy-height*(clip.box.y0+bh/2),width,height}
}
/** Cobre a tela inteira (transições). */
export const drawnFxCover=(clip:DrawnFxClip,w:number,ht:number):FxBox=>{const width=Math.max(w,ht*clip.width/clip.height);const height=width*clip.height/clip.width;return {left:(w-width)/2,top:(ht-height)/2,width,height}}

const fxSrc=(props:VideoRenderProps,clip:DrawnFxClip)=>(props.templateBase||'/video-studio/templates')+'/'+clip.file
const clipFrames=(clip:DrawnFxClip,fps:number)=>Math.max(1,Math.round(clip.frames*fps/FX_FPS))
function fxVideo(props:VideoRenderProps,clip:DrawnFxClip,box:FxBox,opacity=1){
  return h(OffthreadVideo,{src:fxSrc(props,clip),muted:true,transparent:true,style:{position:'absolute',left:box.left,top:box.top,width:box.width,height:box.height,opacity,pointerEvents:'none'}})
}
const seedOf=(props:VideoRenderProps)=>Number(props.document.variationSeed||0)

/** Efeitos de uma oferta (quadros locais da cena): preço aos 3 quadros, produto no início. */
export function DrawnFxOffer({props,index,price,product}:{props:VideoRenderProps;index:number;price?:FxBox;product?:FxBox}){
  const {fps}=useVideoConfig(),fx=props.document.motion?.drawnFx,items:React.ReactNode[]=[],seed=seedOf(props)
  if(!fx)return null
  const productClip=product?drawnFxClip(fx.product,seed,index,'product'):null
  if(productClip&&product)items.push(h(Sequence,{key:'product',from:0,durationInFrames:clipFrames(productClip,fps),layout:'none'},fxVideo(props,productClip,drawnFxPlacement(productClip,product,1.25))))
  const priceClip=price?drawnFxClip(fx.price,seed,index,'price'):null
  if(priceClip&&price)items.push(h(Sequence,{key:'price',from:3,durationInFrames:clipFrames(priceClip,fps),layout:'none'},fxVideo(props,priceClip,drawnFxPlacement(priceClip,price,1.6))))
  return items.length?h(AbsoluteFill,{style:{pointerEvents:'none'}},...items):null
}

/**
 * Camada global: transição desenhada cobrindo cada corte e ambiente em laço. Com `offers`, também desenha
 * preço/produto em posições padrão (composições sem caixas de layout por oferta).
 */
export function DrawnFxLayer({props,offers=false}:{props:VideoRenderProps;offers?:boolean}){
  const {width:w,height:ht,fps}=useVideoConfig(),frame=useCurrentFrame(),fx=props.document.motion?.drawnFx,items:React.ReactNode[]=[],seed=seedOf(props)
  if(!fx)return null
  const vertical=ht>w
  // O ambiente (chamas/faíscas nos cantos de baixo) some no encerramento para não cobrir contatos e endereço.
  const outro=props.scenes.find(s=>s.id==='outro'),ambientOpacity=outro?interpolate(frame,[outro.from,outro.from+12],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}):1
  if(offers)props.scenes.forEach(scene=>{
    const i=props.document.offers.findIndex(o=>o.id===scene.id)
    if(i<0)return
    const price={left:w*(vertical?.22:.58),top:ht*(vertical?.66:.58),width:w*(vertical?.56:.3),height:ht*(vertical?.14:.22)}
    const product={left:w*(vertical?.15:.1),top:ht*(vertical?.24:.2),width:w*(vertical?.7:.42),height:ht*(vertical?.38:.6)}
    items.push(h(Sequence,{key:'offer-'+scene.id,from:scene.from,durationInFrames:scene.frames,layout:'none'},h(DrawnFxOffer,{props,index:i,price,product})))
  })
  const transition=fx.transition
  if(transition&&transition!=='none')props.scenes.slice(1).forEach((scene,i)=>{
    const clip=drawnFxClip(transition,seed,i,'transition')
    if(!clip)return
    const frames=Math.min(clipFrames(clip,fps),Math.round(fps*1.3))
    items.push(h(Sequence,{key:'cut-'+scene.id,from:Math.max(0,scene.from-Math.round(frames*.45)),durationInFrames:frames,layout:'none'},fxVideo(props,clip,drawnFxCover(clip,w,ht))))
  })
  const ambient=drawnFxClip(fx.ambient,seed,0,'ambient')
  if(ambient&&ambientOpacity>0){
    const loopFrames=clipFrames(ambient,fps)
    if(fx.ambient==='linhas')items.push(h(Loop,{key:'ambient',durationInFrames:loopFrames,children:fxVideo(props,ambient,drawnFxCover(ambient,w,ht),.55*ambientOpacity)}))
    else for(const side of [0,1]){
      const size=w*(vertical?.62:.36),box={left:side?w-size*.8:-size*.2,top:ht-size*.75,width:size,height:size}
      items.push(h(Loop,{key:'ambient-'+side,durationInFrames:loopFrames,children:h('div',{style:{position:'absolute',inset:0,transform:side?'scaleX(-1)':undefined}},fxVideo(props,ambient,drawnFxPlacement(ambient,box,1),.85*ambientOpacity))}))
    }
  }
  return items.length?h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items):null
}
