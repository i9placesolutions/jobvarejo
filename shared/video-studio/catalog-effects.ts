import {campaignFamily} from './campaign-direction'
import {RetailAtmosphere} from './retail-atmosphere'
import {flyerRecipe} from './flyer-recipes'
import React,{createElement as h} from 'react'
import {AbsoluteFill,Solid,useCurrentFrame,useVideoConfig} from 'remotion'
import {noise2D} from '@remotion/noise'
import {makeStar} from '@remotion/shapes'
import {lightLeak} from '@remotion/effects/light-leak'
import {starburst} from '@remotion/effects/starburst'
import {motionSettings,type TextEntrance} from './effect-catalog'
import {elementMotion,transitionMotion} from './catalog-motion'
import type {VideoRenderProps} from './model'

const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
const abs=(x:number,y:number,w:number,ht:number):React.CSSProperties=>({position:'absolute',left:x,top:y,width:w,height:ht})
const rnd=(i:number)=>{const r=Math.sin(i*127.1+31.7)*43758.5453;return r-Math.floor(r)}
const sparkle=makeStar({points:4,innerRadius:5,outerRadius:24})

export function AnimatedRetailText({text,mode,speed}:{text:string;mode:TextEntrance;speed:'fast'|'balanced'}) {
  const f=useCurrentFrame()-2,words=text.split(/\s+/),stagger=mode==='word-pop'||mode==='stomp'
  return h('span',{style:{display:'block'}},...words.map((word,i)=>{
    const time=f-(stagger?Math.min(i*2,10):0),kind=mode==='whip'?'whip-right':mode==='rise'?'rise':mode==='tilt'?'tilt':mode==='stomp'?'drop':'slam'
    const m=elementMotion(time,kind,0,speed),travel=Math.max(0,1-m.progress)
    return h('span',{key:i,style:{display:'inline-block',whiteSpace:'nowrap',marginRight:i===words.length-1?0:'.2em',opacity:m.opacity,translate:`${m.x*.35}px ${m.y*.38}px`,rotate:`${m.rotation*.4}deg`,transform:mode==='stretch'?`scale(${1+travel*.3},${1-travel*.4})`:`scale(${.88+.12*m.scale})`,letterSpacing:mode==='tracking'?`${travel*7}px`:undefined}},word)
  }))
}

export function CatalogAtmosphere({props}:{props:VideoRenderProps}) {
  const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),d=props.document,m=motionSettings(d.motion),fx=m.atmosphere,s=d.intensity,accent=flyerRecipe(d.theme)?.accent||'#d8ef85',base=flyerRecipe(d.theme)?.base||'#163825'
  const scene=props.scenes.find(v=>f>=v.from&&f<v.from+v.frames),local=f-(scene?.from||0),items:React.ReactNode[]=[]
  if(fx.includes('speed-lines'))for(let i=0;i<26;i++){
    const phase=(f*.037+rnd(i))%1,angle=i*360/26
    items.push(div({...abs(w*.5,ht*.5,2+rnd(i+3)*4,w*.15),transformOrigin:'top',transform:`rotate(${angle}deg) translateY(${w*(.32+phase*.8)}px)`,opacity:(1-phase)*s*.45,background:`linear-gradient(transparent,${accent},transparent)`}))
  }
  if(fx.includes('shockwave')&&local>=5&&local<24)for(let i=0;i<2;i++){
    const p=Math.max(0,(local-5-i*2)/17),size=w*(.25+p*1.7)
    items.push(div({...abs((w-size)/2,ht*.57-size/2,size,size),border:`4px solid ${accent}`,borderRadius:'50%',opacity:Math.max(0,1-p)*s*.55,boxShadow:'0 0 14px #dcff6b60'}))
  }
  if(fx.includes('spotlights'))for(let i=0;i<4;i++)items.push(div({...abs((i/3)*w,-ht*.1,w*.23,ht*1.4),transformOrigin:'50% 0',rotate:`${Math.sin(f*.055+i)*28}deg`,background:`linear-gradient(${accent}50,transparent)`,clipPath:'polygon(45% 0,55% 0,100% 100%,0 100%)',filter:'blur(8px)',opacity:s*.45}))
  if(fx.includes('lightning'))for(let i=0;i<2;i++){
    const x=i?w*.97:w*.03,points=Array.from({length:12},(_,n)=>`${x+noise2D('bolt'+i,Math.floor(f/3),n)*45},${n*ht/11}`).join(' ')
    items.push(h('svg',{key:'bolt'+i,width:w,height:ht,style:{position:'absolute',inset:0,opacity:(local<16?.7:.2)*s,filter:'drop-shadow(0 0 8px #b6f3ff)'}},h('polyline',{points,fill:'none',stroke:'#e8fcff',strokeWidth:3})))
  }
  if(fx.includes('prism'))items.push(h(Solid,{key:'leak',width:w,height:ht,color:'transparent',effects:[lightLeak({seed:17,hueShift:85,progress:(f%100)/100})],style:{position:'absolute',inset:0,opacity:.23*s,mixBlendMode:'screen'}}))
  if(fx.includes('dust'))for(let i=0;i<38;i++){
    const x=rnd(i+90)*w+noise2D('dust',f*.027,i)*35,y=((rnd(i+100)*ht-f*(2+rnd(i)*7))%ht+ht)%ht
    items.push(div({...abs(x,y,3+rnd(i)*8,3+rnd(i)*8),borderRadius:'50%',background:accent,opacity:(.12+rnd(i)*.25)*s,filter:i%4===0?'blur(2px)':undefined}))
  }
  if(fx.includes('orbit'))for(let i=0;i<9;i++){
    const angle=f*.026+i*.698,x=w/2+Math.cos(angle)*w*.46,y=ht*.5+Math.sin(angle)*ht*.43
    items.push(h('svg',{key:'star'+i,viewBox:`0 0 ${sparkle.width} ${sparkle.height}`,width:35+i%3*12,height:35+i%3*12,style:{position:'absolute',left:x,top:y,rotate:`${f*2}deg`,opacity:s*.65}},h('path',{d:sparkle.path,fill:accent})))
  }
  if(fx.includes('grid')){
    items.push(h(Solid,{key:'native-rays',width:w,height:ht,color:base,effects:[starburst({rays:24,colors:[base,accent],rotation:(f*.65)%360,smoothness:.5})],style:{position:'absolute',inset:0,opacity:s*.14}}))
    for(let i=0;i<8;i++){const p=((f*.02+i/8)%1),size=w*(.15+p*1.6);items.push(div({...abs((w-size)/2,(ht-size)/2,size,size),border:`2px solid ${accent}`,rotate:'45deg',opacity:p*(1-p)*s,scale:`1 ${ht/w}`}))}
  }
  return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items,h(RetailAtmosphere,{props}))
}

