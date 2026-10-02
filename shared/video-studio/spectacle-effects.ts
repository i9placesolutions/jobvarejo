import React,{createElement as h} from 'react'
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion'
import {motionSettings,type AtmosphereEffect} from './effect-catalog'
import type {VideoRenderProps} from './model'

export const SPECTACLE_EFFECT_IDS = [
  'fireworks-gold','fireworks-multicolor','fireworks-willow','fireworks-ring','fireworks-heart','fireworks-fountain',
  'explosion-fireball','explosion-smoke','explosion-sparks','explosion-shockrings','explosion-comic',
  'electric-fork','electric-chain','electric-orb','electric-storm','electric-border',
  'flame-columns','flame-wall','flame-blue','flame-whirl',
  'energy-portal','energy-meteor','energy-aurora','energy-starburst',
] as const
export type SpectacleEffect=typeof SPECTACLE_EFFECT_IDS[number]

const colors={gold:'#ffd36b',orange:'#ff702c',red:'#ff3d37',pink:'#ff68d1',cyan:'#83efff',blue:'#44aaff',violet:'#b496ff',white:'#fff9e9'}
const palette=[colors.cyan,colors.pink,'#ffd95e','#91ff9e',colors.violet,colors.white]
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n))
const finite=(n:number,fallback=0)=>Number.isFinite(n)?n:fallback
const rnd=(n:number)=>{const x=Math.sin(n*127.1+71.7)*43758.5453;return x-Math.floor(x)}
const el=(type:string,props:Record<string,unknown>)=>h(type,props)
const svg=(key:string,w:number,ht:number,opacity:number,...children:React.ReactNode[])=>h('svg',{key,viewBox:`0 0 ${w} ${ht}`,style:{position:'absolute',inset:0,width:w,height:ht,overflow:'visible',opacity:clamp(opacity),mixBlendMode:'screen',pointerEvents:'none'}},...children)
const circle=(key:string,cx:number,cy:number,r:number,fill:string,opacity=1,stroke?:string,strokeWidth?:number)=>el('circle',{key,cx,cy,r,fill,opacity,stroke,strokeWidth})
const line=(key:string,x1:number,y1:number,x2:number,y2:number,stroke:string,width:number,opacity=1)=>el('line',{key,x1,y1,x2,y2,stroke,strokeWidth:width,strokeLinecap:'round',opacity})
const path=(key:string,d:string,stroke:string,width:number,opacity=1,fill='none')=>el('path',{key,d,stroke,strokeWidth:width,strokeLinecap:'round',strokeLinejoin:'round',opacity,fill})
const phaseAge=(local:number,life:number,period:number,start=5)=>{
  if(local<start||local>90)return -1
  const age=((local-start)%period+period)%period
  return age<life?age/life:-1
}
const count=(full:number,fast:boolean)=>Math.max(1,Math.floor(full*(fast ? .52 : 1)))

