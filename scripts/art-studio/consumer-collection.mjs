import {randomUUID,createHmac} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import pg from 'pg'
import {refineConsumer} from './consumer-effects.mjs'
const dir='artifacts/art-studio/consumidor'
const names=['Celebre com alegria','Supermercado — você em primeiro lugar','Desconto especial','Carrinho cheio de felicidade','Pizza — receita de sucesso','Você merece esse carinho']
const formats=[['feed',1080,1350],['square',1080,1080],['stories',1080,1920],['print',794,1123],['tv',1920,1080]]
export function composition(index,src,w,h){
 const wide=w>h, square=w===h, tall=h/w>1.6, layers=[]
 const bg=['#607dab','#f9c626','#f5cfd0','#f8f7f4','#ffdf34','#ee4034'][index]
 const ink=['#a84323','#007eab','#bb3e64','#253445','#cc382b','#fff9df'][index]
 const add=(kind,name,x,y,ww,hh,extra={})=>{let l={id:randomUUID(),kind,name,x:x*w,y:y*h,width:ww*w,height:hh*h,rotation:0,opacity:1,visible:true,locked:false,fill:ink,...extra};layers.push(l);return l}
 const rect=(name,x,y,ww,hh,fill,extra={})=>add('shape',name,x,y,ww,hh,{shape:'rect',fill,...extra})
 const ellipse=(name,x,y,ww,hh,fill,extra={})=>add('shape',name,x,y,ww,hh,{shape:'ellipse',fill,...extra})
 const text=(name,value,x,y,ww,hh,size,color=ink,font='Barlow',weight=700)=>add('text',name,x,y,ww,hh,{text:value,fontFamily:font,fontWeight:weight,fontSize:size*w/1080,align:'left',fill:color})
 const photo=(x,y,ww,hh,fit='contain')=>add('image','Foto — trocar imagem',x,y,ww,hh,{src,fit,fill:'#ffffff'})
 const heart=(x,y,s,color)=>add('icon','Coração editável',x,y,s,s*w/h,{icon:'heart',fill:color})
 const badge=(x,y,color='#ffffff',back=ink)=>{ellipse('Selo da data',x,y,.115,.115*w/h,back);const l=text('Data comemorativa','15 DE\nMARÇO',x+.015,y+.02*w/h,.085,.08*w/h,20,color,'Barlow Condensed');l.align='center'}
 const footer=(color=ink)=>{
  text('Chamada contato','FALE COM A GENTE',.06,.92,.26,.022,12,color)
  add('text','Telefone da loja',.06,.947,.32,.03,{text:'(00) 00000-0000',fontFamily:'Barlow',fontWeight:600,fontSize:17*w/1080,binding:'phone',fill:color})
  add('text','Instagram da loja',.40,.947,.30,.03,{text:'@sualoja',fontFamily:'Barlow',fontWeight:400,fontSize:17*w/1080,binding:'instagram',fill:color})
  add('image','Logo dinâmica do cliente',.77,.90,.17,.085,{src:'',binding:'logo',fit:'contain',autoTrim:true,logoPadding:8,logoOutline:false,fill:color})
 }
 if(wide){
   if(index===1){photo(.50,0,.50,1,'cover');rect('Painel amarelo',0,0,.51,1,bg)}
   else {if(index===5)rect('Base amarela',.48,.62,.52,.38,'#f9d344');photo(index===2?.52:.49,.06,index===2?.20:.49,.81)}
   text('Sobretítulo',index===5?'FELIZ DIA DO':'15 DE MARÇO',.055,.10,.39,.06,29,ink,'Barlow Condensed')
   text('Título principal','DIA DO\nCONSUMIDOR',.05,.22,.44,.29,68,ink,'Anton')
   text('Mensagem',['Celebrando quem merece\no melhor todos os dias.','Quem abastece tanta alegria\né você, nosso cliente.','Encha o carrinho e celebre\ncom felicidade e economia.','Encha o carrinho de sorrisos.\nObrigado pela sua preferência!','Nossa receita de sucesso\né ter clientes incríveis.','Comemore com o sorriso\ne a economia que você merece.'][index],.06,.56,.37,.17,27,ink)
   if(index===2){rect('Celular — moldura',.73,.18,.22,.60,'#252327');rect('Celular — tela',.74,.20,.20,.56,'#ffffff');rect('Celular — câmera',.80,.205,.08,.015,'#252327');text('Percentual editável','20%',.765,.32,.15,.15,60,ink,'Anton');text('Condição editável','de desconto nas\ncompras a partir\nde R$ 100,00*',.765,.49,.15,.18,20,'#252327')}
   heart(.41,.70,.05,index===4?'#cc382b':'#f9c626');footer(index===5?'#fff9df':ink)
 }else if(index===0){
   for(let r=0;r<5;r++)text('Textura tipográfica','CONSUMIDOR',-.02,r*.17,1.07,.09,103,'#ffffff','Anton').opacity=.04
   photo(.02,.075,.96,tall?.62:.61)
   rect('Base pêssego',0,.60,1,.40,'#edc5ab')
   text('Sobretítulo','dia de',.08,.62,.48,.055,42,'#ffffff')
   text('Título feliz','feliz',.25,.61,.54,.08,90,'#ffffff','Barlow',800)
   text('Título consumidor','consu\nmidor',.075,.69,.76,.215,square?140:160,ink,'Barlow',800)
   badge(.08,.22,'#ffffff','#3e6093');heart(.78,.75,.12,'#e46732')
   text('Mensagem','Celebrando o Dia do\nConsumidor com a alegria\ne o carinho que você merece.',.68,.36,.27,.17,20,'#ffffff')
   footer('#713c2e')
 }else if(index===1){
   photo(0,0,1,.64,'cover').cropY=0;ellipse('Faixa curva azul',-.15,.49,1.5,.49,'#00abcc');ellipse('Painel amarelo',-.16,.52,1.45,.52,bg)
   badge(.09,.36,'#ffffff','#0084ab')
   text('Sobretítulo','DIA DO',.18,.55,.60,.08,80,'#ffffff','Anton')
   text('Título consumidor','CONSU\nMIDOR',.19,.635,.67,.265,square?140:164,ink,'Anton')
   heart(.06,.62,.12,'#fff4b6');heart(.78,.80,.14,'#fff4b6')
   footer('#225d70')
 }else if(index===2){
   photo(.23,.065,.53,.64)
   rect('Celular — moldura',.635,.20,.305,.415,'#292429');rect('Celular — tela',.65,.214,.275,.386,'#ffffff');rect('Celular — câmera',.73,.22,.12,.009,'#292429')
   text('Percentual editável','20%',.674,.30,.23,.11,80,ink,'Anton')
   text('Condição editável','de desconto nas\ncompras a partir\nde R$ 100,00*',.679,.415,.23,.10,20,'#302a2d')
   text('Mensagem','Encha o carrinho\ne celebre o seu\ndia com felicidade\ne economia.',.07,.145,.26,.18,24,'#634e53')
   badge(.08,.42,'#f5cfd0','#634e53')
   text('Sobretítulo','Feliz Dia do',.075,.64,.65,.06,36,'#634e53')
   text('Título consumidor','consu\nmidor',.07,.696,.83,.205,square?140:165,ink,'Barlow',800)
   text('Condições da campanha','*Personalize as condições antes de divulgar.',.06,.885,.68,.021,11,'#634e53');footer('#634e53')
 }else if(index===3){
   text('Faixa superior','PARABÉNS, CONSUMIDOR.  PARABÉNS, CONSUMIDOR.',.06,.055,.92,.03,16,ink)
   ellipse('Curva laranja',-.40,.19,1.7,.47,'#fa5b25');ellipse('Interior da curva',-.40,.215,1.63,.405,bg)
   photo(.12,.13,.85,.60)
   text('Mensagem','Encha o carrinho\ne celebre o seu\ndia conosco com\nmuita felicidade\ne economia.',.065,.20,.30,.21,25,ink)
   text('Título consumidor','CONSU\nMIDOR',.39,.715,.56,.195,square?115:140,'#fa5b25','Barlow',800)
   text('Saudação','15 DE MARÇO\nFeliz\nDia do',.08,.755,.30,.125,36,ink,'Barlow',800);footer()
 }else if(index===4){
   ellipse('Curva vermelha superior',-.3,-.16,1.60,.27,'#df3d29');ellipse('Interior amarelo',-.3,-.19,1.6,.27,bg)
   photo(.31,.16,.83,.73)
   text('Título consumidor','DIA DO\nCONSU\nMIDOR',.055,.13,.44,.29,square?103:123,ink,'Anton')
   text('Mensagem','NOSSA RECEITA DE SUCESSO\nÉ TER CLIENTES INCRÍVEIS\nCOMO VOCÊ.',.065,.425,.36,.105,19,ink,'Barlow Condensed')
   badge(.11,.63,'#fff0b4',ink)
   ellipse('Base curva vermelha',-.3,.81,1.6,.30,'#df3d29');ellipse('Rodapé pêssego',-.3,.85,1.6,.3,'#f4c9b5');footer('#763a32')
 }else{
   text('Parabéns decorativo','parabéns',-.025,.012,1.1,.14,128,'#ce302b','Barlow',800)
   rect('Base amarela',0,.66,1,.34,'#f9d344')
   photo(.01,.17,.57,.75)
   text('Sobretítulo','FELIZ DIA DO',.55,.175,.40,.035,23,'#fff9df')
   text('Título consumidor','CON\nSU\nMI\nDOR',.55,.22,.39,.365,square?112:128,'#fff9df','Barlow',800)
   text('Data','15 DE MARÇO',.55,.594,.39,.035,23,'#ffe28a')
   text('Mensagem','Comemore o Dia do\nConsumidor com o\nsorriso e a economia\nque você merece.',.58,.72,.34,.12,22,'#57482c')
   heart(.80,.48,.13,'#ffde67');heart(.025,.39,.10,'#ffde67');footer('#57482c')
 }
 return {version:1,width:w,height:h,background:bg,layers}
}
async function main(){
 await mkdir(dir,{recursive:true})
 const origin=process.env.ART_STUDIO_TEST_URL||'http://127.0.0.1:3119'
 if(new URL(origin).hostname!=='127.0.0.1')throw Error('Somente API local')
 const db=new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL});await db.connect()
 const {rows}=await db.query("select id,email,role from profiles where role='super_admin'");await db.end();if(rows.length!==1)throw Error('Selecione explicitamente o super admin');const user=rows[0]
 const now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),message=enc({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+enc({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600}),token=message+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(message).digest('base64url')
 async function call(path,body,method='POST'){
  const res=await fetch(origin+'/api/art-studio'+path,{method,headers:{Authorization:`Bearer ${token}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(90000)})
  if(!res.ok)throw Error(`${path} ${res.status}: ${await res.text()}`);return res.json()
 }
 let manifest;try{manifest=JSON.parse(await readFile(dir+'/manifest.json','utf8'))}catch{manifest={collection:'Dia do Consumidor • Especial',items:[]}}
 if(!manifest.heart){const form=new FormData();form.append('file',new Blob([await readFile(`${dir}/assets/selo-coracao.png`)],{type:'image/png'}),'selo-coracao.png');manifest.heart=await call('/assets',form);await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2))}
 if(!manifest.basket){const form=new FormData();form.append('file',new Blob([await readFile(`${dir}/assets/cesta-3d.png`)],{type:'image/png'}),'cesta-3d.png');manifest.basket=await call('/assets',form);await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2))}
 for(let i=0;i<6;i++){
  let item=manifest.items[i];if(!item){item={index:i,name:names[i]};manifest.items[i]=item}
  if(!item.src){const form=new FormData();form.append('file',new Blob([await readFile(`${dir}/assets/foto-${i+1}.png`)],{type:'image/png'}),`consumidor-${i+1}.png`);Object.assign(item,await call('/assets',form));await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2))}
  const pages=formats.map(([id,w,h])=>refineConsumer(composition(i,item.src,w,h),i,manifest.heart.src,manifest.basket.src)),compositionDoc={...pages[0],alternates:pages.slice(1)}
  const template={name:`Dia do Consumidor — ${names[i]}`,category:'Datas comemorativas',collection:manifest.collection,tags:['dia do consumidor','15 de março','cinco formatos','consumidor-especial-2026'],composition:compositionDoc,published:process.argv.includes('--publish')}
  if(!item.templateId){const saved=await call('/templates',template);item.templateId=saved.id;item.revision=saved.revision}
  else {const saved=await call('/templates/'+item.templateId,{...template,revision:item.revision},'PUT');item.revision=saved.revision}
  item.published=template.published
  await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(`${dir}/modelo-${i+1}.json`,JSON.stringify(template,null,2))
  const assets={[manifest.basket.src]:(await readFile(`${dir}/assets/cesta-3d.png`)).toString('base64'),[manifest.heart.src]:(await readFile(`${dir}/assets/selo-coracao.png`)).toString('base64'),[item.src]:(await readFile(`${dir}/assets/foto-${i+1}.png`)).toString('base64')}
  await writeFile(`${dir}/render-${i+1}.json`,JSON.stringify({mode:'render',compositions:pages,assets}))
  console.log(JSON.stringify({name:template.name,id:item.templateId,formats:pages.length,published:item.published}))
 }
 const catalog=await call('/templates?admin=1',undefined,'GET');for(const item of manifest.items){const found=catalog.templates.find(t=>t.id===item.templateId);if(!found||found.composition.alternates?.length!==4||![found.composition,...found.composition.alternates].every(page=>page.layers.some(l=>l.gradient)&&page.layers.some(l=>l.binding==='logo')))throw Error('Releitura falhou');}
 console.log('Seis modelos e trinta formatos relidos com sucesso.')
}
if(import.meta.url===`file://${process.argv[1]}`)await main()
