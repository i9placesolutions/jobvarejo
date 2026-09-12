import{randomUUID}from'node:crypto'
import{readFile,writeFile}from'node:fs/promises'
const root='artifacts/art-studio/ofertas-cesta',layers=[]
const add=(kind,name,x,y,width,height,extra={})=>{const l={id:randomUUID(),kind,name,x,y,width,height,rotation:0,opacity:1,visible:true,locked:false,fill:'#ffffff',...extra};layers.push(l);return l}
const shape=(name,x,y,w,h,fill,extra={})=>add('shape',name,x,y,w,h,{shape:'rect',fill,...extra})
const path=(name,x,y,w,h,fill,pathData,extra={})=>shape(name,x,y,w,h,fill,{shape:'path',pathData,...extra})
const text=(name,value,x,y,w,h,fontSize,weight=800,fill='#ffffff',extra={})=>add('text',name,x,y,w,h,{text:value,fontFamily:'Montserrat',fontSize,fontWeight:weight,lineHeight:1.13,fill,...extra})
shape('Fundo azul — degradê',0,0,1080,1080,'#0041c7',{gradient:{type:'linear',from:'#0027a8',to:'#0072d7',startOpacity:1,endOpacity:1,angle:-35}})
text('Tipografia decorativa azul','30',-98,125,680,450,390,800,'#25a9ed',{rotation:-18,opacity:.53})
path('Grafismo azul superior',305,-40,150,130,'#1683df','M 0 40 L 100 0 L 100 65 L 0 100 Z',{opacity:.65})
shape('Cruz inferior vertical',100,890,87,235,'#ffffff')
shape('Cruz inferior horizontal',0,923,257,85,'#ffffff')
path('Painel laranja inclinado',235,0,845,1080,'#ff9100','M 24 0 L 100 0 L 100 100 L 0 100 L 36 45 Z',{gradient:{type:'linear',from:'#ffc300',to:'#ff7500',startOpacity:1,endOpacity:1,angle:25}})
// Linhas geométricas independentes; nenhuma textura é incorporada à fotografia.
for(const [name,x,y,w,h,angle] of [['Linha dourada superior',565,464,570,2,15],['Linha dourada diagonal',727,570,2,580,16],['Linha dourada inferior',251,1030,640,2,14],['Linha dourada lateral',1010,570,2,460,20]])shape(name,x,y,w,h,'#ffe76f',{rotation:angle,opacity:.30})
shape('Sombra independente da cesta',-65,920,585,68,'#7a2500',{shape:'ellipse',opacity:.22,blur:28})
add('image','Foto — mão e cesta substituível',-22,-15,603,998,{src:'/api/art-studio/assets/11111111-1111-4111-8111-111111111111',fit:'contain'})
add('icon','Ícone — coração',623,204,33,29,{icon:'heart',fill:'#003cbe'})
// Ícones sociais como curvas fechadas editáveis.
path('Ícone — comentário',670,203,32,30,'#003cbe','M 48 0 C 15 0 0 20 0 47 C 0 79 30 95 63 88 L 100 100 L 84 68 C 105 30 81 0 48 0 L 48 10 C 75 10 94 35 74 66 L 84 83 L 61 77 C 30 87 10 70 10 47 C 10 23 25 10 48 10 Z')
path('Ícone — enviar',716,204,33,29,'#003cbe','M 0 0 L 100 0 L 62 100 L 40 53 Z M 14 10 L 45 44 L 84 10 Z M 50 51 L 62 75 L 87 20 Z')
path('Ícone — salvar',766,204,25,30,'#003cbe','M 0 0 L 100 0 L 100 100 L 50 68 L 0 100 Z M 12 12 L 12 77 L 50 53 L 88 77 L 88 12 Z')
text('Título — Aproveite','Aproveite',619,295,426,97,64)
text('Título — nossas','nossas',619,368,425,97,64)
text('Título — ofertas','ofertas!',619,442,425,97,64)
text('Descrição','Economize mais\ncomprando conosco.',621,528,407,72,24,400)
text('Chamada em destaque','Só hoje, só pra você!',621,582,412,42,24,800)
shape('Faixa azul do desconto',620,641,327,102,'#003cbd',{cornerRadius:25})
text('Percentual editável','30%',638,656,209,104,77,600)
shape('Fundo laranja OFF',828,670,100,43,'#ff9709',{cornerRadius:14})
text('Texto OFF','OFF',834,674,96,58,39,700)
add('image','Logo dinâmica do cliente',620,786,330,102,{src:'',binding:'logo',fit:'contain',autoTrim:true,logoOutline:false,logoPadding:0})
const doc={version:1,width:1080,height:1080,background:'#003ac4',layers}
await writeFile(root+'/modelo.json',JSON.stringify({name:'Ofertas — cesta vermelha',category:'Campanhas',collection:'Ofertas de supermercado',tags:['ofertas','cesta','supermercado'],published:true,composition:doc},null,2))
await writeFile(root+'/render.json',JSON.stringify({mode:'render',compositions:[doc],assets:{[layers.find(l=>l.kind==='image').src]:(await readFile(root+'/cesta-reta.png')).toString('base64')}}))
