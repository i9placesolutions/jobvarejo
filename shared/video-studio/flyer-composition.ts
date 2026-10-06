import {musicStartFrame} from './music-tempo'
import {videoValidityText} from './validity'
import {personalizedRecipe} from './personalization'
import {CampaignAtmosphere} from './campaign-atmosphere'
import {BoomExplosion} from './boom-effects'
import {useRetailFonts} from './font-readiness'
import {videoBackground,backgroundAsset} from './backgrounds'
import React,{createElement as h} from 'react'
import {AbsoluteFill,Audio,Img,Sequence,Loop,OffthreadVideo,useCurrentFrame,useVideoConfig,interpolate,Easing} from 'remotion'
import {flyerRecipe,type FlyerRecipe,type LayoutBox} from './flyer-recipes'
import {Logo,Ending,RetailCamera,SocialIcon} from './showcase'
import {displayPrice,type VideoRenderProps,type VideoScene} from './model'
import {elementMotion} from './catalog-motion'
import {CatalogTransition,CatalogAtmosphere,AnimatedRetailText} from './catalog-effects'
import {motionSettings,soundAsset,SOUND_EFFECTS} from './effect-catalog'
import {musicGain,flyerSoundCues} from './sound-design'
import {VideoPriceLabel} from './label-renderer'
import {productLayers} from './product-layout'
import {EditableElement} from './editable-element'
import {fitReferenceHeader} from '../retail-reference-artwork'
import {ReferenceArtwork,referenceArtworkEndingProps} from './reference-artwork'
import {sceneStyle} from './scene-variation'
import {PriceAccentLayer,priceAccentScale,productFinishFilter} from './price-accents'
const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
const box=([left,top,width,height]:LayoutBox):React.CSSProperties=>({position:'absolute',left,top,width,height})
const font:React.CSSProperties={fontFamily:'ShowcaseCondensed',fontWeight:800,lineHeight:1.02,textAlign:'center',color:'var(--video-text-color, white)'}
const fit=(text:string,size:number,limit:number)=>Math.max(size*.48,size*Math.min(1,Math.sqrt(limit/Math.max(limit,text.length))))
const mix=(f:number,a:number,b:number,x:number,y:number)=>interpolate(f,[a,b],[x,y],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})
const random=(n:number)=>{const x=Math.sin(n*93.17+21)*42817;return x-Math.floor(x)}
function Backdrop({props,r}:{props:VideoRenderProps;r:FlyerRecipe}){
 const f=useCurrentFrame(),{width:w,height:ht,fps}=useVideoConfig(),intensity=props.document.intensity,kind=r.backgroundKind||r.id,seed=r.seed||0,items:React.ReactNode[]=[]
 const asset=(props.templateBase||'/video-studio/templates')+'/'+(props.format==='horizontal'?(r.backgroundHorizontal||r.background):r.background)
 // A arte de origem mantém suas cores; fundos alternativos exigem escolha explícita.
 const variant=r.backgroundVariant||0,chosen=videoBackground(props.document.background),energy=chosen?backgroundAsset(chosen.id,props.format):ht>w?(r.energyBackgroundVertical||r.energyBackground):r.energyBackground
 if(energy)items.push(h(Img,{key:'energy-art',src:(props.templateBase||'/video-studio/templates')+'/'+energy,style:{position:'absolute',inset:'-7%',width:'114%',height:'114%',objectFit:'cover',transform:`translate(${Math.sin(f/(28+variant*3))*18}px,${Math.cos(f/(36+variant*4))*20}px) scale(${1.04+Math.sin(f/45)*.035}) rotate(${Math.sin(f/70+variant)*.6}deg)`,opacity:1}}))
 // TV usa o clipe horizontal próprio quando a receita tem um; o vertical usa backgroundVideo.
 const bgVideo=props.format==='horizontal'&&r.backgroundVideoHorizontal?r.backgroundVideoHorizontal:r.backgroundVideo,bgVideoSeconds=props.format==='horizontal'&&r.backgroundVideoHorizontal?r.backgroundVideoHorizontalDuration:r.backgroundVideoDuration
 if(bgVideo&&!chosen){
  items.push(h(Loop,{key:'background-video',durationInFrames:Math.max(1,Math.round((bgVideoSeconds||12)*fps)),children:h(OffthreadVideo,{src:(props.templateBase||'/video-studio/templates')+'/'+bgVideo,muted:true,style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}})}))
  items.push(div({position:'absolute',inset:0,background:'rgba(20,5,0,.28)'}))
 }else if(r.background&&!chosen)items.push(h(Img,{key:'art',src:asset,style:{position:'absolute',inset:'-6%',width:'112%',height:'112%',objectFit:'cover',transform:`translate(${Math.sin(f/42)*14}px,${Math.cos(f/51)*18}px) scale(${1.02+Math.sin(f/65)*.025})`,opacity:1}}))
 items.push(div({position:'absolute',inset:0,background:`radial-gradient(ellipse at 50% 55%,transparent,${r.base}22 95%)`}))
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
 if(props.document.effects.includes('glow'))for(let i=0;i<(props.fastPreview?16:44);i++){const speed=4+random(i)*11;items.push(div({position:'absolute',left:random(i+99)*w,top:(random(i+80)*ht+f*speed)%(ht+80)-40,width:i%4?4:12,height:i%4?22:12,background:i%3?r.accent:'#fff',borderRadius:r.id==='saldao'?2:6,rotate:`${i*47+f*(i%2?3:-3)}deg`,opacity:(.15+random(i+6)*.4)*intensity,boxShadow:i%4?'none':`0 0 16px ${r.accent}`}))}
 return h(AbsoluteFill,{style:{background:r.backgroundGradient||r.base,overflow:'hidden'}},...items,h(CatalogAtmosphere,{props}),h(BoomExplosion,{props}),h(CampaignAtmosphere,{props}))
}
function DateLine({props,large=false}:{props:VideoRenderProps;large?:boolean}){const text=videoValidityText(props.document);if(!text)return null;return div({...font,display:'flex',alignItems:'center',justifyContent:'center',gap:9,height:'100%',fontSize:fit(text,large?42:30,large?40:68),color:'var(--video-validity-color, var(--video-text-color, white))',textShadow:props.document.appearance?.validityColor?'none':'0 2px 5px #000',lineHeight:1.2},h(SocialIcon,{kind:'calendar',size:large?35:22}),text)}
// Cores padrão da faixa (Sextou); receitas de outras paletas sobrescrevem via ribbonColors.
type RibbonColors={ribbon?:[string,string,string];edge?:string;pill?:[string,string,string];stockInk?:string}
const DEFAULT_RIBBON={ribbon:['#e8180e','#c80404','#9c0000'] as [string,string,string],edge:'#ff5a3c',pill:['#fff27a','#ffd91a','#f5b800'] as [string,string,string],stockInk:'#8a0000'}
// Faixa de validade dos encartes: calendário, "OFERTAS VÁLIDAS DE", data por extenso e pílula de estoque.
function ValidityRibbon({props,width,height,colors}:{props:VideoRenderProps;width:number;height:number;colors?:RibbonColors}){
 const c={...DEFAULT_RIBBON,...colors}
 const text=videoValidityText(props.document);if(!text)return null
 const match=/^ofertas válidas (de|em)\s+(.+)$/i.exec(text)
 const heading=match?`OFERTAS VÁLIDAS ${match[1]!.toLocaleUpperCase('pt-BR')}`:'OFERTAS VÁLIDAS'
 const date=(match?match[2]!:text).toLocaleUpperCase('pt-BR').replace(/\b(\d)\b/g,'0$1')
 const ribbonH=height*.68,pillH=height*.27,s=ribbonH/90,icon=ribbonH*.56
 const barlow:React.CSSProperties={fontFamily:'VideoBarlow',fontWeight:900,lineHeight:1,whiteSpace:'nowrap'}
 const textW=width-icon-46*s
 return div({width,height,display:'flex',flexDirection:'column',justifyContent:'space-between'},
  div({height:ribbonH,display:'flex',alignItems:'center',gap:14*s,padding:`0 ${18*s}px`,boxSizing:'border-box',borderRadius:ribbonH*.28,border:`${2.5*s}px solid ${c.edge}`,
   background:`linear-gradient(180deg,${c.ribbon[0]},${c.ribbon[1]} 55%,${c.ribbon[2]})`,boxShadow:`0 ${5*s}px ${12*s}px #50000080`,color:'#fff'},
   h(SocialIcon,{kind:'calendar',size:icon}),
   div({flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4*s,minWidth:0},
    div({...barlow,fontSize:Math.min(ribbonH*.27,textW/(heading.length*.62)),color:'#fff'},heading),
    div({...barlow,fontSize:Math.min(ribbonH*.42,textW/(date.length*.6)),color:'#ffe300',textShadow:`0 ${2*s}px 0 #46000099`},date))),
  div({height:pillH,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:pillH/2,background:`linear-gradient(180deg,${c.pill[0]},${c.pill[1]} 50%,${c.pill[2]})`,
   boxShadow:`0 ${2*s}px ${6*s}px #50000066`,...barlow,fontSize:Math.min(pillH*.56,width*.9/(28*.6)),color:c.stockInk},'ENQUANTO DURAREM OS ESTOQUES'))
}
function Identity({props,r}:{props:VideoRenderProps;r:FlyerRecipe}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,layout=p?r.vertical:r.horizontal,first=props.scenes[1]?.from||60,outro=props.scenes.at(-1)!.from,split=Math.floor(first*.48)
 const progress=mix(f,first-4,first+7,0,1),end=mix(f,outro-4,outro+5,0,1)
 const interpolateBox=(a:LayoutBox,b:LayoutBox,t:number)=>a.map((v,i)=>v+(b[i]!-v)*t) as unknown as LayoutBox
 const sealBox=interpolateBox(p?[95,190,890,1100]:[220,65,1480,900],layout.seal,progress)
 const referenceIntroBox=r.referenceArtwork?fitReferenceHeader(p?{x:40,y:75,width:1000,height:1240}:{x:95,y:45,width:1730,height:920},r.referenceArtwork):undefined
 const referenceOfferBox=r.referenceArtwork?fitReferenceHeader({x:layout.seal[0],y:layout.seal[1],width:layout.seal[2],height:layout.seal[3]},r.referenceArtwork):undefined
 const referenceBox=referenceIntroBox&&referenceOfferBox?interpolateBox([referenceIntroBox.x,referenceIntroBox.y,referenceIntroBox.width,referenceIntroBox.height], [referenceOfferBox.x,referenceOfferBox.y,referenceOfferBox.width,referenceOfferBox.height],progress):undefined
 const nativeLines=(r.nativeTitle||r.campaign).split('\n').flatMap(line=>line.length>10?line.split(' '):[line]),nativeSize=(width:number,height:number)=>Math.min(width/(Math.max(...nativeLines.map(line=>line.length))*.6),height/(nativeLines.length*1.08))
 const introContentHeight=r.nativeTitle?nativeSize(890,1100)*nativeLines.length*1.02:Math.min(1100,890/Math.max(.2,r.sealAspect||1))
 const introLogoTop=190+1100/2+introContentHeight/2+24
 const logoBox=interpolateBox(interpolateBox(p?[100,introLogoTop,880,390]:[410,240,1100,560],layout.logo,progress),p?[70,370,940,450]:[65,205,820,450],end)
 const sceneId=props.scenes.find(s=>f>=s.from&&f<s.from+s.frames)?.id||'intro'
 const seal=elementMotion(f-2,'slam',0,'fast'),logo=elementMotion(f-(p?13:split),'rise',0,'fast')
 const logoAlpha=mix(f,p?13:split,p?17:split+4,0,1),sealAlpha=seal.opacity*(1-end)*(p?1:progress+(1-progress)*(1-mix(f,split-3,split+2,0,1)))
 const mascotBox=p?r.mascotVertical:r.mascotHorizontal
 return h(AbsoluteFill,null,
 r.mascot&&mascotBox?div({position:'absolute',left:p?20:20,top:p?610:535,width:p?1040:650,height:p?34:28,opacity:progress*(1-end),borderTop:'6px solid #ffe197',borderBottom:'6px solid #63300d',borderRadius:5,background:'repeating-linear-gradient(2deg,#98531f 0px,#c1843d 4px,#e0aa5d 7px,#a76129 11px)',boxShadow:'0 12px 18px #0009'}):null,
 r.mascot&&mascotBox?h(EditableElement,{props,scene:sceneId,id:'mascot',style:{...box(mascotBox),opacity:progress*(1-end),translate:`0px ${Math.max(0,1-progress)*70}px`}},h(Img,{src:(props.templateBase||'/video-studio/templates')+'/'+r.mascot,style:{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center bottom'}})):null,
 r.referenceArtwork&&referenceBox
  ?h(React.Fragment,null,
   h(ReferenceArtwork,{props,recipe:r,frame:{x:referenceBox[0],y:referenceBox[1],width:referenceBox[2],height:referenceBox[3]},scene:sceneId,artOpacity:sealAlpha,identityOpacity:logoAlpha*(1-end),rotation:seal.rotation+Math.sin(f/39)*.65,scale:seal.scale,translateY:seal.y}),
   h(EditableElement,{props,scene:sceneId,id:'logo',style:{...box(logoBox),opacity:logoAlpha*end,scale:logo.scale,translate:`0px ${logo.y}px`}},h(Logo,{props,width:logoBox[2],height:logoBox[3]})))
  :h(React.Fragment,null,
   h(EditableElement,{props,scene:sceneId,id:'seal',style:{...box(sealBox),opacity:sealAlpha,scale:seal.scale,rotate:`${seal.rotation+Math.sin(f/39)*.65}deg`}},r.seal?h(Img,{src:(props.templateBase||'/video-studio/templates')+'/'+r.seal,style:{width:'100%',height:'100%',objectFit:'contain',filter:`drop-shadow(0 14px 12px #0006) brightness(${props.document.effects.includes('glow')?1+Math.max(0,Math.sin((f%95)/95*Math.PI))*.12*props.document.intensity:1})`}}):div({...font,fontSize:nativeSize(sealBox[2],sealBox[3]),height:'100%',display:'flex',alignItems:'center',justifyContent:'center',whiteSpace:'pre',color:r.nativeTitleColor||r.accent,textShadow:'0 5px #573205,0 10px #382003,0 18px 20px #0008'},nativeLines.join('\n'))),
   h(EditableElement,{props,scene:sceneId,id:'logo',style:{...box(logoBox),opacity:logoAlpha,scale:logo.scale,translate:`0px ${logo.y}px`}},h(Logo,{props,width:logoBox[2],height:logoBox[3]}))))
}
function Price({props,price,unit}:{props:VideoRenderProps;r:FlyerRecipe;price:string;unit:string}){
 return props.label?h(VideoPriceLabel,{label:props.label,price,unit,colors:props.document.appearance}):div({...font,fontSize:34,paddingTop:40},'SELECIONE UMA ETIQUETA')
}
function Offer({props,r,scene,index}:{props:VideoRenderProps;r:FlyerRecipe;scene:VideoScene;index:number}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,l=p?r.vertical:r.horizontal,d=props.document,o=d.offers[index]!,m=motionSettings(d.motion),src=props.media[o.image]
 // Modo variado: cada oferta tem entradas, acabamento e destaque próprios.
 const st=sceneStyle(d,index)
 const price=elementMotion(f-5,st.price,0,m.speed)
 const exit=mix(f,scene.frames-5,scene.frames,1,0),float=f>18&&d.effects.includes('pulse')?Math.sin(f/19)*5:0
 const layers=productLayers(l.product,p,d.duplicateProducts!==false,o.imageAspectRatio||1,o.copies)
 const images=layers.map(layer=>{const entrance=layer.motionIndex===2?'whip-right':st.product,a=elementMotion(f,entrance,layer.motionIndex,m.speed);return h(EditableElement,{props,scene:scene.id,id:'product-'+layer.motionIndex,key:layer.motionIndex,style:{...box(layer.box),translate:`${a.x}px ${a.y+float}px`,rotate:`${a.rotation+layer.rotation}deg`,scale:a.scale,opacity:a.opacity}},src?h(Img,{src,style:{width:'100%',height:'100%',objectFit:'contain',filter:productFinishFilter(st.finish,r.accent,a.progress)}}):div({...font,fontSize:45,paddingTop:80},'ADICIONE A FOTO'))})
 return h(AbsoluteFill,{style:{opacity:exit}},...images,
 h(EditableElement,{props,scene:scene.id,id:'name',style:{...box(l.name),...font,color:'var(--video-name-color, var(--video-text-color, white))',display:'flex',justifyContent:'center',alignItems:'center',fontSize:fit(o.name.toUpperCase(),p?42:48,p?30:38),padding:'8px 12px',boxSizing:'border-box',borderRadius:18,background:'linear-gradient(90deg,transparent,#000b 15%,#000b 85%,transparent)',textShadow:'0 3px 0 #0008,0 5px 12px #0009'}},h(AnimatedRetailText,{text:o.name.toUpperCase(),mode:st.text,speed:m.speed})),
 h(EditableElement,{props,scene:scene.id,id:'price',style:{...box(l.price),translate:`${price.x}px ${price.y}px`,scale:price.scale*priceAccentScale(st.priceAccent,f),rotate:`${price.rotation}deg`,opacity:price.opacity}},h(PriceAccentLayer,{kind:st.priceAccent,frame:f,width:l.price[2],height:l.price[3],accent:r.accent,layer:'back'}),div({position:'relative',width:'100%',height:'100%'},h(Price,{props,r,price:o.price,unit:o.unit})),h(PriceAccentLayer,{kind:st.priceAccent,frame:f,width:l.price[2],height:l.price[3],accent:r.accent,layer:'front'})),
 h(EditableElement,{props,scene:scene.id,id:'validity',style:{...box(l.validity),opacity:mix(f,4,8,0,1)}},r.validityStyle==='ribbon'?h(ValidityRibbon,{props,width:l.validity[2],height:l.validity[3],colors:r.ribbonColors}):h(DateLine,{props})),
 o.condition?h(EditableElement,{props,scene:scene.id,id:'condition',style:{...box(l.condition),...font,color:'var(--video-condition-color, var(--video-text-color, white))',fontSize:fit(o.condition,26,55),textShadow:'0 2px 4px #000',opacity:price.opacity}},o.condition):null)
}
export function FlyerComposition(props:VideoRenderProps){
 const r=personalizedRecipe(flyerRecipe(props.document.theme)!,props.document),d=props.document,{durationInFrames}=useVideoConfig(),f=useCurrentFrame(),m=motionSettings(d.motion),base=props.audioBase||'/video-studio/audio',fonts=props.fontBase||'/art-studio/fonts'
 const endingProps=referenceArtworkEndingProps(props,Boolean(r.referenceArtwork))
 useRetailFonts(fonts)
 const cue=(id:typeof m.accentSound,from:number,gain:number,key:string)=>h(Sequence,{key,from,durationInFrames:Math.min(durationInFrames-from,Math.ceil((SOUND_EFFECTS.find(s=>s.id===id)?.seconds||1)*30))},h(Audio,{src:base+'/'+soundAsset(id),volume:d.audio.effectsVolume*gain}))
 return h(AbsoluteFill,{style:{background:r.base,overflow:'hidden',opacity:mix(f,durationInFrames-5,durationInFrames,1,0)}},

 h(RetailCamera,{props},h(Backdrop,{props,r}),h(Identity,{props,r}),...props.scenes.filter(s=>s.id!=='intro').map(s=>h(Sequence,{key:s.id,from:s.from,durationInFrames:s.frames},s.id==='outro'?h(Ending,{props:endingProps}):h(Offer,{props,r,scene:s,index:d.offers.findIndex(o=>o.id===s.id)})))),
 h(CatalogTransition,{props}),
 ...props.scenes.map(s=>s.audio&&d.voice.enabled?h(Sequence,{key:'voice'+s.id,from:s.from,durationInFrames:s.frames},h(Audio,{src:s.audio,playbackRate:s.playbackRate||1,volume:d.audio.voiceVolume})):null),
 ...flyerSoundCues(d,props.scenes,props.format).filter(c=>c.frame<durationInFrames).map(c=>cue(c.sound,c.frame,c.gain,c.key)),
 props.music&&d.audio.music!=='none'?h(Audio,{src:props.music,loop:true,loopVolumeCurveBehavior:'extend',startFrom:musicStartFrame(d.audio.music,d.beatSync),volume:(frame:number)=>musicGain(frame,durationInFrames,d,props.scenes)}):null)
}
