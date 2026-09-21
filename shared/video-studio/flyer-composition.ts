import {useRetailFonts} from './font-readiness'
import {videoBackground,backgroundAsset} from './backgrounds'
import {productEffects} from './native-effects'
import React,{createElement as h} from 'react'
import {AbsoluteFill,Audio,Img,CanvasImage,Sequence,useCurrentFrame,useVideoConfig,interpolate,Easing} from 'remotion'
import {flyerRecipe,type FlyerRecipe,type LayoutBox} from './flyer-recipes'
import {Logo,Ending,RetailCamera,SocialIcon} from './showcase'
import {displayPrice,type VideoRenderProps,type VideoScene} from './model'
import {elementMotion} from './catalog-motion'
import {CatalogTransition,CatalogAtmosphere,AnimatedRetailText} from './catalog-effects'
import {motionSettings,soundAsset,SOUND_EFFECTS} from './effect-catalog'
import {musicGain,OPENING_SOUNDS} from './sound-design'
import {VideoPriceLabel} from './label-renderer'
import {productLayers} from './product-layout'
import {EditableElement} from './editable-element'
const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
const box=([left,top,width,height]:LayoutBox):React.CSSProperties=>({position:'absolute',left,top,width,height})
const font:React.CSSProperties={fontFamily:'ShowcaseCondensed',fontWeight:800,lineHeight:1.02,textAlign:'center',color:'white'}
const fit=(text:string,size:number,limit:number)=>Math.max(size*.48,size*Math.min(1,Math.sqrt(limit/Math.max(limit,text.length))))
const mix=(f:number,a:number,b:number,x:number,y:number)=>interpolate(f,[a,b],[x,y],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})
const random=(n:number)=>{const x=Math.sin(n*93.17+21)*42817;return x-Math.floor(x)}
function Backdrop({props,r}:{props:VideoRenderProps;r:FlyerRecipe}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),intensity=props.document.intensity,kind=r.backgroundKind||r.id,seed=r.seed||0,items:React.ReactNode[]=[]
 const asset=(props.templateBase||'/video-studio/templates')+'/'+r.background
 // Placa 3D vibrante + arte do encarte em planos independentes, com variação por modelo.
 const variant=r.backgroundVariant||0,chosen=videoBackground(props.document.background),energy=chosen?backgroundAsset(chosen.id,props.format):ht>w?(r.energyBackgroundVertical||r.energyBackground):r.energyBackground
 if(energy)items.push(h(Img,{key:'energy-art',src:(props.templateBase||'/video-studio/templates')+'/'+energy,style:{position:'absolute',inset:'-7%',width:'114%',height:'114%',objectFit:'cover',transform:`translate(${Math.sin(f/(28+variant*3))*18}px,${Math.cos(f/(36+variant*4))*20}px) scale(${1.04+Math.sin(f/45)*.035}) rotate(${Math.sin(f/70+variant)*.6}deg)`,filter:`hue-rotate(${(variant-2)*5}deg) saturate(1.12)`,opacity:.98}}))
 if(r.background)items.push(h(Img,{key:'art',src:asset,style:{position:'absolute',inset:'-6%',width:'112%',height:'112%',objectFit:'cover',transform:`translate(${Math.sin(f/42)*14}px,${Math.cos(f/51)*18}px) scale(${1.02+Math.sin(f/65)*.025})`,opacity:r.energyBackground?.25:kind==='electric'?.55:.65,mixBlendMode:r.energyBackground?'soft-light':undefined}}))
 items.push(div({position:'absolute',inset:0,background:`radial-gradient(ellipse at 50% 55%,${r.base}11,${r.base}66 95%)`}))
 if(props.document.effects.includes('rays')){
 if(kind==='alarm'||kind==='alerta'){
  for(let i=0;i<3;i++)items.push(div({position:'absolute',left:'50%',top:'25%',width:w*1.9,height:ht*.85,transformOrigin:'0% 0%',rotate:`${f*2.1+i*120}deg`,background:`conic-gradient(from -8deg at 0% 0%,#ffcf7066,transparent 18deg)`,opacity:.38*intensity}))
  for(let i=0;i<2;i++)items.push(div({position:'absolute',left:-w*.2,top:i?ht*.9:ht*.08,width:w*1.4,height:44,rotate:i?'9deg':'-9deg',background:`repeating-linear-gradient(115deg,#ffda29 0 36px,#341013 37px 67px)`,backgroundPosition:`${f*(i?-18:18)}px 0`,boxShadow:'0 6px 16px #220007',opacity:.8}))
 }else if(kind==='electric'||kind==='relampago'){
  for(let i=0;i<8;i++)items.push(div({position:'absolute',left:((random(i)*w+f*(i%2?19:-22))%(w+500)+w+500)%(w+500)-250,top:random(i+22)*ht,width:250+random(i+5)*350,height:5,rotate:'-22deg',background:'linear-gradient(90deg,transparent,#9bf7ff,transparent)',boxShadow:'0 0 14px #008cff',opacity:.3*intensity}))
  for(let i=0;i<3;i++)items.push(h('svg',{key:'bolt'+i,viewBox:'0 0 130 600',style:{position:'absolute',left:i%2?w-100:-35,top:ht*(i*.32),width:130,height:600,opacity:(.12+Math.pow(Math.max(0,Math.sin(f*.13+i*2)),8)*.65)*intensity,filter:'drop-shadow(0 0 14px #48dcff)'}},h('path',{d:'M80 0 12 170 74 165 20 335 97 303 43 600 125 247 65 268 112 105 53 122Z',fill:'#b8f8ff'})))
 }else if(kind==='neon'||kind==='saldao'){
  for(let i=0;i<4;i++)items.push(div({position:'absolute',left:i%2?w*.7:-w*.4,top:ht*(i*.27-.12),width:w*.72,height:w*.72,border:'8px solid #ffed5544',borderTopColor:'#fff5a5',borderRadius:'50%',rotate:`${f*(i%2?-3:3)+i*40}deg`,boxShadow:'0 0 20px #ff742955,inset 0 0 24px #ff6a4433',opacity:.7*intensity}))
 }
 if(kind==='harvest')for(let i=0;i<14;i++)items.push(div({position:'absolute',left:random(i+seed)*w,top:(random(i+20)*ht+f*(6+i%4))%(ht+150)-75,width:45+i%3*25,height:80+i%3*30,borderRadius:'0 95% 0 95%',background:`linear-gradient(35deg,#123c21,${r.accent})`,borderLeft:'2px solid #e7ffb977',rotate:`${i*53+Math.sin(f/17+i)*30}deg`,opacity:.35,filter:i%4===0?'blur(3px)':undefined}))
 if(kind==='embers'||kind==='spooky'){
  for(let i=0;i<8;i++)items.push(div({position:'absolute',left:(i%2?w*.55:-w*.3)+Math.sin(f/32+i)*80,top:((i*.19*ht-f*2)%(ht*1.2)+ht*1.2)%(ht*1.2)-ht*.2,width:w*.8,height:ht*.5,borderRadius:'50%',background:`radial-gradient(ellipse,${kind==='spooky'?'#9976ba44':'#f3a97630'},transparent 70%)`,filter:'blur(24px)',opacity:.7}))

 }
 if(kind==='celebration'||kind==='rose')for(let i=0;i<30;i++)items.push(div({position:'absolute',left:random(i+seed)*w+Math.sin(f/18+i)*25,top:(random(i+70)*ht+f*(7+i%5))%(ht+80)-40,width:kind==='rose'?18:12,height:kind==='rose'?28:25,borderRadius:kind==='rose'?'90% 5% 90% 5%':2,background:[r.accent,'#ffffff','#ef738e'][i%3],rotate:`${i*43+f*(i%2?4:-5)}deg`,opacity:.65}))
 if(kind==='clock')for(let i=0;i<3;i++)items.push(div({position:'absolute',left:i%2?w*.75:-w*.35,top:ht*(i*.38-.05),width:w*.6,height:w*.6,borderRadius:'50%',border:`8px dashed ${r.accent}66`,rotate:`${f*(i%2?-1.5:2.3)}deg`,opacity:.65},div({position:'absolute',left:'49%',top:'10%',width:7,height:'40%',transformOrigin:'50% 100%',rotate:`${f*4}deg`,background:r.accent})))
 if(kind==='spotlight'||kind==='industrial')for(let i=0;i<5;i++)items.push(div({position:'absolute',left:w*(i*.25-.15),top:-ht*.2,width:w*.32,height:ht*1.5,transformOrigin:'50% 0%',rotate:`${Math.sin(f/23+i+seed%10)*26}deg`,background:`linear-gradient(${r.accent}44,transparent)`,clipPath:'polygon(47% 0,53% 0,100% 100%,0 100%)',opacity:.55}))
 }
 if(props.document.effects.includes('glow'))for(let i=0;i<44;i++){const speed=4+random(i)*11;items.push(div({position:'absolute',left:random(i+99)*w,top:(random(i+80)*ht+f*speed)%(ht+80)-40,width:i%4?4:12,height:i%4?22:12,background:i%3?r.accent:'#fff',borderRadius:r.id==='saldao'?2:6,rotate:`${i*47+f*(i%2?3:-3)}deg`,opacity:(.15+random(i+6)*.4)*intensity,boxShadow:i%4?'none':`0 0 16px ${r.accent}`}))}
 return h(AbsoluteFill,{style:{background:r.backgroundGradient||r.base,overflow:'hidden'}},...items,h(CatalogAtmosphere,{props}))
}
function DateLine({props,large=false}:{props:VideoRenderProps;large?:boolean}){const text=props.document.validity||'INFORME A VALIDADE';return div({...font,display:'flex',alignItems:'center',justifyContent:'center',gap:9,height:'100%',fontSize:fit(text,large?42:22,large?40:50),textShadow:'0 2px 5px #000',lineHeight:1.12},h(SocialIcon,{kind:'calendar',size:large?35:22}),text)}
function Identity({props,r}:{props:VideoRenderProps;r:FlyerRecipe}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,layout=p?r.vertical:r.horizontal,first=props.scenes[1]?.from||60,outro=props.scenes.at(-1)!.from,split=Math.floor(first*.48)
 const progress=mix(f,first-4,first+7,0,1),end=mix(f,outro-4,outro+5,0,1)
 const interpolateBox=(a:LayoutBox,b:LayoutBox,t:number)=>a.map((v,i)=>v+(b[i]!-v)*t) as unknown as LayoutBox
 const sealBox=interpolateBox(p?[95,190,890,1100]:[220,65,1480,900],layout.seal,progress)
 const nativeLines=(r.nativeTitle||r.campaign).split('\n').flatMap(line=>line.length>10?line.split(' '):[line]),nativeSize=(width:number,height:number)=>Math.min(width/(Math.max(...nativeLines.map(line=>line.length))*.6),height/(nativeLines.length*1.08))
 const introContentHeight=r.nativeTitle?nativeSize(890,1100)*nativeLines.length*1.02:Math.min(1100,890/Math.max(.2,r.sealAspect||1))
 const introLogoTop=190+1100/2+introContentHeight/2+24
 const logoBox=interpolateBox(interpolateBox(p?[100,introLogoTop,880,390]:[410,240,1100,560],layout.logo,progress),p?[70,370,940,450]:[65,205,820,450],end)
 const sceneId=props.scenes.find(s=>f>=s.from&&f<s.from+s.frames)?.id||'intro'
 const seal=elementMotion(f-2,'slam',0,'fast'),logo=elementMotion(f-(p?13:split),'rise',0,'fast')
 const logoAlpha=mix(f,p?13:split,p?17:split+4,0,1),sealAlpha=seal.opacity*(1-end)*(p?1:progress+(1-progress)*(1-mix(f,split-3,split+2,0,1)))
 return h(AbsoluteFill,null,
 h(EditableElement,{props,scene:sceneId,id:'seal',style:{...box(sealBox),opacity:sealAlpha,scale:seal.scale,rotate:`${seal.rotation+Math.sin(f/39)*.65}deg`}},r.seal?h(CanvasImage,{src:(props.templateBase||'/video-studio/templates')+'/'+r.seal,width:Math.round(1280*Math.max(.2,r.sealAspect||1)),height:1280,fit:'contain',effects:props.document.effects.includes('glow')?productEffects((f%95),'shine',props.document.intensity):[],style:{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 14px 12px #0006)'}}):div({...font,fontSize:nativeSize(sealBox[2],sealBox[3]),height:'100%',display:'flex',alignItems:'center',justifyContent:'center',whiteSpace:'pre',color:r.accent,textShadow:'0 5px #573205,0 10px #382003,0 18px 20px #0008'},nativeLines.join('\n'))),
 h(EditableElement,{props,scene:sceneId,id:'logo',style:{...box(logoBox),opacity:logoAlpha,scale:logo.scale,translate:`0px ${logo.y}px`}},h(Logo,{props,width:logoBox[2],height:logoBox[3]})),
 h(EditableElement,{props,scene:'intro',id:'validity',style:{...box(p?[100,1710,880,80]:[100,50,620,65]),opacity:1-progress}},h(DateLine,{props,large:p})))
}
function Price({props,price,unit}:{props:VideoRenderProps;r:FlyerRecipe;price:string;unit:string}){
 return props.label?h(VideoPriceLabel,{label:props.label,price,unit}):div({...font,fontSize:34,paddingTop:40},'SELECIONE UMA ETIQUETA')
}
function Offer({props,r,scene,index}:{props:VideoRenderProps;r:FlyerRecipe;scene:VideoScene;index:number}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,l=p?r.vertical:r.horizontal,d=props.document,o=d.offers[index]!,m=motionSettings(d.motion),src=props.media[o.image]
 const price=elementMotion(f-5,m.price,0,m.speed)
 const exit=mix(f,scene.frames-5,scene.frames,1,0),float=f>18&&d.effects.includes('pulse')?Math.sin(f/19)*5:0
 const layers=productLayers(l.product,p,d.duplicateProducts!==false,o.imageAspectRatio||1,o.copies)
 const images=layers.map(layer=>{const entrance=layer.motionIndex===2?'whip-right':m.product,a=elementMotion(f,entrance,layer.motionIndex,m.speed);return h(EditableElement,{props,scene:scene.id,id:'product-'+layer.motionIndex,key:layer.motionIndex,style:{...box(layer.box),translate:`${a.x}px ${a.y+float}px`,rotate:`${a.rotation+layer.rotation}deg`,scale:a.scale,opacity:a.opacity}},src?h(Img,{src,style:{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 18px 12px #0006)'}}):div({...font,fontSize:45,paddingTop:80},'ADICIONE A FOTO'))})
 return h(AbsoluteFill,{style:{opacity:exit}},...images,
 h(EditableElement,{props,scene:scene.id,id:'name',style:{...box(l.name),...font,display:'flex',justifyContent:'center',alignItems:'center',fontSize:fit(o.name.toUpperCase(),p?48:60,36),textShadow:'0 3px 0 #0008,0 5px 12px #0009'}},h(AnimatedRetailText,{text:o.name.toUpperCase(),mode:m.text,speed:m.speed})),
 h(EditableElement,{props,scene:scene.id,id:'price',style:{...box(l.price),translate:`${price.x}px ${price.y}px`,scale:price.scale,rotate:`${price.rotation}deg`,opacity:price.opacity}},h(Price,{props,r,price:o.price,unit:o.unit})),
 h(EditableElement,{props,scene:scene.id,id:'validity',style:{...box(l.validity),opacity:mix(f,4,8,0,1)}},h(DateLine,{props})),
 o.condition?h(EditableElement,{props,scene:scene.id,id:'condition',style:{...box(l.condition),...font,fontSize:fit(o.condition,26,55),textShadow:'0 2px 4px #000',opacity:price.opacity}},o.condition):null)
}
export function FlyerComposition(props:VideoRenderProps){
 const r=flyerRecipe(props.document.theme)!,d=props.document,{durationInFrames}=useVideoConfig(),f=useCurrentFrame(),m=motionSettings(d.motion),base=props.audioBase||'/video-studio/audio',fonts=props.fontBase||'/art-studio/fonts'
 useRetailFonts(fonts)
 const cue=(id:typeof m.accentSound,from:number,gain:number,key:string)=>h(Sequence,{key,from,durationInFrames:Math.min(durationInFrames-from,Math.ceil((SOUND_EFFECTS.find(s=>s.id===id)?.seconds||1)*30))},h(Audio,{src:base+'/'+soundAsset(id),volume:d.audio.effectsVolume*gain}))
 return h(AbsoluteFill,{style:{background:r.base,overflow:'hidden',opacity:mix(f,durationInFrames-5,durationInFrames,1,0)}},

 h(RetailCamera,{props},h(Backdrop,{props,r}),h(Identity,{props,r}),...props.scenes.filter(s=>s.id!=='intro').map(s=>h(Sequence,{key:s.id,from:s.from,durationInFrames:s.frames},s.id==='outro'?h(Ending,{props}):h(Offer,{props,r,scene:s,index:d.offers.findIndex(o=>o.id===s.id)})))),
 h(CatalogTransition,{props}),
 ...props.scenes.flatMap(s=>[s.audio&&d.voice.enabled?h(Sequence,{key:'voice'+s.id,from:s.from,durationInFrames:s.frames},h(Audio,{src:s.audio,volume:d.audio.voiceVolume})):null,...(d.audio.sounds&&s.id!=='intro'?[cue(m.transitionSound,s.from,.45,'swipe'+s.id),cue(m.accentSound,s.from+5,.65,'hit'+s.id)]:[])]),
 ...(d.audio.sounds?OPENING_SOUNDS.map(c=>cue(c.sound,c.frame,c.gain,'intro'+c.sound)):[]),
 ...(d.audio.sounds&&props.format==='horizontal'?[cue(m.transitionSound,Math.floor((props.scenes[1]?.from||60)*.48),.5,'logo-swipe')]:[]),
 props.music&&d.audio.music!=='none'?h(Audio,{src:props.music,loop:true,loopVolumeCurveBehavior:'extend',volume:(frame:number)=>musicGain(frame,durationInFrames,d,props.scenes)}):null)
}
