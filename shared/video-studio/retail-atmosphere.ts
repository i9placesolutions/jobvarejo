import React,{createElement as h} from 'react'
import {AbsoluteFill,Img,useCurrentFrame,useVideoConfig} from 'remotion'
import {noise2D} from '@remotion/noise'
import {flyerRecipe} from './flyer-recipes'
import {motionSettings} from './effect-catalog'
import type {VideoRenderProps} from './model'
const rnd=(i:number)=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n)}
const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
/** Camadas reutilizáveis: toda variação depende do frame e da semente do modelo. */
export function RetailAtmosphere({props}:{props:VideoRenderProps}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),r=flyerRecipe(props.document.theme),seed=r?.seed||31,accent=r?.accent||'#d8ef85',fx=motionSettings(props.document.motion).atmosphere,s=props.document.intensity,items:React.ReactNode[]=[]
 const scene=props.scenes.find(v=>f>=v.from&&f<v.from+v.frames),local=f-(scene?.from||0),hit=Math.max(0,1-local/18)
 // Textura fotográfica em três camadas, com turbulência suave e deslocamentos independentes.
 if(fx.includes('fire')||fx.includes('fire-jets')){
  const jets=fx.includes('fire-jets'),height=ht*(jets?.65:.5),asset=(props.templateBase||'/video-studio/templates')+'/retail-fire-curtain-v1.png',filterId='fire-flow-'+seed
  items.push(h('svg',{key:'fire-filter',width:0,height:0,style:{position:'absolute'}},h('defs',null,h('filter',{id:filterId,x:'-10%',y:'-10%',width:'120%',height:'120%'},h('feTurbulence',{type:'fractalNoise',baseFrequency:`${.008+Math.sin(f*.024)*.001} ${.019+Math.cos(f*.03)*.003}`,numOctaves:2,seed:seed%97,result:'noise'}),h('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:22+Math.sin(f*.11)*8,xChannelSelector:'R',yChannelSelector:'G'})))))
  for(let layer=0;layer<3;layer++){
   const side=layer===2&&jets
   items.push(h(Img,{key:'fire-texture'+layer,src:asset,style:{position:'absolute',left:side?-w*.3:-w*.12+Math.sin(f/(12+layer*5)+layer)*w*.035,bottom:-height*(.12+layer*.035),width:w*(side?1.65:1.25),height:height*(1+Math.sin(f*.13+layer)*.08+hit*.12),objectFit:'fill',mixBlendMode:'screen',opacity:(layer===0?.74:layer===1?.24:.16)*s,transform:layer===1?'scaleX(-1)':`rotate(${Math.sin(f*.04+layer)*1.4}deg)`,filter:`url(#${filterId})`,maskImage:'linear-gradient(transparent,#000 32%)'}}))
  }
 }
 if(fx.includes('embers'))for(let i=0;i<65;i++){
  const life=(f*(.007+rnd(i)*.015)+rnd(i+seed))%1,x=rnd(i+99)*w+Math.sin(life*6+i)*60,y=ht*(1.05-life*1.2),size=3+rnd(i+8)*8
  items.push(div({position:'absolute',left:x,top:y,width:size,height:size*(i%3?2.8:1),borderRadius:'50%',rotate:`${i*31+f*2}deg`,background:i%4?'#ffac35':'#fff0b3',boxShadow:'0 0 9px #ff5b00',opacity:Math.sin(life*Math.PI)*.8*s,filter:i%7===0?'blur(2px)':undefined}))
 }
 if(fx.includes('smoke-plumes'))for(let i=0;i<10;i++){
  const life=(f*.005+i/10)%1,size=w*(.28+life*.55),x=(i%2?w*.86:-w*.2)+noise2D('smoke',f*.008,i)*w*.1
  items.push(div({position:'absolute',left:x-size*.35,top:ht*(1.15-life*1.5),width:size,height:size*.8,borderRadius:'45% 55% 70% 30%',rotate:`${i*53+f*.4}deg`,background:`radial-gradient(ellipse,${accent}44,#8d92a222 38%,transparent 70%)`,opacity:Math.sin(life*Math.PI)*.65*s,filter:'blur(18px)'}))
 }
 if(fx.includes('spark-burst'))for(let i=0;i<42;i++){
  const life=((f%72)/72+rnd(i))%1,angle=i*2.399+seed,distance=life*w*.63,x=w*.5+Math.cos(angle)*distance,y=ht*.38+Math.sin(angle)*distance+life*life*ht*.25
  items.push(div({position:'absolute',left:x,top:y,width:3,height:9+life*35,rotate:`${angle*180/Math.PI+90}deg`,background:`linear-gradient(transparent,${accent},#fff)`,opacity:(1-life)*.7*s,boxShadow:`0 0 5px ${accent}`}))
 }
 if(fx.includes('laser-sweep'))for(let i=0;i<6;i++)items.push(div({position:'absolute',left:w*.5,top:i%2?ht:0,width:w*1.4,height:3+i%2*3,transformOrigin:'0 50%',rotate:`${(i%2?-155:15)+Math.sin(f*.043+i)*55}deg`,background:`linear-gradient(#fff,${accent})`,boxShadow:`0 0 15px ${accent},0 0 40px ${accent}`,opacity:.33*s}))
 if(fx.includes('bokeh'))for(let i=0;i<18;i++){
  const size=25+rnd(i+22)*80,life=(f*.007+rnd(i))%1
  items.push(div({position:'absolute',left:rnd(i+seed)*w,top:ht*(1-life),width:size,height:size,borderRadius:'50%',border:`2px solid ${accent}99`,background:`radial-gradient(transparent,${accent}44)`,opacity:Math.sin(life*Math.PI)*.45*s,filter:i%3===0?'blur(8px)':undefined}))
 }
 if(fx.includes('ribbons'))for(let i=0;i<8;i++)items.push(div({position:'absolute',left:(rnd(i+seed)*w+f*(i%2?9:-9)+w*20)%(w*1.4)-w*.2,top:rnd(i+17)*ht,width:w*.25,height:8+i%3*5,borderRadius:'50%',background:`linear-gradient(90deg,transparent,${accent},transparent)`,rotate:`${i*19+Math.sin(f*.05+i)*24}deg`,opacity:.65*s,boxShadow:`0 0 12px ${accent}55`}))
 return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items)
}
