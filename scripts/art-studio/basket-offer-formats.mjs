import{readFile,writeFile}from'node:fs/promises'
const root='artifacts/art-studio/ofertas-cesta',t=JSON.parse(await readFile(root+'/modelo.json','utf8'))
const base=structuredClone(t.composition);delete base.alternates
function variant(w,h){
 const d=structuredClone(base);d.width=w;d.height=h
 const scale=w/1080
 for(const l of d.layers){l.x*=scale;l.y*=h/1080;l.width*=scale;l.height*=scale;if(l.fontSize)l.fontSize*=scale;if(l.blur)l.blur*=scale;if(l.cornerRadius)l.cornerRadius*=scale}
 const set=(name,x,y,width,height,extra={})=>{const l=d.layers.find(l=>l.name===name);if(!l)throw Error(name);Object.assign(l,{x:x*w,y:y*h,width:width*w,height:height*h,...extra})}
 set('Fundo azul — degradê',0,0,1,1)
 set('Painel laranja inclinado',.218,0,.782,1)
 if(w<h&&h/w<1.65){
  set('Foto — mão e cesta substituível',-.10,0,.68,.93)
  set('Sombra independente da cesta',-.06,.88,.61,.055)
  // Os blocos da direita conservam as proporções e ganham respiro vertical.
  const shifts={'Título — Aproveite':.29,'Título — nossas':.35,'Título — ofertas':.41,'Descrição':.49,'Chamada em destaque':.54,'Faixa azul do desconto':.60,'Percentual editável':.612,'Fundo laranja OFF':.625,'Texto OFF':.630,'Logo dinâmica do cliente':.76}
  for(const [name,y]of Object.entries(shifts))d.layers.find(l=>l.name===name).y=y*h
 }else if(h/w>=1.65){
  set('Foto — mão e cesta substituível',-.02,-.025,.68,.63)
  set('Sombra independente da cesta',-.035,.59,.63,.03)
  const panel=d.layers.find(l=>l.name==='Painel laranja inclinado');panel.pathData='M 24 0 L 100 0 L 100 100 L 0 100 L 0 59 L 36 45 Z'
  const lower={...structuredClone(panel),id:panel.id+'-stories-base',name:'Painel laranja inferior — stories',shape:'rect',x:0,y:.595*h,width:w,height:.405*h,gradient:{type:'linear',from:'#ffab00',to:'#ff7d00',startOpacity:1,endOpacity:1,angle:25}};delete lower.pathData
  d.layers.splice(d.layers.indexOf(panel)+1,0,lower)
  for(const [i,name]of ['Título — Aproveite','Título — nossas','Título — ofertas'].entries())set(name,.09,.616+i*.044,.83,.057,{fontSize:76*scale})
  set('Descrição',.095,.761,.82,.054,{fontSize:29*scale})
  set('Chamada em destaque',.095,.803,.83,.030,{fontSize:29*scale})
  set('Faixa azul do desconto',.09,.85,.44,.066)
  set('Percentual editável',.11,.856,.285,.068,{fontSize:95*scale})
  set('Fundo laranja OFF',.37,.869,.139,.028)
  set('Texto OFF',.382,.870,.124,.040,{fontSize:45*scale})
  set('Logo dinâmica do cliente',.61,.855,.29,.065)
  for(const l of d.layers.filter(l=>l.name.startsWith('Ícone')))l.y=.545*h
 }else{
  // Horizontal: fotografia à esquerda e informação concentrada à direita.
  set('Foto — mão e cesta substituível',-.015,-.025,.38,1.02)
  set('Painel laranja inclinado',.25,0,.75,1)
  set('Sombra independente da cesta',.02,.90,.32,.06)
  set('Tipografia decorativa azul',-.08,.1,.47,.63,{fontSize:520})
  const x=.46
  for(const [i,name]of ['Título — Aproveite','Título — nossas','Título — ofertas'].entries())set(name,x,.19+i*.10,.49,.125,{fontSize:94})
  set('Descrição',x,.525,.47,.11,{fontSize:34})
  set('Chamada em destaque',x,.62,.49,.05,{fontSize:34})
  set('Faixa azul do desconto',x,.725,.25,.125,{cornerRadius:28})
  set('Percentual editável',x+.013,.739,.163,.13,{fontSize:106})
  set('Fundo laranja OFF',x+.16,.756,.076,.053,{cornerRadius:16})
  set('Texto OFF',x+.168,.759,.070,.075,{fontSize:51})
  set('Logo dinâmica do cliente',.755,.74,.20,.11)
  const icons=d.layers.filter(l=>l.name.startsWith('Ícone'))
  icons.forEach((l,i)=>Object.assign(l,{x:(x+i*.027)*w,y:.095*h,width:34,height:32}))
 }
 return d
}
t.composition={...base,alternates:[[1080,1350],[1080,1920],[794,1123],[1920,1080]].map(([w,h])=>variant(w,h))}
await writeFile(root+'/modelo.json',JSON.stringify(t,null,2))
const src=base.layers.find(l=>l.kind==='image'&&l.src).src
await writeFile(root+'/render.json',JSON.stringify({mode:'render',compositions:[base,...t.composition.alternates],assets:{[src]:(await readFile(root+'/cesta-reta.png')).toString('base64')}}))
