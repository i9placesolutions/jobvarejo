import {videoValidityText} from './validity'
import {productLayers} from './product-layout'
import {soundAsset} from './effect-catalog'
import {VideoBackgroundImage} from './background-image'
import {FlyerComposition} from './flyer-composition'
import {VideoAlcoholBadge} from './alcohol-badge'
import {flyerRecipe} from './flyer-recipes'
import { ShowcaseComposition,SocialIcon } from './showcase'
import { BroadcastComposition } from './broadcast'
import React, { createElement as h } from 'react'
import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { VIDEO_THEMES, displayPrice, type VideoRenderProps, type VideoScene } from './model'
const ease=(x:number)=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3)
const random=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)}
const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
function Atmosphere({doc}:{doc:VideoRenderProps['document']}){
 const f=useCurrentFrame(),{width,height}=useVideoConfig(),strength=doc.intensity
 const theme=VIDEO_THEMES.find(t=>t.id===doc.theme)!,effects=doc.effects
 const elements:React.ReactNode[]=[]
 if(effects.includes('rays'))elements.push(div({position:'absolute',inset:'-50%',background:`repeating-conic-gradient(from ${f*.025}deg, transparent 0deg 18deg, ${theme.accent}12 20deg 25deg, transparent 27deg 40deg)`,opacity:.7*strength}))
 if(effects.includes('smoke'))for(let i=0;i<7;i++)elements.push(div({position:'absolute',width:width*.8,height:height*.32,left:(i%2?width*.6:-width*.38)+Math.sin(f/70+i)*70,top:height*(.25+i*.09)+Math.cos(f/85+i)*50,borderRadius:'50%',background:`radial-gradient(ellipse, ${theme.accent}28, #cfd7df12 40%, transparent 70%)`,filter:'blur(35px)',opacity:strength*.7,transform:`scale(${1+Math.sin(f/80+i)*.15})`}))
 if(effects.includes('fire'))for(let i=0;i<12;i++)elements.push(div({position:'absolute',left:width*(i/11)-60,bottom:-120,width:width*.18,height:220+130*Math.sin(f/16+i),borderRadius:'65% 35% 0 0',background:'linear-gradient(0deg,#ffb72eee,#ee481e80,transparent)',filter:'blur(26px)',opacity:.6*strength,transform:`rotate(${Math.sin(f/19+i)*12}deg)`}))
 if(effects.includes('embers')||effects.includes('confetti'))for(let i=0;i<44;i++){const conf=effects.includes('confetti'),size=(conf?10:3)+random(i+4)*10;elements.push(div({position:'absolute',left:random(i)*width+Math.sin(f/45+i)*25,top:((random(i+200)*height+(conf?1:-1)*f*(1+random(i+8)*2))%height+height)%height,width:size,height:conf?size*2:size,borderRadius:conf?2:'50%',background:conf?['#ffce45','#f3e0ff','#ff657a','#9aeec5'][i%4]:theme.accent,boxShadow:conf?'none':`0 0 20px ${theme.accent}`,opacity:(.15+random(i+10)*.6)*strength,transform:`rotate(${f*2+i*17}deg)`}))}
 return h(AbsoluteFill,{style:{overflow:'hidden',pointerEvents:'none'}},...elements)
}
function Scene({scene,props}:{scene:VideoScene;props:VideoRenderProps}){
 const f=useCurrentFrame(),{width,height}=useVideoConfig(),d=props.document,t=VIDEO_THEMES.find(t=>t.id===d.theme)!,portrait=height>width
 const offer=d.offers.find(o=>o.id===scene.id),intro=scene.id==='intro',outro=scene.id==='outro'
 const enter=ease(f/20),exit=Math.min(1,(scene.frames-f)/10),strength=d.intensity
 const shake=d.effects.includes('shake')&&f<18?Math.sin(f*2.9)*Math.pow(1-f/18,2)*20*strength:0
 const bounce=d.effects.includes('bounce')?Math.sin(Math.min(f,30)/30*Math.PI)*-45*strength:0
 const zoom=d.effects.includes('zoom')?.78+.22*enter:1
 const pulse=d.effects.includes('pulse')?1+Math.sin(f/22)*.014*strength:1
 const media=(id:string)=>props.media[id] || ''
 const fit=(value:string,base:number,max:number)=>Math.max(base*.55,base*Math.min(1,Math.sqrt(max/Math.max(1,value.length))))
 const small=portrait?34:30
 const logo=d.brand.logo&&media(d.brand.logo)?h(Img,{src:media(d.brand.logo),style:{maxWidth:portrait?260:220,maxHeight:portrait?120:95,objectFit:'contain'}}):null
 const header=div({position:'absolute',top:portrait?140:58,left:portrait?70:85,right:portrait?70:85,display:'flex',alignItems:'center',justifyContent:'space-between',gap:35},div({display:'flex',alignItems:'center',gap:22},offer?null:logo,div({fontSize:fit(d.brand.name,portrait?43:37,30),fontWeight:800,maxWidth:portrait?(logo?450:710):1050,lineHeight:1.1,overflowWrap:'anywhere'},d.brand.name||'Sua empresa')),div({color:t.accent,fontSize:portrait?24:23,letterSpacing:3,fontWeight:700},'OFERTAS'))
 const campaignText=div({fontFamily:'VideoCondensed, sans-serif',fontWeight:800,lineHeight:.9,textTransform:'uppercase',fontSize:fit(d.campaign,intro?(portrait?175:180):(portrait?100:100),30),letterSpacing:-2,color:t.accent,textShadow:'0 4px 0 #8e552b, 0 12px 30px #0009',maxWidth:'100%',overflowWrap:'break-word'},d.campaign)
 const pro=d.theme==='impact' && d.campaign.trim().toLocaleUpperCase('pt-BR')==='FECHA MÊS'
 const campaign=pro?h(Img,{src:(props.templateBase||'/video-studio/templates')+'/fecha-mes-badge-v1.png',style:{width:intro||outro?(portrait?900:920):(portrait?430:280),height:intro||outro?440:(portrait?230:150),objectFit:'contain',maxWidth:'100%',filter:'drop-shadow(0 18px 22px #0008)',transform:`rotate(${Math.sin(f/35)*.7}deg)`}}):campaignText
 const footer=div({position:'absolute',bottom:portrait?65:65,left:portrait?75:offer?1050:85,right:portrait?75:85,textAlign:'center',borderTop:`1px solid ${t.accent}55`,paddingTop:22,display:'flex',flexDirection:'column',gap:10},offer?div({height:portrait?150:95,display:'flex',justifyContent:'center'},logo):null,offer?div({display:'flex',alignItems:'center',justifyContent:'center',gap:10,fontSize:fit(videoValidityText(d),small,80),fontWeight:700,color:'var(--video-validity-color, var(--video-text-color, white))'},h(SocialIcon,{kind:'calendar',size:28}),videoValidityText(d)):null,div({fontSize:fit([d.brand.address,d.brand.whatsapp,d.brand.instagram].filter(Boolean).join(' • '),small-3,100),color:'var(--video-contact-color, #e2dce2)',lineHeight:1.3},[d.brand.address,d.brand.whatsapp,d.brand.instagram].filter(Boolean).join(' • ')))
 let content:React.ReactNode
 if(intro||outro)content=div({position:'absolute',inset:portrait?'28% 8% 26%':'27% 12% 24%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:portrait?55:35,textAlign:'center',transform:`translateY(${(1-enter)*70}px) scale(${.92+.08*enter})`},div({border:`1px solid ${t.accent}77`,borderRadius:60,padding:'12px 32px',fontSize:portrait?29:27,letterSpacing:4,color:'#fff'},outro?'APROVEITE AS OFERTAS':'PREPARE-SE PARA ECONOMIZAR'),campaign,outro?div({fontSize:fit(d.brand.name,portrait?75:70,35),fontWeight:800,lineHeight:1.05},d.brand.name):div({fontSize:portrait?38:35,color:'#eee2df'},'Confira os destaques da nossa loja'))
 else if(offer){
  const [integer='0',cents='00']=displayPrice(offer.price).split(',')
  const name=div({color:'var(--video-name-color, var(--video-text-color, white))',fontFamily:'VideoCondensed, sans-serif',fontSize:fit(offer.name,portrait?85:60,48),fontWeight:800,lineHeight:1.05,textTransform:'uppercase',overflowWrap:'break-word'},offer.name)
  const price=div({color:'var(--video-price-color, white)',position:'relative',display:'inline-flex',alignItems:'center',gap:18,background:'#e3333e',border:'3px solid #ff7279',borderRadius:32,padding:portrait?'20px 42px':'22px 38px',boxShadow:'0 20px 70px #0005',overflow:'hidden'},div({fontSize:38,fontWeight:700,alignSelf:'flex-start',paddingTop:16},'R$'),div({fontFamily:'VideoCondensed, sans-serif',fontWeight:800,fontSize:fit(integer,portrait?158:154,5),lineHeight:.9},integer),div({display:'flex',flexDirection:'column',gap:8},div({fontFamily:'VideoCondensed, sans-serif',fontSize:74,fontWeight:800,lineHeight:1},','+cents),div({color:'var(--video-unit-color, white)',fontSize:fit(offer.unit,28,12),fontWeight:700,maxWidth:210},offer.unit)),d.effects.includes('glow')?div({position:'absolute',inset:0,background:'linear-gradient(110deg,transparent 30%,#ffffff40 48%,transparent 65%)',transform:`translateX(${((f%120)/120)*300-150}%)`}):null)
  const product=div({position:'relative',height:portrait?550:380,width:'100%',display:'flex',justifyContent:'center',alignItems:'center',transform:`translate(${shake}px,${bounce}px) scale(${zoom*pulse})`},div({position:'absolute',width:'80%',height:'80%',background:`radial-gradient(ellipse,${t.accent}22,transparent 65%)`,borderRadius:'50%'}),...productLayers([0,0,100,100],portrait,d.duplicateProducts!==false,offer.imageAspectRatio||1,offer.copies).map(layer=>h('div',{key:layer.motionIndex,style:{position:'absolute',left:layer.box[0]+'%',top:layer.box[1]+'%',width:layer.box[2]+'%',height:layer.box[3]+'%',rotate:layer.rotation+'deg'}},offer.image&&media(offer.image)?h(Img,{src:media(offer.image),style:{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 28px 28px #0008)'}}):div({fontSize:portrait?150:170,opacity:.3},'✦'))))
  content=portrait?div({position:'absolute',top:320,left:85,right:85,bottom:450,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-around',gap:22,textAlign:'center'},campaign,name,product,price,div({color:'var(--video-condition-color, var(--video-text-color, white))',fontSize:fit(offer.condition,30,75),lineHeight:1.2},offer.condition)):
   div({position:'absolute',top:225,left:100,right:100,bottom:330,display:'grid',gridTemplateColumns:'1fr 1fr',alignItems:'center',gap:90},div({display:'flex',flexDirection:'column',alignItems:'center',gap:22,textAlign:'center'},name,product),div({display:'flex',flexDirection:'column',gap:34,alignItems:'flex-start'},pro?campaign:div({fontSize:26,color:t.accent,fontWeight:700,letterSpacing:2},d.campaign),price,div({color:'var(--video-condition-color, var(--video-text-color, white))',fontSize:fit(offer.condition,28,75)},offer.condition)))
 }
 const transition=d.transition==='slide'?`translateX(${(1-enter)*width*.16}px)`:'none'
 return h(AbsoluteFill,{style:{opacity:Math.min(enter,exit),transform:transition,color:'var(--video-text-color, white)'}},header,content,footer,d.transition==='light'&&f<15?div({position:'absolute',inset:0,background:`linear-gradient(110deg,transparent,${t.accent}66,transparent)`,transform:`translateX(${(f/15)*220-110}%)`}):null,d.transition==='smoke'&&f<22?div({position:'absolute',inset:0,background:'radial-gradient(ellipse,#c9bbaaaa,transparent 75%)',opacity:1-f/22,filter:'blur(35px)'}):null)
}
export function VideoComposition(props:VideoRenderProps){if(props.document.motion){const base=props.audioBase||'/video-studio/audio';props={...props,impact:base+'/'+soundAsset(props.document.motion.accentSound),whoosh:base+'/'+soundAsset(props.document.motion.transitionSound)}}return h(AbsoluteFill,{style:{'--video-text-color':props.document.appearance?.textColor||'#ffffff',...Object.fromEntries(['name','price','currency','unit','condition','validity','contact'].map(key=>[`--video-${key}-color`,props.document.appearance?.[(key+'Color') as keyof NonNullable<typeof props.document.appearance>]]).filter(([,value])=>value))} as React.CSSProperties},flyerRecipe(props.document.theme)?h(FlyerComposition,props):props.document.theme==='impact'?h(props.document.layoutVersion===2?ShowcaseComposition:BroadcastComposition,props):h(ClassicComposition,props),h(VideoAlcoholBadge,props),props.voiceAudio&&props.document.voice.enabled?h(Audio,{src:props.voiceAudio,playbackRate:props.scenes[0]?.playbackRate||1,volume:props.document.audio.voiceVolume}):null)}
function ClassicComposition(props:VideoRenderProps){
 const d=props.document,theme=VIDEO_THEMES.find(t=>t.id===d.theme)!,{durationInFrames}=useVideoConfig()
 const fonts=props.fontBase||'/art-studio/fonts'
 const musicVolume=(frame:number)=>{let duck=1;for(const s of props.scenes){if(!s.audio&&!props.voiceAudio)continue;const start=s.from,end=s.from+(s.speechFrames||s.frames);const envelope=frame<start?Math.max(0,1-(start-frame)/10):frame<=end?1:Math.max(0,1-(frame-end)/15);duck=Math.min(duck,1-.72*envelope)}return d.audio.musicVolume*duck*Math.max(0,Math.min(1,frame/20,(durationInFrames-frame)/25))}
 return h(AbsoluteFill,{style:{background:`radial-gradient(ellipse at 50% 10%,${theme.accent}22,transparent 55%),linear-gradient(145deg,${theme.base},#080b12)`,fontFamily:'VideoBarlow, sans-serif',overflow:'hidden'}},h(VideoBackgroundImage,{props}),
  h('style',null,`@font-face{font-family:VideoBarlow;src:url('${fonts}/Barlow-Bold.ttf')}@font-face{font-family:VideoCondensed;src:url('${fonts}/BarlowCondensed-ExtraBold.ttf')}`),
  d.theme==='impact'?h(Img,{src:(props.templateBase||'/video-studio/templates')+'/fecha-mes-stage-v1.png',style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.88}}):null,
  h(Atmosphere,{doc:d}),
  ...props.scenes.map(s=>h(Sequence,{key:s.id,from:s.from,durationInFrames:s.frames},h(Scene,{scene:s,props}),s.audio&&d.voice.enabled?h(Audio,{src:s.audio,playbackRate:s.playbackRate||1,volume:d.audio.voiceVolume}):null,d.audio.sounds&&props.whoosh?h(Audio,{src:props.whoosh,volume:d.audio.effectsVolume*.55}):null,d.audio.sounds&&props.impact&&s.id!=='outro'?h(Sequence,{from:8},h(Audio,{src:props.impact,volume:d.audio.effectsVolume})):null)),
  props.music&&d.audio.music!=='none'?h(Audio,{src:props.music,loop:true,volume:musicVolume}):null)
}
