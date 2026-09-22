import {videoValidityText} from './validity'
import {productLayers} from './product-layout'
import {VideoBackgroundImage} from './background-image'
import {personalizedRecipe} from './personalization'
import {EditableElement} from './editable-element'
import {StickerLogo} from './sticker-logo'
import {OPENING_SOUNDS, musicGain} from './sound-design'
import React, {createElement as h} from 'react'
import {AbsoluteFill, Audio, Img, CanvasImage, Sequence, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import {displayPrice, type VideoRenderProps, type VideoScene} from './model'
import {VideoPriceLabel} from './label-renderer'
import {retailEntrance, retailExit} from './retail-motion'
import {elementMotion,cameraMotion,transitionMotion} from './catalog-motion'
import {motionSettings,soundAsset,SOUND_EFFECTS} from './effect-catalog'
import {CatalogAtmosphere,CatalogTransition,AnimatedRetailText} from './catalog-effects'
import {productEffects} from './native-effects'
import {flyerRecipe} from './flyer-recipes'

const div=(style:React.CSSProperties,...children:React.ReactNode[])=>h('div',{style},...children)
const box=(left:number,top:number,width:number,height?:number):React.CSSProperties=>({position:'absolute',left,top,width,height})
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const}
const curve=Easing.bezier(.16,1,.3,1)
const mix=(f:number,a:number,b:number,x:number,y:number)=>interpolate(f,[a,b],[x,y],{...clamp,easing:curve})
const rand=(i:number)=>{const x=Math.sin(i*91.17+37.4)*41789.43;return x-Math.floor(x)}
const type:React.CSSProperties={fontFamily:'ShowcaseCondensed',fontWeight:800,lineHeight:1.02,color:'var(--video-text-color, #fff)',textAlign:'center'}
const fit=(s:string,max:number,limit:number)=>Math.max(max*.55,Math.min(max,max*Math.sqrt(limit/Math.max(limit,s.length))))
const line=(text:string,x:number,y:number,w:number,size:number,style:React.CSSProperties={})=>div({...box(x,y,w),...type,fontSize:size,...style},text)
const phone=(v:string)=>{const n=v.replace(/\D/g,'');return n.length===11?`${n.slice(0,2)} ${n.slice(2,7)} ${n.slice(7)}`:n.length===10?`${n.slice(0,2)} ${n.slice(2,6)} ${n.slice(6)}`:v}