function fireworks(effect:SpectacleEffect,frame:number,local:number,w:number,ht:number,fast:boolean):React.ReactNode[]{
  const age=phaseAge(local,34,40),f=finite(frame),cx=w*(effect==='fireworks-fountain' ? .5 : .5+Math.sin(Math.floor(Math.max(0,local)/40)*2.1)*.2),cy=effect==='fireworks-fountain'?ht*.83:ht*.31
  if(age<0)return []
  const p=age,fade=1-p
  if(effect==='fireworks-gold'||effect==='fireworks-multicolor'){
    const items:React.ReactNode[]=[]
    if(effect==='fireworks-gold'){
      const n=count(40,fast),burst=w*(.025+p*.18)
      for(let i=0;i<n;i++){
        const a=i*Math.PI*2/n+Math.sin(i*3)*.025,r=burst*(.72+rnd(i+4)*.32),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r
        items.push(line(`gold-trail-${i}`,cx+Math.cos(a)*r*.58,cy+Math.sin(a)*r*.58,x,y,colors.gold,Math.max(1.3,w*.0022),fade*.8),circle(`gold-spark-${i}`,x,y,Math.max(1.5,w*.0035),colors.gold,fade))
      }
      items.unshift(circle('core',cx,cy,w*(.018*(1-p*.8)),colors.white,fade*.85))
    } else {
      const n=count(16,fast)
      for(let burstIndex=0;burstIndex<3;burstIndex++){
        const q=clamp(p-burstIndex*.17),bx=cx+w*(burstIndex-1)*.18,by=cy+ht*(burstIndex===1?-.03:.035),radius=w*(.026+q*.105)
        for(let i=0;i<n;i++){
          const a=i*Math.PI*2/n+burstIndex*.27,r=radius*(.74+rnd(i+burstIndex*37)*.35),x=bx+Math.cos(a)*r,y=by+Math.sin(a)*r
          const color=palette[(i+burstIndex*2)%palette.length] ?? colors.white
          items.push(line(`burst-${burstIndex}-trail-${i}`,bx+Math.cos(a)*r*.52,by+Math.sin(a)*r*.52,x,y,color,Math.max(1.2,w*.002),fade*(1-q*.35)),circle(`burst-${burstIndex}-spark-${i}`,x,y,Math.max(1.2,w*.003),color,fade*(1-q*.35)))
        }
        items.push(circle(`burst-core-${burstIndex}`,bx,by,w*.009,colors.white,fade*(1-q*.35)))
      }
    }
    return [svg(effect,w,ht,fade*.95,...items)]
  }
  if(effect==='fireworks-willow'){
    const n=count(26,fast),items:React.ReactNode[]=[]
    for(let i=0;i<n;i++){
      const a=i*Math.PI*2/n,drop=ht*(.05+p*.27)*(i%3===0?1.25:.9),x=cx+Math.cos(a)*w*(.04+p*.15),y=cy+Math.sin(a)*ht*(.04+p*.12)+drop
      items.push(path(`arc-${i}`,`M${cx} ${cy} Q${(cx+x)/2-Math.cos(a)*18} ${(cy+y)/2-ht*.04} ${x} ${y}`,i%4===0?colors.gold:colors.orange,Math.max(1,w*.002),fade*.75))
      items.push(circle(`tip-${i}`,x,y,Math.max(1,w*.0028),i%4===0?colors.gold:colors.orange,fade*.8))
    }
    return [svg(effect,w,ht,fade,...items)]
  }
  if(effect==='fireworks-ring'){
    const n=count(32,fast),radius=w*(.045+p*.19),items:React.ReactNode[]=[circle('outer-ring',cx,cy,radius,'none',fade*.8,colors.cyan,Math.max(2,w*.003))]
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n+f*.008,x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;items.push(circle(`bead-${i}`,x,y,Math.max(1.7,w*.0037),palette[i%palette.length] ?? colors.white,fade))}
    return [svg(effect,w,ht,fade,...items)]
  }
  if(effect==='fireworks-heart'){
    const n=count(38,fast),scale=w*(.0035+p*.0038),items:React.ReactNode[]=[]
    for(let i=0;i<n;i++){const t=i*Math.PI*2/n,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);items.push(circle(`heart-${i}`,cx+x*w*(.007+p*.002),cy-y*w*(.007+p*.002),Math.max(1.4,scale),i%2?colors.pink:colors.red,fade))}
    return [svg(effect,w,ht,fade,...items)]
  }
  const n=count(44,fast),items:React.ReactNode[]=[]
  for(let i=0;i<n;i++){
    const a=-Math.PI*.5+(rnd(i+4)-.5)*1.7,x=cx+Math.cos(a)*w*(.11+p*.22),y=cy+Math.sin(a)*ht*(.1+p*.2)+p*p*ht*.12
    items.push(line(`fountain-${i}`,cx+Math.cos(a)*w*.04,cy-ht*.02,x,y,i%3?colors.gold:colors.cyan,Math.max(1.2,w*.0022),fade*.85))
  }
  return [svg(effect,w,ht,fade,...items)]
}

