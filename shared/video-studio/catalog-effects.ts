import {SpectacleAtmosphere} from './spectacle-effects'
import {campaignFamily} from './campaign-direction'
import {RetailAtmosphere} from './retail-atmosphere'
import {flyerRecipe} from './flyer-recipes'
import React,{createElement as h} from 'react'
import {AbsoluteFill,Img,Solid,useCurrentFrame,useVideoConfig} from 'remotion'
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
type SpriteAtmosphere='sprite-sparks'|'sprite-smoke'|'sprite-flare'|'sprite-stars'|'sprite-rings'|'sprite-lightning'|'sprite-fire'|'sprite-dust'|'sprite-vortex'
export interface CatalogSpriteParticle {key:string;src:string;left:number;top:number;width:number;height:number;opacity:number;rotation:number;scale:number}

/** Layout determinístico: cada quadro pode ser renderizado isoladamente pelo Remotion. */
export function catalogSpriteParticles(effect:SpriteAtmosphere,frame:number,width:number,height:number,fastPreview=false):CatalogSpriteParticle[]{
  const files={ 'sprite-sparks':'kenney-spark.png','sprite-smoke':'kenney-smoke.png','sprite-flare':'kenney-flare.png','sprite-stars':'kenney-star.png','sprite-rings':'kenney-ring.png','sprite-lightning':'kenney-lightning.png','sprite-fire':'kenney-fire.png','sprite-dust':'kenney-dust.png','sprite-vortex':'kenney-vortex.png' } satisfies Record<SpriteAtmosphere,string>
  const counts:Record<SpriteAtmosphere,number>={'sprite-sparks':24,'sprite-smoke':10,'sprite-flare':7,'sprite-stars':18,'sprite-rings':9,'sprite-lightning':5,'sprite-fire':9,'sprite-dust':30,'sprite-vortex':3}
  const source=files[effect],baseCount=counts[effect]
  const count=Math.floor(baseCount*(fastPreview ? .55 : 1))
  return Array.from({length:count},(_,i)=>{
    const size=effect==='sprite-smoke'?width*(.13+rnd(i+401)*.23):effect==='sprite-flare'?width*(.08+rnd(i+601)*.19):effect==='sprite-vortex'?width*(.28+rnd(i+701)*.26):effect==='sprite-rings'?width*(.055+rnd(i+801)*.14):effect==='sprite-lightning'?width*(.12+rnd(i+901)*.12):effect==='sprite-fire'?width*(.13+rnd(i+1001)*.18):effect==='sprite-stars'?width*(.014+rnd(i+1101)*.045):effect==='sprite-dust'?width*(.007+rnd(i+1201)*.017):width*(.018+rnd(i+201)*.035)
    const ratio=effect==='sprite-lightning'?.46:effect==='sprite-fire'?.95:effect==='sprite-smoke'?.86:effect==='sprite-flare'?.72:effect==='sprite-vortex'?1:effect==='sprite-rings'?.9:effect==='sprite-stars'?.88:effect==='sprite-dust'?.9:1
    const boxWidth=Math.min(width,size),boxHeight=Math.min(height,size*ratio)
    const speed=effect==='sprite-smoke'?.0035:effect==='sprite-flare'?.008:effect==='sprite-stars'?.011:effect==='sprite-rings'?.004:effect==='sprite-lightning'?.019:effect==='sprite-fire'?.012:effect==='sprite-dust'?.002:effect==='sprite-vortex'?.006:.014
    const phase=(frame*speed+rnd(i+11))%1
    const drift=effect==='sprite-smoke'?Math.sin(frame*.025+i)*width*.035:effect==='sprite-flare'?Math.sin(frame*.018+i)*width*.045:effect==='sprite-stars'?Math.cos(frame*.023+i*2)*width*.09:effect==='sprite-rings'?Math.cos(frame*.015+i*2)*width*.07:effect==='sprite-lightning'?Math.sin(frame*.04+i)*width*.02:effect==='sprite-fire'?Math.sin(frame*.02+i)*width*.035:effect==='sprite-dust'?Math.sin(frame*.009+i)*width*.045:effect==='sprite-vortex'?Math.sin(frame*.025+i)*width*.08:Math.sin(frame*.045+i)*width*.025
    const pulse=.65+.35*Math.sin((phase+i*.17)*Math.PI*2)
    const opacity=(effect==='sprite-smoke'?.14:effect==='sprite-fire'?.22:effect==='sprite-dust'?.12:effect==='sprite-lightning'?.34:effect==='sprite-vortex'?.24:effect==='sprite-rings'?.28:effect==='sprite-flare'?.28:.3)+pulse*(effect==='sprite-dust'?.18:effect==='sprite-smoke'?.22:.4)
    const scale=effect==='sprite-smoke'?1+phase*.42:effect==='sprite-vortex'?.8+pulse*.28:effect==='sprite-rings'?.82+pulse*.22:effect==='sprite-fire'?.82+phase*.3:effect==='sprite-flare'?.78+pulse*.28:effect==='sprite-lightning'?.75+pulse*.2:.76+pulse*.38
    const x=Math.max(0,Math.min(width-boxWidth*scale,rnd(i+31)*(width-boxWidth*scale)+drift))
    const y=effect==='sprite-smoke'?height*(.34+rnd(i+51)*.56)-phase*height*.14:effect==='sprite-stars'?height*(.08+rnd(i+1301)*.82)+Math.sin(frame*.03+i)*height*.035:effect==='sprite-rings'?height*(.16+rnd(i+1401)*.7)+Math.sin(frame*.02+i)*height*.035:effect==='sprite-lightning'?(i%2?height*.12:height*.58)+phase*height*.1:effect==='sprite-fire'?height-boxHeight*scale-phase*height*.24:effect==='sprite-dust'?height*(.08+rnd(i+1501)*.84)-phase*height*.025:effect==='sprite-vortex'?height*(.22+rnd(i+1601)*.52)+Math.sin(frame*.018+i)*height*.035:(height-boxHeight*scale)*(1-phase)
    const top=Math.max(0,Math.min(height-boxHeight*scale,y))
    const rotation=effect==='sprite-sparks'?(rnd(i+71)-.5)*80:effect==='sprite-flare'?(rnd(i+81)-.5)*24:effect==='sprite-stars'?frame*(i%2?1.1:-.8)+i*17:effect==='sprite-rings'?Math.sin(frame*.018+i)*14:effect==='sprite-lightning'?(rnd(i+1701)-.5)*14:effect==='sprite-fire'?(rnd(i+1801)-.5)*8:effect==='sprite-vortex'?frame*(i%2?1.8:-1.4)+i*67:0
    return {key:`${effect}-${i}`,src:source,left:x,top,width:boxWidth,height:boxHeight,opacity,rotation,scale}
  })
}

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
  for(const effect of ['sprite-sparks','sprite-smoke','sprite-flare','sprite-stars','sprite-rings','sprite-lightning','sprite-fire','sprite-dust','sprite-vortex'] as const)if(fx.includes(effect)){
    const templateBase=props.templateBase||'/video-studio/templates'
    for(const particle of catalogSpriteParticles(effect,f,w,ht,props.fastPreview===true))items.push(h(Img,{key:particle.key,src:`${templateBase}/effects/${particle.src}`,style:{position:'absolute',left:particle.left,top:particle.top,width:particle.width,height:particle.height,objectFit:'contain',opacity:particle.opacity*s,transform:`rotate(${particle.rotation}deg) scale(${particle.scale})`,mixBlendMode:'screen',pointerEvents:'none'}}))
  }
  return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items,h(RetailAtmosphere,{props}),h(SpectacleAtmosphere,{props}))
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
  if(mode==='flash-wipe'){
    const progress=Math.max(0,Math.min(1,(local+5)/15)),left=-w*.68+progress*w*1.9
    items.push(div({...abs(left,0,w*.58,ht),background:`linear-gradient(100deg,transparent,${accent}66,#fff 48%,${accent}aa 58%,transparent)`,filter:props.fastPreview?'none':'blur(6px)',opacity:t.cover, mixBlendMode:'screen'}))
  }
  if(mode==='split-screen'){
    const width=w*.51*t.cover
    items.push(div({...abs(0,0,width,ht),background:`linear-gradient(110deg,${base},${accent}dd)`,opacity:.92,mixBlendMode:'screen'}))
    items.push(div({...abs(w-width,0,width,ht),background:`linear-gradient(250deg,${base},${accent}dd)`,opacity:.92,mixBlendMode:'screen'}))
  }
  if(mode==='diamond-wipe'){
    const radius=t.cover*92
    items.push(div({position:'absolute',inset:0,background:`linear-gradient(135deg,${base},${accent},#fff 52%,${accent},${base})`,clipPath:`polygon(50% ${50-radius}%,${50+radius}% 50%,50% ${50+radius}%,${50-radius}% 50%)`,opacity:.94,mixBlendMode:'screen'}))
  }
  if(mode==='radial-burst')items.push(div({position:'absolute',inset:'-15%',background:`repeating-conic-gradient(from ${local*3}deg at 50% 50%,${accent}00 0deg,${accent}aa 4deg,#fff 6deg,${accent}00 12deg)`,opacity:t.cover*.82,transform:`scale(${.72+t.energy*.45})`,mixBlendMode:'screen',maskImage:'radial-gradient(ellipse, #000 8%, transparent 78%)'}))
  if(mode==='bar-wipe')for(let i=0;i<10;i++)items.push(div({...abs(w*i/10,0,w/10+1,ht),background:i%2?accent:base,opacity:t.cover*.9,transform:`translateX(${(i%2?1:-1)*(1-t.cover)*w*.16}px)`,mixBlendMode:'screen'}))
  if(mode==='pixel-dissolve'){
    const columns=props.fastPreview?9:18,rows=props.fastPreview?16:30,tileW=w/columns+1,tileH=ht/rows+1
    for(let i=0;i<columns*rows;i++)if(rnd(i+2201)<t.cover)items.push(div({...abs((i%columns)*w/columns,Math.floor(i/columns)*ht/rows,tileW,tileH),background:i%5===0?'#ffffff':i%2?accent:base,opacity:.72+t.cover*.25,mixBlendMode:'screen'}))
  }
  if(mode==='chevron-wipe'){
    items.push(div({position:'absolute',inset:0,background:`linear-gradient(110deg,${base},${accent})`,clipPath:`polygon(0 0,58% 0,50% 50%,58% 100%,0 100%)`,opacity:t.cover*.94,mixBlendMode:'screen'}))
    items.push(div({position:'absolute',inset:0,background:`linear-gradient(250deg,${base},${accent})`,clipPath:`polygon(100% 0,42% 0,50% 50%,42% 100%,100% 100%)`,opacity:t.cover*.94,mixBlendMode:'screen'}))
  }
  if(mode==='ring-wipe'){
    const diameter=Math.max(w,ht)*1.18*(.68+t.energy*.42),border=Math.max(12,w*.045)
    items.push(div({...abs((w-diameter)/2,(ht-diameter)/2,diameter,diameter),border:`${border}px solid ${accent}`,borderRadius:'50%',boxShadow:`0 0 ${border*2}px ${accent},inset 0 0 ${border*2}px ${accent}`,opacity:t.cover*.9,mixBlendMode:'screen'}))
  }
  if(mode==='smoke')for(let i=0;i<(props.fastPreview?2:3);i++)items.push(div({...abs(w*(i*.4-.3)+local*w*.02,ht*(i%2?.5:-.1),w,ht*.8),borderRadius:'50%',background:['boom','grill','clearance'].includes(campaignFamily(props.document.theme)||'')?'radial-gradient(ellipse,#dac3a1,#564338cc 40%,transparent 70%)':campaignFamily(props.document.theme)==='spooky'?'radial-gradient(ellipse,#aa89c7,#40245fcc 40%,transparent 70%)':'radial-gradient(ellipse,#c2ddb7,#668a51aa 40%,transparent 70%)',filter:props.fastPreview?'blur(8px)':'blur(25px)',opacity:t.cover}))
  if(['snap-zoom','slide','whip-up','spin'].includes(mode))for(let i=0;i<14;i++)items.push(div({...abs(w*.5,ht*.5,4,w*.32),transformOrigin:'top',transform:`rotate(${i*360/14}deg) translateY(${w*(.3+(local+5)*.045)}px)`,background:'linear-gradient(transparent,#efffd3,transparent)',opacity:t.energy*.6}))
  if(t.flash)items.push(div({position:'absolute',inset:0,background:accent,opacity:t.flash,mixBlendMode:'screen'}))
  return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items)
}