export function SocialIcon({kind,size=70}:{kind:'instagram'|'whatsapp'|'pin'|'phone'|'web'|'calendar';size?:number}){
 const paths:Record<string,string>={calendar:'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M7 2v4 M17 2v4 M3 10h18 M7 14h2 M12 14h2 M7 18h2',instagram:'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 6h.01',whatsapp:'M20 11.5a8.5 8.5 0 0 1-12.7 7.4L2 21l2.1-5.3A8.5 8.5 0 1 1 20 11.5 M8 7.8c.6 3.2 3 5.6 6.2 6.3l1.2-1.6 2 1.1c-.2 1.7-1.1 2.5-2.5 2.3C10.1 15.2 6.3 11.7 6 8c-.1-1.3.8-2 2-2l1 2-1 1',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',phone:'M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 2-2 3-4 2C10 19 5 14 3 7c-1-2 0-4 2-4z',web:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c5 6 5 14 0 20 M12 2c-5 6-5 14 0 20'}
 return h('svg',{viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round',style:{flexShrink:0,overflow:'visible'}},h('path',{d:paths[kind]}))
}

export function Logo({props,width,height}:{props:VideoRenderProps;width:number;height:number}){
 const src=props.media[props.document.brand.logo],sticker=props.document.brand.logoStyle!=='clean'
 const style:React.CSSProperties={width:'100%',height:'100%',objectFit:'contain',filter:sticker?'drop-shadow(0 8px 6px #001b1b60)':'none'}
 return src?div({width,height,display:'flex',justifyContent:'center',alignItems:'center'},sticker?h(StickerLogo,{src,style}):h(Img,{src,style})):
 div({...type,fontSize:fit(props.document.brand.name,92,22),height,display:'grid',placeItems:'center',textShadow:'0 4px 8px #001d14'},props.document.brand.name)
}
function Badge({props,width,height}:{props:VideoRenderProps;width:number;height:number}){
 return props.document.campaign.trim().toLocaleUpperCase('pt-BR')==='FECHA MÊS'?h(Img,{src:(props.templateBase||'/video-studio/templates')+'/fecha-mes-emerald-v2.png',style:{width,height,objectFit:'contain',filter:'drop-shadow(0 16px 12px #001e1ca0)'}}):div({width,height,display:'grid',placeItems:'center',...type,fontSize:fit(props.document.campaign,180,18),color:'#ffda35',textShadow:'0 6px #8c5810, 0 12px #503008, 0 18px 18px #0008'},props.document.campaign)
}

// A cena permanece viva entre as ofertas; curvas e partículas dependem apenas do frame.
function Environment({props}:{props:VideoRenderProps}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),d=props.document,items:React.ReactNode[]=[]
 for(let i=0;i<6;i++)items.push(div({...box(-w*.3+Math.sin(f/50+i)*w*.15,ht*(i/6)-80,w*1.5,ht*.6),background:`radial-gradient(ellipse,${i%2?'#9fc63525':'#103c3033'},transparent 66%)`,rotate:`${i*28+f*.045}deg`,scale:1+Math.sin(f*.023+i)*.13}))
 if(d.effects.includes('smoke'))for(let i=0;i<4;i++)items.push(div({...box((i%2?w*.7:-w*.45)+Math.sin(f/45+i)*90,((i*.27*ht+f*(i%2?2:-1.4))%(ht*1.5))-ht*.2,w*.85,ht*.8),borderRadius:'50%',background:'radial-gradient(ellipse,#a8c28c30,transparent 64%)',filter:'blur(30px)',opacity:d.intensity}))
 if(d.effects.includes('rays'))for(let i=0;i<5;i++)items.push(div({...box(w*.1+i*w*.2+Math.sin(f/30+i)*60,-ht*.4,55,ht*1.9),rotate:`${24+Math.sin(f/80+i)*8}deg`,background:'linear-gradient(90deg,transparent,#e5ffe214,transparent)',filter:'blur(13px)',opacity:.5*d.intensity}))
 if(d.effects.includes('embers'))for(let i=0;i<125;i++){const near=i%10===0;items.push(div({...box(rand(i)*w+Math.sin(f/38+i)*35,ht-((rand(i+1)*ht+f*(near?34:12+rand(i+6)*16))%(ht+150)),near?7:3,near?65:14+rand(i+7)*22),rotate:'18deg',borderRadius:5,background:'linear-gradient(#fffcc2,#ecba23,transparent)',filter:near?'blur(2px)':'none',opacity:(.15+rand(i+12)*.7)*d.intensity}))}
 if(d.effects.includes('confetti'))for(let i=0;i<20;i++)items.push(div({...box(rand(i+300)*w,(rand(i)*ht+f*4)%ht,10,20),background:['#ffdd36','#d0f074','#ffffff'][i%3],rotate:`${f*2+i*32}deg`,opacity:.55*d.intensity}))
 // Fragmentos e linhas de velocidade em planos distintos, com ciclos contínuos.
 if(d.effects.includes('embers'))for(let i=0;i<24;i++){
  const x=rand(i+800)*w,y=(rand(i+820)*ht+f*(10+rand(i+840)*20))%(ht+160)-80
  items.push(div({...box(x,y,7+rand(i+860)*14,12+rand(i+880)*30),background:i%3?'linear-gradient(135deg,#ffe77d,#a85c0b)':'linear-gradient(135deg,#efffc6,#5eab40)',clipPath:'polygon(10% 0,100% 28%,67% 100%,0 75%)',rotate:`${i*27+f*(i%2?5:-4)}deg`,opacity:.3+d.intensity*.3,filter:i%5===0?'blur(2px)':'none'}))
 }
 if(d.effects.includes('rays'))items.push(div({position:'absolute',inset:-w*.4,background:'repeating-conic-gradient(from 0deg at 50% 45%,transparent 0deg 18deg,#c9fa6520 19deg,transparent 21deg 36deg)',rotate:`${f*.45}deg`,opacity:.75,maskImage:'radial-gradient(ellipse,transparent 18%,#000 78%)'}))
 if(d.effects.includes('glow'))items.push(div({...box(w*(.25+Math.sin(f/48)*.1),ht*.36,w*.8,ht*.55),background:'radial-gradient(ellipse,#caff3024,transparent 65%)',opacity:.5+Math.sin(f/35)*.15,mixBlendMode:'screen'}))
 if(d.effects.includes('fire'))items.push(h(Img,{key:'fire',src:(props.templateBase||'/video-studio/templates')+'/impact-fire-v2.png',style:{position:'absolute',width:w*1.2,height:ht*.45,left:-w*.1,bottom:-ht*.19+Math.sin(f/13)*22,objectFit:'cover',mixBlendMode:'screen',opacity:d.intensity*.55,maskImage:'linear-gradient(transparent,#000)',scale:1+Math.sin(f/17)*.04}}))
 // Trilhos de luz e arcos em profundidade, longe do miolo do produto/preço.
 if(d.effects.includes('rays')){
  for(let i=0;i<2;i++)items.push(div({...box(-w*.25,ht*(i?.92:.18),w*1.5,62),rotate:`${i?14:-14}deg`,borderTop:'2px solid #d4f77745',borderBottom:'2px solid #78b74760',background:'linear-gradient(#031f26bb,#1a4736aa,#031f26bb)',boxShadow:'0 0 32px #93db4d30',overflow:'hidden'},...Array.from({length:23},(_,n)=>div({...box(((n*100+f*(i?-30:30))%(w*1.5+160))-80,18,26,26),borderTop:'6px solid #dcff72',borderRight:'6px solid #dcff72',rotate:'45deg',opacity:.65,filter:'drop-shadow(0 0 7px #b5ff53)'}))))
  for(let i=0;i<3;i++)items.push(div({...box(w*(i===1?.73:-.52),ht*(i*.4-.12),w*.95,w*.95),borderRadius:'50%',border:`${i===1?5:3}px solid #afd96b35`,borderLeftColor:'#edff9c88',borderBottomColor:'transparent',rotate:`${f*(i%2?-1.6:1.2)+i*40}deg`,boxShadow:'inset 0 0 35px #87d04410'}))
 }
 // Moedas em planos próximos às bordas, sem competir com a descrição.
 for(let i=0;i<4;i++){const x=(i%2?w*.98:-w*.005)+Math.sin(f/20+i)*26,y=ht*(.16+i*.24)+Math.sin(f/26+i)*52;items.push(div({...box(x-55,y,110,110),borderRadius:'50%',border:'5px solid #d7e280',background:'radial-gradient(circle at 35% 25%,#95c76d,#197052 60%,#074935)',boxShadow:'inset 0 0 0 5px #114a2e,0 8px 0 #062e20',...type,fontSize:70,color:'#f8df69',display:'grid',placeItems:'center',rotate:`${i*23-15+Math.sin(f/23)*18}deg`,filter:i===3?'blur(2px)':'none',opacity:.8},i%2?'%':'$'))}
 return h(AbsoluteFill,{style:{background:'radial-gradient(ellipse at 49% 58%,#83ad20 0%,#396624 40%,#173b25 76%,#0b271e 100%)',overflow:'hidden'}},h(VideoBackgroundImage,{props}),...items,props.document.motion?h(CatalogAtmosphere,{props}):null,div({position:'absolute',inset:0,background:'radial-gradient(ellipse,transparent 38%,#02180c77 100%)'}))
}

function Validity({props,opening=false,compact=false}:{props:VideoRenderProps;opening?:boolean;compact?:boolean}){
 const v=videoValidityText(props.document),demo=/demonstra|ilustrativ/i.test(v)
 if(!v)return null
 if(compact)return div({...type,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:fit(v,20,52),lineHeight:1.15,color:'var(--video-validity-color, #edf4d5)',padding:'5px 10px',textShadow:'0 1px 3px #082717'},h(SocialIcon,{kind:'calendar',size:20}),v)
 if(!opening)return div({display:'flex',alignItems:'center',justifyContent:'center',gap:13,...type,color:'var(--video-validity-color, #f4f8d2)',padding:'12px 22px',borderRadius:18,background:'#092b2470',border:'1px solid #d4eb8133'},h(SocialIcon,{kind:'calendar',size:34}),div({textAlign:'left'},!demo&&!/^ofertas válidas/i.test(v)?div({fontSize:18,letterSpacing:1.5,color:'#dbeaa2',marginBottom:5},'OFERTAS VÁLIDAS'):null,div({fontSize:fit(v,32,36),lineHeight:1.13},v)))
 return div({...type},!demo&&!/^ofertas válidas/i.test(v)?div({fontSize:30,color:'var(--video-text-color, #fff)'},'OFERTAS VÁLIDAS'):null,div({fontSize:fit(v,46,36),color:'var(--video-text-color, #fff)',marginTop:8},v),!demo?div({fontSize:24,color:'#e2ed74',marginTop:14},'OU ENQUANTO DURAREM OS ESTOQUES'):null)
}

function Identity({props}:{props:VideoRenderProps}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,first=props.scenes[1]?.from||70,outro=props.scenes.at(-1)!.from
 const split=Math.floor(first*.48),swap=p?0:mix(f,split-4,split+2,0,1)
 const move=mix(f,first-5,first+5,0,1),ending=mix(f,outro-5,outro+7,0,1)
 const intro=retailEntrance(f,p?12:split).scale,settle=retailEntrance(f,4).scale
 const blend=(a:number,b:number,c:number)=>a+(b-a)*move+(c-b)*ending
 const logo=p?{x:blend(45,115,70),y:blend(1180,1555,370),w:blend(990,850,940),h:blend(480,200,450)}:{x:blend(400,70,65),y:blend(225,775,205),w:blend(1120,630,820),h:blend(630,175,450)}
 const badge=p?{x:blend(20,145,145),y:blend(190,170,160),w:blend(1040,790,790),h:blend(1140,695,695)}:{x:blend(455,110,110),y:blend(30,170,170),w:blend(1010,540,540),h:blend(980,610,610)}
 const logoOpacity=mix(f,p?12:split,p?16:split+4,0,1)
 const badgeOpacity=(1-ending)*mix(f,4,9,0,1)*(p?1:(1-move)*(1-swap)+move)
 return h(AbsoluteFill,{style:{pointerEvents:'none'}},
  div({...box(badge.x,badge.y,badge.w,badge.h),translate:`0px ${(1-settle)*230}px`,scale:settle*(1+(p?0:swap*(1-move)*.14)),rotate:`${(1-settle)*-9+Math.sin(f/65)*.75}deg`,opacity:badgeOpacity},h(Badge,{props,width:badge.w,height:badge.h})),
  div({...box(logo.x,logo.y,logo.w,logo.h),translate:`0px ${(1-intro)*120}px`,scale:intro,opacity:logoOpacity},h(Logo,{props,width:logo.w,height:logo.h})),
  !p&&f>=split-3&&f<split+5?div({position:'absolute',inset:0,background:'#e9ffb7',mixBlendMode:'screen',opacity:Math.max(0,1-Math.abs(f-split)/4)*.22}):null)
}

function Price({props,price,unit}:{props:VideoRenderProps;price:string;unit:string}){
 if(props.label)return h(VideoPriceLabel,{label:props.label,price,unit,colors:props.document.appearance})
 const [integer,cents]=displayPrice(price).split(',')
 return div({boxSizing:'border-box',width:'100%',height:'100%',borderRadius:'50%',padding:16,background:'linear-gradient(145deg,#edf899,#87bf4c 22%,#235d36 44%,#d6ed89 71%,#588b35)',boxShadow:'0 14px 14px #072d213f'},div({boxSizing:'border-box',height:'100%',borderRadius:'50%',border:'4px solid #b4dc65',background:'radial-gradient(circle at 35% 25%,#9bd02e,#64a223 63%,#2e6a26)',boxShadow:'inset 0 0 20px #123f3655',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',...type},div({fontSize:43,color:'var(--video-currency-color, #f4ffdf)',marginTop:-8},'R$'),div({display:'flex',justifyContent:'center',alignItems:'baseline',color:'var(--video-price-color, #fff22b)',marginTop:9,textShadow:'0 3px 1px #4a762322'},div({fontSize:Math.min(230,485/Math.max(2,integer!.length)),lineHeight:.96,letterSpacing:-6},integer),div({display:'flex',flexDirection:'column',alignSelf:'stretch',justifyContent:'center',marginLeft:2},div({fontSize:94,lineHeight:.9},','+cents),div({fontSize:32,color:'var(--video-unit-color, #f4ffdb)',textAlign:'right',marginTop:21},unit||'UN')))))
}

function Product({props,scene,index}:{props:VideoRenderProps;scene:VideoScene;index:number}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,offer=props.document.offers[index]!,src=props.media[offer.image],d=props.document
 const m=motionSettings(d.motion),exit=retailExit(f,scene.frames),a=elementMotion(f,m.product,0,m.speed),price=elementMotion(f-5,m.price,0,m.speed),copy=elementMotion(f,m.product,1,m.speed)
 const product=p?{x:55,y:840,w:590,h:755}:{x:735,y:210,w:610,h:700}
 const layers=productLayers([product.x,product.y,product.w,product.h],p,d.duplicateProducts!==false,offer.imageAspectRatio||1,offer.copies)
 const float=f>16&&d.effects.includes('pulse')?Math.sin((f-16)/22)*4:0
 const imageStyle:React.CSSProperties={width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 19px 14px #002c2066)'}
 const productImage=src?(d.motion&&m.finish!=='clean'?h(CanvasImage,{src,width:650,height:850,fit:'contain',effects:productEffects(f,m.finish,d.intensity),style:imageStyle}):h(Img,{src,style:imageStyle})):div({...imageStyle,...type,fontSize:45,display:'grid',placeItems:'center'},'ADICIONE A FOTO')
 const name=offer.name.toLocaleUpperCase('pt-BR'),weight=name.match(/\s+(\d+(?:[.,]\d+)?\s*(?:KG|G|ML|L))$/),title=weight?name.slice(0,-weight[0].length):name
 return h(AbsoluteFill,{style:{opacity:exit.opacity,scale:exit.scale,filter:exit.blur?`blur(${exit.blur}px)`:undefined,pointerEvents:'none'}},
 div({...box(p?85:70,p?1780:975,p?910:630),opacity:mix(f,4,9,0,1)},h(Validity,{props,compact:true})),
 ...layers.map(layer=>{const motion=elementMotion(f,m.product,layer.motionIndex,m.speed);return h('div',{key:layer.motionIndex,style:{...box(...layer.box),translate:`${motion.x}px ${motion.y+float}px`,rotate:`${layer.rotation+motion.rotation}deg`,scale:d.effects.includes('zoom')?motion.scale:1,opacity:motion.opacity}},productImage)}),
 div({...box(p?660:715,p?880:60,p?350:650,p?245:120),...type,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:13,color:'var(--video-name-color, var(--video-text-color, white))',fontSize:fit(title,p?64:50,26),textShadow:'0 3px 0 #164b25,0 7px 9px #16371760',},h(AnimatedRetailText,{text:title,mode:m.text,speed:m.speed}),weight?div({fontSize:p?43:30,color:'#e8f7ad',lineHeight:1,letterSpacing:1},weight[1]):null),
 div({...box(p?610:1325,p?1150:485,p?380:445,p?395:445),translate:`${price.x}px ${price.y}px`,scale:price.scale,rotate:`${price.rotation}deg`,opacity:price.opacity},h(Price,{props,price:offer.price,unit:offer.unit}),f>=8&&f<19?div({position:'absolute',inset:-20,border:'4px solid #eaff9755',borderRadius:'50%',scale:1+(f-8)*.035,opacity:(19-f)/11,pointerEvents:'none'}):null),
 offer.condition?line(offer.condition,p?600:1310,p?1590:950,p?430:470,p?29:28,{color:'var(--video-condition-color, #f8ffd2)',opacity:price.opacity}):null)
}

export function Ending({props}:{props:VideoRenderProps}){
 const f=useCurrentFrame(),{width:w,height:ht}=useVideoConfig(),p=ht>w,b=props.document.brand
 const sourceRecipe=flyerRecipe(props.document.theme),recipe=sourceRecipe?personalizedRecipe(sourceRecipe,props.document):undefined,accent=recipe?.emptyOutroSeal?recipe.accent:'#deeda5'
 const socials=[...(b.instagram?[{kind:'instagram' as const,value:b.instagram.startsWith('@')?b.instagram:'@'+b.instagram}]:[]),...(b.facebook?[{kind:'web' as const,value:b.facebook}]:[])]
 const phones=[b.whatsapp,...(b.whatsappNumbers||[])].filter(Boolean)
 const addresses=[b.address,...(b.addresses||[])].filter(Boolean)
 const extras=[b.website,b.phone,b.hours,b.paymentNotes,b.slogan].filter((v):v is string=>!!v)
 if(recipe?.emptyOutroSeal&&recipe.seal&&!socials.length&&!phones.length&&!addresses.length&&!extras.length){
  const enter=retailEntrance(f,3,.015)
  return h(AbsoluteFill,null,h(EditableElement,{props,scene:'outro',id:'seal',style:{...box(p?155:1030,p?860:230,p?770:710,p?680:620),opacity:enter.opacity,scale:enter.scale}},h(Img,{src:(props.templateBase||'/video-studio/templates')+'/'+recipe.seal,style:{width:'100%',height:'100%',objectFit:'contain'}})))
 }
 const x=p?65:895,width=p?950:910
 const row=(delay:number,y:number,children:React.ReactNode)=>{const enter=retailEntrance(f,delay,.015);return h(EditableElement,{props,scene:'outro',id:delay===3?'outro-social':delay===7?'outro-phone':'outro-address',style:{...box(x,y,width),opacity:enter.opacity,translate:`0px ${enter.travel*45}px`,scale:.94+.06*enter.scale}},children)}
 const pill=(txt:string)=>div({...type,fontSize:p?34:30,color:recipe?.emptyOutroSeal?accent:'#f4f47a',padding:'14px 25px',background:recipe?.emptyOutroSeal?'#18131199':'#174e3655',borderRadius:40,width:'fit-content',margin:'0 auto'},txt)
 const socialY=p?940:240,phoneY=p?1175:460,addressY=p?1490:745
 return h(AbsoluteFill,null,
 socials.length?row(3,socialY,div({},pill('SIGA-NOS NAS REDES SOCIAIS'),...socials.map(s=>div({display:'flex',justifyContent:'center',alignItems:'center',gap:17,marginTop:20,...type,color:'var(--video-contact-color, var(--video-text-color, white))',fontSize:fit(s.value,p?55:51,30)},div({display:'grid',placeItems:'center',padding:10,borderRadius:17,background:recipe?.emptyOutroSeal?'#181311':s.kind==='instagram'?'linear-gradient(35deg,#ffc662,#dc327d,#6f4bcb)':'#237047'},h(SocialIcon,{kind:s.kind,size:46})),s.value)))):null,
 phones.length?row(7,phoneY,div({},pill('SALVE NOSSO CONTATO PARA RECEBER AS OFERTAS'),...phones.map((v,i)=>div({display:'flex',justifyContent:'center',alignItems:'center',gap:17,marginTop:i?12:22,...type,color:'var(--video-contact-color, var(--video-text-color, white))',fontSize:fit(phone(v),i?54:p?112:98,17)},div({color:recipe?.emptyOutroSeal?accent:'#d8ffa1'},h(SocialIcon,{kind:'whatsapp',size:i?50:90})),phone(v))))):null,
 row(11,addressY,div({},div({height:3,background:accent,width:170,margin:'0 auto 28px'}),...addresses.map(a=>div({display:'flex',justifyContent:'center',alignItems:'center',gap:12,margin:'10px auto',...type,color:'var(--video-contact-color, var(--video-text-color, white))',fontSize:fit(a,p?37:34,63),lineHeight:1.13},h(SocialIcon,{kind:'pin',size:40}),a)),...extras.map(v=>div({...type,fontSize:p?30:27,marginTop:13,color:props.document.appearance?.contactColor||(recipe?.emptyOutroSeal?'#fff8ed':'#e0efc9')},v)))))
}

export function RetailCamera({props,children}:{props:VideoRenderProps;children?:React.ReactNode}){
 const f=useCurrentFrame(),d=props.document
 if(props.editor?.enabled)return h(AbsoluteFill,null,children)
 const current=props.scenes.find(s=>f>=s.from&&f<s.from+s.frames)!,local=f-current.from
 const closest=props.scenes.slice(1).find(s=>f>=s.from-5&&f<=s.from+9)
 const t=transitionMotion(closest?f-closest.from:99,d.transition)
 const mode=d.effects.includes('shake')?motionSettings(d.motion).camera:'none'
 const split=Math.floor((props.scenes[1]?.from||70)*.48)
 const impactFrame=props.format==='horizontal'&&current.id==='intro'&&f>=split?f-split:local
 const hit=cameraMotion(f,impactFrame,mode,d.intensity)
 return h(AbsoluteFill,{style:{transform:`translate(${hit.x+t.x}px,${hit.y+t.y}px) rotate(${hit.rotation+t.rotation}deg) scale(${1.045+hit.zoom+t.zoom})`,filter:t.blur?`blur(${t.blur}px)`:undefined,transformOrigin:'50% 50%'}},children)
}

export function ShowcaseComposition(props:VideoRenderProps){
 const frame=useCurrentFrame(),{durationInFrames}=useVideoConfig(),d=props.document,fonts=props.fontBase||'/art-studio/fonts'
 const exit=mix(frame,durationInFrames-6,durationInFrames,1,0)
 return h(AbsoluteFill,{style:{overflow:'hidden',background:'#143d26',opacity:exit}},
 h('style',null,`@font-face{font-family:ShowcaseCondensed;src:url('${fonts}/BarlowCondensed-ExtraBold.ttf')}@font-face{font-family:VideoCondensed;src:url('${fonts}/BarlowCondensed-ExtraBold.ttf')}@font-face{font-family:VideoBarlow;src:url('${fonts}/Barlow-ExtraBold.ttf')}`),
 h(RetailCamera,{props},h(Environment,{props}),h(Identity,{props}),
 ...props.scenes.filter(s=>s.id!=='intro').map(s=>h(Sequence,{key:'visual-'+s.id,from:s.from,durationInFrames:s.frames},s.id==='outro'?h(Ending,{props}):h(Product,{props,scene:s,index:d.offers.findIndex(o=>o.id===s.id)})))),
 h(CatalogTransition,{props}),
 ...props.scenes.map(s=>{
  const m=motionSettings(d.motion),base=props.audioBase||'/video-studio/audio',swipe=d.motion?base+'/'+soundAsset(m.transitionSound):props.whoosh,hit=d.motion?base+'/'+soundAsset(m.accentSound):props.impact
  const length=(id:string)=>Math.ceil((SOUND_EFFECTS.find(x=>x.id===id)?.seconds||.7)*30)
  return h(Sequence,{key:'audio-'+s.id,from:s.from,durationInFrames:s.frames},s.audio&&d.voice.enabled?h(Audio,{src:s.audio,playbackRate:s.playbackRate||1,volume:d.audio.voiceVolume}):null,
   d.audio.sounds&&s.id!=='intro'&&swipe?h(Sequence,{durationInFrames:Math.min(s.frames,d.motion?length(m.transitionSound):23)},h(Audio,{src:swipe,volume:d.audio.effectsVolume*.48})):null,
   d.audio.sounds&&s.id!=='intro'&&hit?h(Sequence,{from:5,durationInFrames:Math.min(s.frames-5,d.motion?length(m.accentSound):25)},h(Audio,{src:hit,volume:d.audio.effectsVolume*.65})):null)
 }),
 ...OPENING_SOUNDS.map(cue=>d.audio.sounds?h(Sequence,{key:'opening-'+cue.sound,from:cue.frame,durationInFrames:Math.min(durationInFrames-cue.frame,Math.ceil((SOUND_EFFECTS.find(s=>s.id===cue.sound)?.seconds||1)*30))},h(Audio,{src:(props.audioBase||'/video-studio/audio')+'/'+soundAsset(cue.sound),volume:d.audio.effectsVolume*cue.gain})):null),
 ...(props.format==='horizontal'&&d.audio.sounds?[{sound:'air-swipe' as const,frame:Math.floor((props.scenes[1]?.from||70)*.48)-3,gain:.65},{sound:'bass-hit' as const,frame:Math.floor((props.scenes[1]?.from||70)*.48)+4,gain:.7}].map(cue=>h(Sequence,{key:'tv-brand-'+cue.sound,from:cue.frame,durationInFrames:Math.ceil((SOUND_EFFECTS.find(s=>s.id===cue.sound)?.seconds||1)*30)},h(Audio,{src:(props.audioBase||'/video-studio/audio')+'/'+soundAsset(cue.sound),volume:d.audio.effectsVolume*cue.gain}))):[]),
 props.music&&d.audio.music!=='none'?h(Audio,{src:props.music,loop:true,loopVolumeCurveBehavior:'extend',volume:(f:number)=>musicGain(f,durationInFrames,d,props.scenes)}):null)
}