function explosions(effect:SpectacleEffect,local:number,w:number,ht:number,fast:boolean):React.ReactNode[]{
  const age=phaseAge(local,effect==='explosion-smoke'?48:26,120),p=age
  if(p<0)return []
  const fade=1-p,cx=w*.5,cy=ht*.47,r=w*(.025+p*.27)
  if(effect==='explosion-fireball'){
    const gradientId='spectacle-explosion-fireball-gradient',defs=h('defs',{key:'fireball-defs'},h('radialGradient',{id:gradientId,cx:'45%',cy:'42%',r:'58%'},h('stop',{offset:'0%',stopColor:colors.white}),h('stop',{offset:'28%',stopColor:colors.gold}),h('stop',{offset:'68%',stopColor:colors.orange,stopOpacity:.9}),h('stop',{offset:'100%',stopColor:colors.red,stopOpacity:0})))
    const items:React.ReactNode[]=[defs,circle('fireball-gradient',cx,cy,r,`url(#${gradientId})`,fade),circle('white-core',cx-r*.08,cy-r*.08,r*.2,colors.white,fade*.8)]
    for(let i=0;i<count(18,fast);i++){const a=i*Math.PI*2/count(18,fast),x=cx+Math.cos(a)*r*1.3,y=cy+Math.sin(a)*r*1.3;items.push(line(`flare-${i}`,cx+Math.cos(a)*r*.8,cy+Math.sin(a)*r*.8,x,y,i%2?colors.gold:colors.white,w*.002,fade*.7))}
    return [svg(effect,w,ht,fade,...items)]
  }
  if(effect==='explosion-smoke'){
    const n=count(12,fast),items:React.ReactNode[]=[]
    for(let i=0;i<n;i++){
      const id=`spectacle-explosion-smoke-${i}`,light=i%2?'#c6b7c2':'#a69ba7',dark=i%2?'#473e4b':'#332e38',a=i*Math.PI*2/n,size=r*(.44+rnd(i+6)*.42),x=cx+Math.cos(a)*r*.72,y=cy+Math.sin(a)*r*.6
      items.push(h('defs',{key:`defs-${i}`},h('radialGradient',{id,cx:'42%',cy:'38%',r:'65%'},h('stop',{offset:'0%',stopColor:light,stopOpacity:.78}),h('stop',{offset:'66%',stopColor:dark,stopOpacity:.62}),h('stop',{offset:'100%',stopColor:dark,stopOpacity:0}))),el('ellipse',{key:`puff-${i}`,cx:x,cy:y,rx:size,ry:size*.68,fill:`url(#${id})`,opacity:fade*.72}))
    }
    return [svg(effect,w,ht,fade*.86,...items)]
  }
  if(effect==='explosion-sparks'){
    const n=count(50,fast),items:React.ReactNode[]=[]
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n+(rnd(i+2)-.5)*.09,length=r*(.7+rnd(i+8)*.5),x=cx+Math.cos(a)*length,y=cy+Math.sin(a)*length;items.push(line(`spark-${i}`,cx+Math.cos(a)*r*.22,cy+Math.sin(a)*r*.22,x,y,i%4?colors.gold:colors.white,Math.max(1.2,w*.0025),fade))}
    return [svg(effect,w,ht,fade,...items)]
  }
  if(effect==='explosion-shockrings'){
    const n=fast?2:4,items:React.ReactNode[]=[]
    for(let i=0;i<n;i++){const q=clamp(p-i*.12,0,1),radius=w*(.04+q*.32);items.push(circle(`ring-${i}`,cx,cy,radius,'none',Math.max(0,1-q)*.85,i%2?colors.cyan:colors.white,Math.max(2,w*.004*(1-q*.55))))}
    return [svg(effect,w,ht,1,...items)]
  }
  const points=Array.from({length:32},(_,i)=>{const a=i*Math.PI*2/32,rad=r*(i%2?.38:1);return `${cx+Math.cos(a)*rad},${cy+Math.sin(a)*rad}`}).join(' '),comic:React.ReactNode[]=[el('polygon',{key:'comic-burst',points,fill:colors.gold,stroke:colors.red,strokeWidth:w*.012}),el('polygon',{key:'inner-burst',points:Array.from({length:24},(_,i)=>{const a=i*Math.PI*2/24,rad=r*(i%2?.25:.63);return `${cx+Math.cos(a)*rad},${cy+Math.sin(a)*rad}`}).join(' '),fill:colors.orange,opacity:.9})]
  for(let i=0;i<count(16,fast);i++){const a=i*Math.PI*2/count(16,fast),x=cx+Math.cos(a)*r*1.12,y=cy+Math.sin(a)*r*1.12;comic.push(line(`comic-ray-${i}`,cx+Math.cos(a)*r*.78,cy+Math.sin(a)*r*.78,x,y,colors.white,w*.003,fade))}
  return [svg(effect,w,ht,fade,...comic)]
}

