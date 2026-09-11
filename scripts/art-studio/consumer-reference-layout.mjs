// Coordenadas proporcionais medidas nos seis quadros da referência enviada.
export function applyReferenceLayout(doc,index){
 if(doc.width>doc.height)return doc
 const w=doc.width,h=doc.height,ls=doc.layers
 const set=(name,x,y,width,height,extra={})=>{const l=ls.find(l=>l.name===name);if(l)Object.assign(l,{x:x*w,y:y*h,width:width*w,height:height*h,...extra})}
 const title=(x,y,width,height,size)=>set('Título consumidor',x,y,width,height,{fontSize:size*w/1080,lineHeight:[1,4].includes(index)?1:.88})
 if(index===0){
  set('Sobretítulo',.32,.71,.10,.06,{text:'dia\ndo',fontSize:32*w/1080,lineHeight:.85})
  set('Título feliz',.38,.67,.34,.09,{fontSize:105*w/1080})
  title(.245,.73,.50,.25,143)
  set('Cesta 3D',.60,.745,.24,.18)
  set('Mensagem',.665,.345,.18,.13,{text:'Celebrando\no Dia do\nConsumidor\ncom a alegria\ne os preços que\nvocê merece.',fontSize:24*w/1080,lineHeight:1})
  set('Fundo da mensagem',.655,.335,.195,.15)
  set('Chamada contato',.23,.074,.23,.015,{fontSize:10*w/1080,fill:'#ffffff'})
  set('Telefone da loja',.23,.09,.24,.022,{fontSize:13*w/1080,fill:'#ffffff'})
  set('Logo dinâmica do cliente',.69,.075,.12,.04)
  ls.find(l=>l.name==='Instagram da loja').visible=false
 }else if(index===1){
  set('Sobretítulo',.23,.535,.34,.145,{fontSize:133*w/1080,rotation:-5})
  title(.245,.625,.38,.29,200)
  ls.find(l=>l.name==='Título consumidor').fontScaleX=.67
  ls.find(l=>l.name==='Título consumidor').rotation=-5
  set('Selo da data',.19,.295,.15,.12)
  set('Data comemorativa',.215,.32,.10,.07,{fontSize:25*w/1080})
  set('Logo dinâmica do cliente',.25,.89,.18,.07)
 }else if(index===2){
  set('Foto — trocar imagem',.245,.045,.53,.79)
  set('Celular — moldura',.59,.175,.35,.49,{rotation:4})
  set('Celular — tela',.60,.183,.326,.467,{rotation:4})
  set('Celular — câmera',.705,.186,.12,.014,{rotation:4})
  set('Percentual editável',.62,.27,.29,.14,{fontFamily:'Barlow',fontWeight:800,fontSize:178*w/1080,rotation:4})
  set('Condição editável',.64,.405,.25,.11,{fontSize:25*w/1080,rotation:4})
  set('Sobretítulo',.125,.575,.28,.07,{text:'Feliz\nDia do',fontFamily:'Consumidor Referencia',fontSize:40*w/1080,lineHeight:.85})
  title(.125,.635,.53,.185,125)
  set('Mensagem',.145,.14,.21,.14,{fontSize:23*w/1080,fontWeight:400})
 }else if(index===3){
  set('Foto — trocar imagem',-.11,.035,1.20,.735)
  set('Mensagem',.175,.275,.24,.16,{fontSize:28*w/1080,fontWeight:400,lineHeight:1.08})
  title(.395,.715,.455,.17,133)
  set('Saudação',.19,.775,.19,.10,{text:'Feliz\nDia do',fontFamily:'Consumidor Referencia',fontWeight:400,fontSize:58*w/1080,lineHeight:.84})
  const base=ls.find(l=>l.name==='Saudação');ls.push({...base,id:base.id+'-date',name:'Data acima da saudação',text:'15 DE MARÇO',y:.77*h-.022*h,height:.022*h,fontFamily:'Barlow',fontWeight:600,fontSize:24*w/1080})
  set('Faixa superior',.01,.095,.98,.02,{text:'P A R A B É N S  C O N S U M I D O R .   P A R A B É N S  C O N S U M I D O R .',fontSize:16*w/1080,fontWeight:400})
 }else if(index===4){
  title(.12,.115,.40,.265,143)
  ls.find(l=>l.name==='Título consumidor').fontScaleX=.78
  ls.find(l=>l.name==='Título consumidor').rotation=-7
  set('Mensagem',.145,.38,.35,.085,{fontSize:24*w/1080,fontWeight:400})
  set('Foto — trocar imagem',.24,-.07,1.05,1.05)
  set('Selo da data',.405,.64,.16,.128)
  set('Data comemorativa',.433,.67,.10,.08,{fontSize:25*w/1080})
 }else{
  set('Sobretítulo',.565,.18,.39,.035,{fontSize:29*w/1080})
  title(.56,.205,.30,.315,118)
  set('Data',.58,.51,.35,.04,{fontSize:31*w/1080})
  set('Foto — trocar imagem',.11,.165,.51,.77)
  set('Mensagem',.49,.675,.31,.12,{fontSize:27*w/1080,fontWeight:400})
  set('Parabéns decorativo',-.04,-.015,1.08,.22,{fontSize:200*w/1080})
  set('Logo dinâmica do cliente',.335,.845,.18,.07)
 }
 return doc
}
