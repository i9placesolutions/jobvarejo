import {applyReferenceLayout} from './consumer-reference-layout.mjs'
import {randomUUID} from 'node:crypto'
export function refineConsumer(doc,index,heartSrc,basketSrc){
 const {width:w,height:h}=doc,wide=w>h,ls=doc.layers
 const add=(kind,name,x,y,ww,hh,extra={})=>({id:randomUUID(),kind,name,x:x*w,y:y*h,width:ww*w,height:hh*h,rotation:0,opacity:1,visible:true,locked:false,fill:'#ffffff',...extra})
 const grad=(name,x,y,ww,hh,from,to,a,b,type='linear',angle=90)=>add('shape',name,x,y,ww,hh,{shape:'rect',gradient:{type,from,to,startOpacity:a,endOpacity:b,angle}})
 const path=(name,x,y,ww,hh,d,color)=>add('shape',name,x,y,ww,hh,{shape:'path',pathData:d,fill:color})
 const before=[],after=[]
 const photo=ls.find(l=>l.name==='Foto — trocar imagem')
 for(const l of ls){
  if(index===0&&l.kind==='icon'&&basketSrc){l.kind='image';l.src=basketSrc;l.fit='contain';l.name='Cesta 3D';l.width=.23*w;l.height=l.width;l.x=.71*w}
  if(l.name.startsWith('Celular'))l.cornerRadius=(l.name.includes('câmera')?12:32)*w/1080
  if(l.name.includes('Título consumidor')){l.fontFamily=index===0?'Patua One':[2,3].includes(index)?'Consumidor Referencia':index===5?'Barlow':'Anton';l.fontWeight=index===5?800:400;l.lineHeight=.88}
  if(l.name==='Parabéns decorativo'){l.fontFamily='Caveat';l.fontWeight=700;l.fontSize=160*w/1080;l.height=.16*h}
  if(l.name==='Sobretítulo'&&[1,4].includes(index)){l.fontFamily='Bebas Neue';l.fontWeight=400}
  if(l.kind==='icon'&&l.icon==='heart'&&[1,5].includes(index)&&heartSrc){l.kind='image';l.src=heartSrc;l.fit='contain';l.name='Selo 3D — coração';l.width*=1.55;l.height=l.width}
 }
 if ([2,3,5].includes(index)) {
  const shadow=add('shape','Sombra independente — piso',index===3?.18:.24,index===3?.67:.79,.54,.10,{shape:'ellipse',fill:'#382b2b',opacity:.16,blur:22*w/1080})
  ls.splice(ls.indexOf(photo),0,shadow)
 }
 const portrait = !wide
 if(portrait&&index===0){
  const panel=ls.find(l=>l.name==='Base pêssego');panel.y=.42*h;panel.height=.58*h;panel.gradient={type:'linear',from:'#eac5b0',to:'#efc7ae',startOpacity:0,endOpacity:1,angle:90}
  photo.x=-.03*w;photo.y=.09*h;photo.width=1.06*w;photo.height=.81*h
  const msg=ls.find(l=>l.name==='Mensagem');msg.x=.70*w;msg.y=.32*h;msg.width=.25*w;msg.height=.17*h;msg.fontSize=24*w/1080
  const banner=add('shape','Fundo da mensagem',.685,.305,.275,.18,{shape:'rect',fill:'#c65125'})
  ls.splice(ls.indexOf(msg),0,banner)
  for(const l of ls.filter(l=>l.name.startsWith('Textura')))l.opacity=.055
  const title=ls.find(l=>l.name==='Título consumidor');title.x=.25*w;title.y=.735*h;title.width=.61*w;title.height=.17*h;title.fontSize=145*w/1080
  ls.find(l=>l.name==='Título feliz').x=.36*w
  before.push(grad('Luz fria superior',-.3,-.3,1.3,1,'#9abcdf','#59719e',.35,0,'radial'))
  after.push(grad('Luz quente inferior',-.2,.48,1.4,.8,'#ffd4b7','#ffd4b7',.24,0,'radial'))
 }else if(portrait&&index===1){
  const blue=ls.find(l=>l.name==='Faixa curva azul'),yellow=ls.find(l=>l.name==='Painel amarelo')
  Object.assign(blue,{shape:'path',pathData:'M 0 20 C 35 50 52 0 100 12 L 100 100 L 0 100 Z',x:0,y:.48*h,width:w,height:.52*h})
  Object.assign(yellow,{shape:'path',pathData:'M 0 20 C 35 50 52 0 100 12 L 100 100 L 0 100 Z',x:0,y:.51*h,width:w,height:.49*h,gradient:{type:'linear',from:'#ffda29',to:'#e9ae19',startOpacity:1,endOpacity:1,angle:100}})
  // Curva é uma faixa fechada independente, não uma imagem de fundo.
  const ribbon=path('Fita azul — curva superior',.61,.06,.36,.52,'M 20 100 C 85 60 95 10 55 0 C 5 0 0 43 45 65 C 65 76 85 85 100 90 L 96 100 C 55 82 0 60 0 28 C 0 0 70 0 82 20 C 100 58 50 90 30 100 Z','#03adcc')
  ls.splice(ls.indexOf(blue),0,ribbon)
  const title=ls.find(l=>l.name==='Título consumidor');title.x=.26*w;title.y=.635*h;title.width=.48*w;title.height=.26*h;title.fontSize=196*w/1080
  const sub=ls.find(l=>l.name==='Sobretítulo');sub.x=.23*w;sub.y=.54*h;sub.fontSize=90*w/1080
  before.push(grad('Luz amarela do supermercado',0,0,1,.5,'#fff9ae','#fff9ae',.14,0,'radial'))
 }else if(portrait&&index===2){
  before.push(grad('Degradê rosa de fundo',0,0,1,1,'#f9d8d9','#efbdc5',1,1))
  const frame=ls.find(l=>l.name==='Celular — moldura');frame.gradient={type:'linear',from:'#737176',to:'#1c1a1d',startOpacity:1,endOpacity:1,angle:25}
  const shadow=grad('Sombra do celular',.61,.18,.36,.47,'#7e4d5e','#7e4d5e',.35,0,'radial');ls.splice(ls.indexOf(frame),0,shadow)
  const title=ls.find(l=>l.name==='Título consumidor');title.y=.66*h;title.height=.22*h;title.fontSize=150*w/1080
  ls.find(l=>l.name==='Sobretítulo').y=.60*h
  after.push(grad('Reflexo suave do celular',.65,.215,.27,.15,'#ffffff','#ffffff',.30,0))
 }else if(portrait&&index===3){
  before.push(grad('Degradê cinza do piso',0,.30,1,.70,'#ffffff','#adb3bd',0,1))
  const curve=ls.find(l=>l.name==='Curva laranja'),inner=ls.find(l=>l.name==='Interior da curva');ls.splice(ls.indexOf(inner),1)
  Object.assign(curve,{shape:'path',pathData:'M 0 35 C 40 0 90 15 100 58 C 100 100 50 90 50 55 C 50 20 60 0 65 0 L 75 0 C 58 25 50 75 78 77 C 105 80 95 40 55 32 C 32 25 14 35 0 46 Z',x:-.05*w,y:0,width:1.10*w,height:.62*h,fill:'#fa5c26'})
  photo.x=.08*w;photo.y=.085*h;photo.width=.89*w;photo.height=.68*h
  const msg=ls.find(l=>l.name==='Mensagem');msg.x=.16*w;msg.y=.285*h;msg.width=.27*w;msg.height=.18*h;msg.fontSize=26*w/1080
  const title=ls.find(l=>l.name==='Título consumidor');title.x=.39*w;title.y=.745*h;title.width=.57*w;title.height=.17*h;title.fontSize=135*w/1080
 }else if(portrait&&index===4){
  before.push(grad('Luz dourada radial',-.45,-.20,1.25,1.2,'#fffca4','#ffd21a',.85,0,'radial'))
  photo.x=.35*w;photo.y=.04*h;photo.width=.86*w;photo.height=.90*h
  const title=ls.find(l=>l.name==='Título consumidor');title.fontSize=125*w/1080;title.x=.075*w;title.y=.14*h;title.width=.44*w
  const msg=ls.find(l=>l.name==='Mensagem');msg.y=.42*h
  const strip=ls.find(l=>l.name==='Rodapé pêssego');strip.gradient={type:'linear',from:'#eeb8a1',to:'#f8d7c8',startOpacity:1,endOpacity:1,angle:90}
 }else if(portrait&&index===5){
  before.push(grad('Luz vermelha de fundo',-.3,-.2,1.3,1,'#ff7662','#ee4034',.6,0,'radial'))
  const panel=ls.find(l=>l.name==='Base amarela');panel.gradient={type:'linear',from:'#ffe260',to:'#e6b528',startOpacity:1,endOpacity:1,angle:120}
  const title=ls.find(l=>l.name==='Título consumidor');title.fontSize=100*w/1080
 }
 if(wide){before.push(grad('Iluminação lateral editável',0,0,1,1,index===0?'#f5cdb9':'#fff5c8',doc.background,.4,0,'radial'))}
 // Luzes de fundo ficam antes das fotos; brilho de primeiro plano antes da tipografia.
 const firstText=ls.findIndex(l=>l.kind==='text'&&!l.name.startsWith('Textura')&&l.name!=='Parabéns decorativo')
 if(after.length)ls.splice(Math.max(0,firstText),0,...after)
 doc.layers=[...before,...ls]
 return applyReferenceLayout(doc,index)
}