export function CatalogTransition({props}:{props:VideoRenderProps}) {
  const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),scene=props.scenes.slice(1).find(s=>f>=s.from-5&&f<=s.from+10)
  if(!scene)return null
  const accent=flyerRecipe(props.document.theme)?.accent||'#d8ef85',base=flyerRecipe(props.document.theme)?.base||'#163825'
  const local=f-scene.from,mode=props.document.transition,t=transitionMotion(local,mode),items:React.ReactNode[]=[]
  if(mode==='fade')return null
  if(mode==='light')items.push(h(Solid,{key:'light',width:w,height:ht,color:'transparent',effects:[lightLeak({seed:8,hueShift:65,progress:(local+5)/15})],style:{position:'absolute',inset:0,opacity:t.energy*.75,mixBlendMode:'screen'}}))
  if(mode==='diagonal')items.push(div({...abs(w*(local/8)-w*.5,-ht*.5,w*.65,ht*2),background:`linear-gradient(90deg,${base},${accent},#fff,${base})`,rotate:'-25deg',opacity:t.cover}))
  if(mode==='shutter')for(let i=0;i<7;i++)items.push(div({...abs(0,ht*i/7,w,ht/7+1),background:i%2?accent:base,scale:`1 ${t.cover}`,transformOrigin:i%2?'top':'bottom'}))
  if(mode==='iris')items.push(div({position:'absolute',inset:0,background:accent,clipPath:`circle(${t.cover*78}% at 50% 50%)`,opacity:.85}))
  if(mode==='rgb')for(let i=0;i<4;i++)items.push(div({...abs(Math.sin(local*2+i)*w*.2,ht*(i*.25),w,ht*.07),background:i%2?'#fb2b8577':'#36f9ef77',opacity:t.chromatic,mixBlendMode:'screen'}))
  if(mode==='smoke')for(let i=0;i<(props.fastPreview?2:3);i++)items.push(div({...abs(w*(i*.4-.3)+local*w*.02,ht*(i%2?.5:-.1),w,ht*.8),borderRadius:'50%',background:['boom','grill','clearance'].includes(campaignFamily(props.document.theme)||'')?'radial-gradient(ellipse,#dac3a1,#564338cc 40%,transparent 70%)':campaignFamily(props.document.theme)==='spooky'?'radial-gradient(ellipse,#aa89c7,#40245fcc 40%,transparent 70%)':'radial-gradient(ellipse,#c2ddb7,#668a51aa 40%,transparent 70%)',filter:props.fastPreview?'blur(8px)':'blur(25px)',opacity:t.cover}))
  if(['snap-zoom','slide','whip-up','spin'].includes(mode))for(let i=0;i<14;i++)items.push(div({...abs(w*.5,ht*.5,4,w*.32),transformOrigin:'top',transform:`rotate(${i*360/14}deg) translateY(${w*(.3+(local+5)*.045)}px)`,background:'linear-gradient(transparent,#efffd3,transparent)',opacity:t.energy*.6}))
  if(t.flash)items.push(div({position:'absolute',inset:0,background:accent,opacity:t.flash,mixBlendMode:'screen'}))
  return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items)
}