function lightningPath(seed:number,x:number,y:number,dx:number,dy:number,segments=12){
  const points:string[]=[]
  for(let i=0;i<=segments;i++){const t=i/segments,jitter=i===0||i===segments?0:(rnd(seed+i*7)-.5)*Math.abs(dx)*.13;points.push(`${x+dx*t+jitter} ${y+dy*t}`)}
  return `M${points.join(' L')}`
}
function electric(effect:SpectacleEffect,frame:number,local:number,w:number,ht:number,fast:boolean):React.ReactNode[]{
  if(local>100)return []
  const pulse=.35+.65*Math.max(0,Math.sin((local+frame*.35)*.19)),items:React.ReactNode[]=[]
  if(effect==='electric-orb'){
    const cx=w*.16+Math.sin(frame*.04)*w*.025,cy=ht*.28+Math.sin(frame*.055)*ht*.02,r=w*.075
    const orb:React.ReactNode[]=[circle('halo',cx,cy,r*1.5,'none',.55,colors.cyan,w*.005),circle('shell',cx,cy,r,'#277bdf44',.85,colors.white,w*.004),circle('core',cx,cy,r*.42,colors.white,.72),path('arc-a',`M${cx-r} ${cy} Q${cx} ${cy-r*1.4} ${cx+r} ${cy-r*.2}`,colors.cyan,w*.005),path('arc-b',`M${cx-r*.6} ${cy+r*.7} Q${cx} ${cy+r*1.25} ${cx+r*.65} ${cy+r*.5}`,colors.violet,w*.004)]
    for(let i=0;i<count(12,fast);i++){const a=i*Math.PI*2/count(12,fast),x=cx+Math.cos(a)*r*1.34,y=cy+Math.sin(a)*r*1.34;orb.push(line(`orb-spark-${i}`,cx+Math.cos(a)*r,cy+Math.sin(a)*r,x,y,colors.cyan,w*.002,pulse*.8))}
    return [svg(effect,w,ht,pulse*.8,...orb)]
  }
  if(effect==='electric-border'){
    const inset=w*.035,segments=fast?10:22,pts:string[]=[]
    for(let i=0;i<=segments;i++){const t=i/segments;pts.push(`${inset+t*(w-2*inset)} ${inset+(rnd(i+frame)*w*.008)}`)}
    for(let i=0;i<=segments;i++){const t=i/segments;pts.push(`${w-inset+(rnd(i+50+frame)*w*.008)} ${inset+t*(ht-2*inset)}`)}
    for(let i=0;i<=segments;i++){const t=i/segments;pts.push(`${w-inset-t*(w-2*inset)} ${ht-inset+(rnd(i+90+frame)*w*.008)}`)}
    for(let i=0;i<=segments;i++){const t=i/segments;pts.push(`${inset+(rnd(i+130+frame)*w*.008)} ${ht-inset-t*(ht-2*inset)}`)}
    items.push(path('border',`M${pts.join(' L')} Z`,colors.cyan,w*.005,.8))
    for(let i=0;i<count(28,fast);i++){const side=i%4,t=rnd(i+1901),x=side===0?inset+t*(w-2*inset):side===1?w-inset:side===2?w-inset-t*(w-2*inset):inset,y=side===0?inset:side===1?inset+t*(ht-2*inset):side===2?ht-inset:ht-inset-t*(ht-2*inset);items.push(circle(`edge-spark-${i}`,x,y,Math.max(2,w*.003),colors.white,pulse*.85))}
    return [svg(effect,w,ht,pulse*.72,...items)]
  }
  if(effect==='electric-fork'){
    const x=w*.12,y=ht*.16,dx=w*.42,dy=ht*.54
    items.push(path('main-fork',lightningPath(Math.floor(frame/2),x,y,dx,dy,fast?13:22),colors.white,w*.006,pulse))
    for(let i=0;i<(fast?2:4);i++){const t=.24+i*.17,bx=x+dx*t,by=y+dy*t,side=i%2?1:-1;items.push(path(`fork-branch-${i}`,lightningPath(i+81,bx,by,dx*.18*side,dy*(.19+i*.025),8),i%2?colors.cyan:colors.violet,w*.0035,pulse*.75))}
    return [svg(effect,w,ht,pulse,...items)]
  }
  if(effect==='electric-storm'){
    const n=fast?3:6
    for(let i=0;i<n;i++){
      const side=i%2?-1:1,x=i%3===0?w*.12:i%3===1?w*.86:w*.5,y=ht*(.04+Math.floor(i/2)*.19),dx=side*w*(.15+rnd(i+13)*.22),dy=ht*(.22+rnd(i+23)*.28),strike=.2+.8*Math.max(0,Math.sin((frame*.34+i*2.7)))
      items.push(path(`storm-bolt-${i}`,lightningPath(i+Math.floor(frame/3),x,y,dx,dy,fast?10:18),i%2?colors.cyan:colors.white,w*.0045,strike))
      if(!fast&&i%2===0)items.push(path(`storm-fork-${i}`,lightningPath(i+71,x+dx*.56,y+dy*.56,-dx*.16,dy*.2,7),colors.violet,w*.0025,strike*.65))
    }
    return [svg(effect,w,ht,pulse,...items)]
  }
  const n=fast?4:8
  for(let i=0;i<n;i++){
    const x=effect==='electric-chain'?w*.08:i%2?w*.9:w*.1
    const y=effect==='electric-chain'?ht*(.22+i*.075):i%2?ht*.08:ht*.72
    const dx=effect==='electric-chain'?w*.84:(i%2?-1:1)*w*(.18+rnd(i+13)*.1),dy=effect==='electric-chain'?ht*(.025+rnd(i+4)*.02):ht*(.16+rnd(i+23)*.18)
    items.push(path(`bolt-${i}`,lightningPath(i+Math.floor(frame/2),x,y,dx,dy,fast?8:14),i%2?colors.white:colors.cyan,Math.max(1.6,w*.0035),pulse*.82))
  }
  return [svg(effect,w,ht,pulse*.9,...items)]
}
function yEdge(i:number,w:number){return w*.04+(i%5)*w*.035}

