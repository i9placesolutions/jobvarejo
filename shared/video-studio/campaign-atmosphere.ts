import React,{createElement as h} from 'react'
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion'
import {campaignFamily} from './campaign-direction'
import {flyerRecipe} from './flyer-recipes'
import type {VideoRenderProps} from './model'
const rand=(i:number)=>{const x=Math.sin(i*127.1+71)*43758.54;return x-Math.floor(x)}
/** Semantic motifs remain behind the offer; impact settles while the perimeter stays alive. */
export function CampaignAtmosphere({props}:{props:VideoRenderProps}){
 const frame=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),family=campaignFamily(props.document.theme),r=flyerRecipe(props.document.theme),seed=r?.seed||0
 if(!family||family==='boom')return null
 const scene=props.scenes.find(s=>frame>=s.from&&frame<s.from+s.frames),age=frame-(scene?.from||0)-(scene?.id==='intro'?8:5),hit=age>=0?Math.max(0,1-age/24):0,accent=r?.accent||'#ffd864',intensity=props.document.intensity,items:React.ReactNode[]=[]
 const svg=(key:string,x:number,y:number,size:number,rotation:number,opacity:number,...children:React.ReactNode[])=>h('svg',{key,viewBox:'0 0 100 100',style:{position:'absolute',left:x,top:y,width:size,height:size,rotate:rotation+'deg',opacity:opacity*intensity,overflow:'visible'}},...children)
 const path=(d:string,fill:string,extra={})=>h('path',{d,fill,...extra})
 const ring=(key:string,x:number,y:number,size:number,color:string,rotation:number,opacity:number,dashed=false)=>svg(key,x,y,size,rotation,opacity,h('circle',{cx:50,cy:50,r:44,fill:'none',stroke:color,strokeWidth:2,strokeDasharray:dashed?'8 7':undefined}))
 if(family==='lightning')for(let i=0;i<5;i++){
  const phase=(frame+i*17)%97,flash=Math.max(hit,phase<5?1-phase/5:0)
  items.push(svg('thunder'+i,(i%2?w*.83:-w*.04),ht*(i*.22-.07),w*.23,Math.sin(frame*.04+i)*12,.2+flash*.75,path('M58 -30 22 36 49 31 13 110 80 22 53 30 82 -30','#c8f8ff',{stroke:'#58bcff',strokeWidth:1})))
 }
 if(family==='alarm')for(let i=0;i<4;i++){
  const phase=frame*.18+i*Math.PI/2
  items.push(h('div',{key:'siren'+i,style:{position:'absolute',left:i%2?'80%':'-15%',top:i<2?'-15%':'65%',width:w*.6,height:ht*.6,background:`conic-gradient(from ${frame*4+i*90}deg,transparent,#ff382d99,transparent 90deg)`,opacity:(.3+Math.max(0,Math.sin(phase))*.5)*intensity}}))
 }
 if(family==='grill'||family==='clearance'){
  for(let i=0;i<7;i++)items.push(svg('heat'+i,w*(i/6-.05),ht*(.76-hit*.15),w*.22,Math.sin(frame*.09+i)*12,.35+hit*.5,path('M50 100C-5 83 30 53 23 30C39 43 44 30 51 0C63 45 98 57 77 84C82 59 63 64 58 43C52 78 27 71 50 100',i%2?'#ff701d':'#ffc84f')))
  if(family==='grill')for(let i=0;i<4;i++)items.push(svg('grill'+i,i%2?w*.86:-w*.03,ht*(i*.3-.05),w*.17,frame*.2+i*40,.22,h('path',{d:'M25 5Q0 25 25 45T25 85M50 5Q25 25 50 45T50 85M75 5Q50 25 75 45T75 85',fill:'none',stroke:'#fff1cb',strokeWidth:3})))
 }
 if(['harvest','rose','children','celebration','savings'].includes(family))for(let i=0;i<18;i++){
  const travel=(frame*(family==='rose'?1.6:3+i%3)+rand(i+seed)*ht)%(ht+200),size=w*(.055+rand(i+31)*.06),x=(i%2?w*.85:-w*.03)+Math.sin(frame*.028+i)*w*.08,y=travel-100,rot=i*31+frame*(i%2?1:-1)
  if(family==='harvest')items.push(svg('leaf'+i,x,y,size,rot,.6,path('M8 88Q-4 16 94 5Q93 91 8 88','#97d657'),h('path',{d:'M8 88 78 22',stroke:'#e7ffba',strokeWidth:3})))
  if(family==='rose')items.push(svg('petal'+i,x,y,size,rot,.65,path('M50 95C-35 46 3 -9 50 26C97 -9 135 46 50 95',i%2?'#ffa8d2':'#f65095')))
  if(family==='children')items.push(svg('balloon'+i,x,ht-y,size,rot*.1,.75,h('ellipse',{cx:50,cy:38,rx:29,ry:35,fill:['#f44373','#42c6ff','#ffdc38','#8ddd57'][i%4]}),h('path',{d:'M50 73Q70 83 50 97',fill:'none',stroke:'#fff',strokeWidth:2})))
  if(family==='celebration')items.push(svg('confetti'+i,x,y,size,rot,.75,path('M8 48Q28 -5 53 42T95 30L96 49Q67 101 42 60T8 67Z',['#ffda56','#f871d0','#83e4ff'][i%3]!)))
  if(family==='savings')items.push(svg('coin'+i,x,y,size,rot*.3,.55,h('circle',{cx:50,cy:50,r:39,fill:'#d99b16',stroke:'#ffe9a1',strokeWidth:6}),h('text',{x:50,y:69,textAnchor:'middle',fontFamily:'sans-serif',fontSize:54,fontWeight:900,fill:'#fff1b9'},'%')))
 }
 if(family==='spooky')for(let i=0;i<9;i++)items.push(svg('bat'+i,((rand(i+seed)*w+frame*(2+i%3))%(w+200))-100,rand(i+8)*ht,w*.16,Math.sin(frame*.12+i)*12,.5,path(`M50 58Q${30+Math.sin(frame*.23+i)*12} 1 1 20L12 55 30 46 42 70 50 60 58 70 70 46 88 55 99 20Q70 1 50 58`,'#180c26')))
 if(family==='bakery')for(let i=0;i<10;i++){
  const x=i%2?w*.87:-w*.04,y=((i*.15*ht-frame*1.4)%(ht+180)+ht+180)%(ht+180)-90
  items.push(svg('wheat'+i,x,y,w*.14,Math.sin(frame*.025+i)*14,.6,h('path',{d:'M50 95V15',stroke:'#ffe2a0',strokeWidth:3}),...[20,35,50,65].flatMap(y=>[h('ellipse',{key:y+'l',cx:39,cy:y,rx:7,ry:13,fill:'#e8b85e',transform:`rotate(-35 39 ${y})`}),h('ellipse',{key:y+'r',cx:61,cy:y,rx:7,ry:13,fill:'#ffe2a0',transform:`rotate(35 61 ${y})`})])))
 }
 if(family==='clock')for(let i=0;i<4;i++){
  const x=i%2?w*.8:-w*.15,y=ht*(i*.29-.09),size=w*.33
  items.push(ring('clock-ring'+i,x,y,size,accent,0,.5,true),svg('clock-hand'+i,x,y,size,0,.65,h('path',{d:'M50 50 50 14M50 50 75 58',fill:'none',stroke:accent,strokeWidth:4,transform:`rotate(${frame*3+i*75} 50 50)`})))
 }
 if(family==='neon')for(let i=0;i<5;i++)items.push(ring('neon'+i,w*(i%2?.72:-.22),ht*(i*.23-.12),w*(.35+hit*.14),['#56f9ff','#ff52db'][i%2]!,frame*(i%2?-2:2),.5,true))
 if(family==='industrial')for(let i=0;i<7;i++)items.push(svg('metal'+i,i%2?w*.88:-w*.06,ht*((i*.2+frame*.001)%1)-50,w*.16,frame*.3+i*20,.6,path('M50 2 91 26 91 74 50 98 9 74 9 26Z','#252a31',{stroke:'#b6c0cc',strokeWidth:5}),h('circle',{cx:50,cy:50,r:17,fill:'#101419',stroke:accent,strokeWidth:4})))
 if(family==='show')for(let i=0;i<5;i++)items.push(h('div',{key:'beam'+i,style:{position:'absolute',left:w*(i*.25-.1),top:-ht*.1,width:w*.35,height:ht*1.3,transformOrigin:'50% 0',rotate:`${Math.sin(frame*.055+i)*35}deg`,clipPath:'polygon(48% 0,52% 0,100% 100%,0 100%)',background:`linear-gradient(${accent}aa,transparent)`,opacity:.45*intensity}}))
 if(family==='impact')for(let i=0;i<14;i++){
  const a=i*2.399,d=(.4+hit*.35)*w,x=w*.5+Math.cos(a)*d,y=ht*.48+Math.sin(a)*d
  items.push(svg('shard'+i,x,y,w*.12,a*180/Math.PI+frame*.4,.25+hit*.65,path('M50 0 65 80 50 100 35 80Z',i%2?accent:'#fff1bd')))
 }
 return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items)
}