function flames(effect:SpectacleEffect,frame:number,local:number,w:number,ht:number,fast:boolean):React.ReactNode[]{
  const n=effect==='flame-wall'?(fast?8:16):effect==='flame-whirl'?(fast?8:16):(fast?5:10),blue=effect==='flame-blue',fire=blue?colors.cyan:colors.orange,hot=blue?colors.white:colors.gold,items:React.ReactNode[]=[]
  for(let i=0;i<n;i++){
    const phase=(frame*.035+i*.137)%1,height=ht*(.13+phase*.28),baseY=ht*(.98-(effect==='flame-whirl'?.08:0)),cx=effect==='flame-columns'?w*(.08+i*.092):effect==='flame-wall'?w*(i+.5)/n:w*(.5+Math.cos(frame*.026+i*.45)*(.15+i%3*.08))
    if(effect==='flame-whirl'){
      const r=w*(.12+i*.012),a=frame*.028+i*Math.PI*2/n,x=w*.5+Math.cos(a)*r,y=ht*.74+Math.sin(a)*ht*.12-height*.5
      const gradientId=`spectacle-${effect}-gradient-${i}`,d=`M${x-r*.2} ${y+height} Q${x-r*.7} ${y+height*.35} ${x} ${y} Q${x+r*.7} ${y+height*.35} ${x+r*.2} ${y+height} Z`
      items.push(h('defs',{key:`defs-${i}`},h('linearGradient',{id:gradientId,x1:'0%',y1:'100%',x2:'0%',y2:'0%'},h('stop',{offset:'0%',stopColor:hot,stopOpacity:.85}),h('stop',{offset:'48%',stopColor:fire,stopOpacity:.62}),h('stop',{offset:'100%',stopColor:fire,stopOpacity:0}))),path(`whirl-${i}`,d,hot,0,.75,`url(#${gradientId})`))
    } else {
      const sway=Math.sin(frame*.065+i*1.7)*w*.018,top=baseY-height
      const flame=`M${cx-w*.025+sway} ${baseY} Q${cx-w*.07} ${baseY-height*.35} ${cx-w*.008+sway} ${top} Q${cx+w*.01} ${baseY-height*.42} ${cx+w*.035+sway} ${baseY} Z`,gradientId=`spectacle-${effect}-gradient-${i}`
      items.push(h('defs',{key:`defs-${i}`},h('linearGradient',{id:gradientId,x1:'0%',y1:'100%',x2:'0%',y2:'0%'},h('stop',{offset:'0%',stopColor:hot,stopOpacity:.96}),h('stop',{offset:'48%',stopColor:fire,stopOpacity:.78}),h('stop',{offset:'100%',stopColor:fire,stopOpacity:0}))),path(`flame-${i}`,flame,hot,0,effect==='flame-wall'?.42:.54,`url(#${gradientId})`))
      if(effect!=='flame-wall')items.push(path(`inner-${i}`,`M${cx-w*.012+sway} ${baseY} Q${cx-w*.025} ${baseY-height*.25} ${cx+w*.006+sway} ${top+height*.19} Q${cx+w*.024} ${baseY-height*.38} ${cx+w*.02+sway} ${baseY} Z`,colors.white,0,.72,`url(#${gradientId})`))
    }
  }
  return [svg(effect,w,ht,.8,...items)]
}

function energy(effect:SpectacleEffect,frame:number,local:number,w:number,ht:number,fast:boolean):React.ReactNode[]{
  if(local>110)return []
  const pulse=.4+.6*Math.sin(frame*.045),items:React.ReactNode[]=[]
  if(effect==='energy-portal'){
    const cx=w*.5,cy=ht*.34,n=fast?3:6
    for(let i=0;i<n;i++){const r=w*(.075+i*.035+Math.sin(frame*.03+i)*.006);items.push(circle(`portal-${i}`,cx,cy,r,'none',.36, i%2?colors.violet:colors.cyan,Math.max(2,w*.003)),path(`rune-${i}`,`M${cx-r} ${cy} A${r} ${r} 0 0 1 ${cx+r} ${cy}`,i%2?colors.cyan:colors.white,w*.002,.45))}
  } else if(effect==='energy-meteor'){
    const n=fast?3:6
    for(let i=0;i<n;i++){const p=(frame*.009+i/n)%1,x=w*(.18+p*.68),y=ht*(.12+(i%3)*.08+p*.2),len=w*(.11+rnd(i+5)*.08);items.push(line(`meteor-${i}`,x-len,y-len*.55,x,y,colors.cyan,w*.006,.66),circle(`head-${i}`,x,y,w*.009,colors.white,.8))}
  } else if(effect==='energy-aurora'){
    const n=fast?3:6
    for(let i=0;i<n;i++){const y=ht*(.12+i*.055)+Math.sin(frame*.02+i)*ht*.018,d=`M${-w*.05} ${y} Q${w*.25} ${y-ht*.13} ${w*.5} ${y+ht*.02} T${w*1.05} ${y-ht*.06}`;items.push(path(`aurora-${i}`,d,i%2?colors.violet:colors.cyan,ht*.018,.13+pulse*.1))}
  } else {
    const n=fast?22:48,cx=w*.5,cy=ht*.36
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n+frame*.004,r0=w*.035,r1=w*(.14+rnd(i+10)*.24),x1=cx+Math.cos(a)*r0,y1=cy+Math.sin(a)*r0,x2=cx+Math.cos(a)*r1,y2=cy+Math.sin(a)*r1;items.push(line(`ray-${i}`,x1,y1,x2,y2,i%4?colors.cyan:colors.white,Math.max(1.2,w*.002),.25+pulse*.22))}
    items.push(circle('core',cx,cy,w*.04,colors.white,.4+pulse*.25))
  }
  return [svg(effect,w,ht,.84,...items)]
}

/** Pure frame-to-layers function; seeded geometry keeps Remotion renders reproducible. */
export function spectacleLayers(effect:SpectacleEffect,frame:number,local:number,width:number,height:number,fastPreview=false):React.ReactNode[]{
  const w=finite(width),ht=finite(height),f=finite(frame),l=finite(local)
  if(w<=0||ht<=0)return []
  if(effect.startsWith('fireworks-'))return fireworks(effect,f,l,w,ht,fastPreview)
  if(effect.startsWith('explosion-'))return explosions(effect,l,w,ht,fastPreview)
  if(effect.startsWith('electric-'))return electric(effect,f,l,w,ht,fastPreview)
  if(effect.startsWith('flame-'))return flames(effect,f,l,w,ht,fastPreview)
  return energy(effect,f,l,w,ht,fastPreview)
}

export function SpectacleAtmosphere({props}:{props:VideoRenderProps}){
  const frame=useCurrentFrame(),{width,height}=useVideoConfig(),motion=motionSettings(props.document.motion),scene=props.scenes.find(s=>frame>=s.from&&frame<s.from+s.frames),local=scene?frame-scene.from:0
  const intensity=clamp(finite(props.document.intensity))
  const layers:React.ReactNode[]=[]
  const selected=motion.atmosphere.filter((id):id is SpectacleEffect=>(SPECTACLE_EFFECT_IDS as readonly string[]).includes(id))
  for(const effect of selected)layers.push(...spectacleLayers(effect,frame,local,width,height,props.fastPreview===true))
  return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},h('div',{style:{position:'absolute',inset:0,opacity:intensity,pointerEvents:'none'}},...layers))
}
