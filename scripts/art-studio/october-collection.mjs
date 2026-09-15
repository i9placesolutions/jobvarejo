import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='artifacts/art-studio/colecao-outubro';
const dims=JSON.parse(await readFile(root+'/asset-dimensions.json','utf8'));
const sources=Object.fromEntries(Object.keys(dims).map((k,i)=>[k,`/api/art-studio/assets/33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`]));
const letterMetrics=JSON.parse(await readFile(root+'/letter-metrics.json','utf8'));
const formats=[[1080,1350],[1080,1080],[1080,1920],[794,1123],[1920,1080]];
const configs=[
 ['sorriso-arco-iris','Dia das Crianças — sorriso e arco-íris','Dia das Crianças','#fcfbf7'],
 ['amigos-coloridos','Dia das Crianças — amigos e cores','Dia das Crianças','#ffeb27'],
 ['sonhar-alto','Dia das Crianças — sonhar alto','Dia das Crianças','#73543a'],
 ['pequeno-aviador','Dia das Crianças — pequeno aviador','Dia das Crianças','#fff4de'],
 ['abrace-prevencao','Outubro Rosa — abrace a prevenção','Outubro Rosa','#fff5f5'],
 ['prevencao-diferenca','Outubro Rosa — prevenção faz a diferença','Outubro Rosa','#e7789b'],
 ['rosa-conscientizacao','Outubro Rosa — flor da conscientização','Outubro Rosa','#faf5f6'],
 ['escolha-rosa','Outubro Rosa — escolha o rosa todos os dias','Outubro Rosa','#ffffff']
];
function make(index,width,height){
 const s=width>height?1:width/1080,W=width/s,H=height/s,wide=W>H,story=H/W>1.65,square=W===H;
 const layers=[];let n=0;
 const add=(kind,name,x,y,w,h,p={})=>{const l={id:`outubro-${index+1}-${++n}`,kind,name,x:x*s,y:y*s,width:w*s,height:h*s,rotation:0,opacity:1,visible:true,locked:false,fill:'#ffffff',...p};if(l.fontSize)l.fontSize*=s;if(l.cornerRadius)l.cornerRadius*=s;if(l.blur)l.blur*=s;layers.push(l);return l};
 const shape=(name,x,y,w,h,fill,p={})=>add('shape',name,x,y,w,h,{shape:'rect',fill,...p});
 const ellipse=(name,x,y,w,h,fill,p={})=>shape(name,x,y,w,h,fill,{shape:'ellipse',...p});
 const text=(name,value,x,y,w,h,size,color,p={})=>add('text',name,x,y,w,h,{text:value,fontFamily:'Barlow',fontWeight:700,fontSize:size,fill:color,lineHeight:1.05,align:'center',...p});
 const img=(key,name,x,y,w,h,p={})=>add('image',name,x,y,w,h??w*dims[key].height/dims[key].width,{src:sources[key],fit:'contain',...p});
 const icon=(name,type,x,y,z,color,p={})=>add('icon',name,x,y,z,z,{icon:type,fill:color,...p});
 const grad=(name,x,y,w,h,from,to,angle=90,opacity=1)=>shape(name,x,y,w,h,from,{gradient:{type:'linear',from,to,startOpacity:opacity,endOpacity:1,angle}});
 const logo=(x,y,w=330,h=145)=>{if(index===2)shape('Base clara da logo',x-15,y-8,w+30,h+16,'#fff6e9',{cornerRadius:20,opacity:.94});return add('image','Logo automática da loja',x,y,w,h,{src:'',binding:'logo',fit:'contain',autoTrim:true,logoPadding:0,logoOutline:false});};
 const letters=(value,x,y,w,h,size,colors,family='Barlow',weight=800)=>{
  const chars=[...value],metrics=letterMetrics[family]||letterMetrics.Barlow;
  const advances=chars.map(ch=>metrics[ch]||.6),sum=advances.reduce((a,b)=>a+b,0);
  const fontSize=Math.min(w/sum,h/.84),stretch=w/(fontSize*sum);let left=x;
  chars.forEach((ch,i)=>{const advance=advances[i]*fontSize*stretch;
   text(`Letra editável ${i+1} — ${ch}`,ch,left,y,advance+3,h,fontSize,colors[i%colors.length],{fontFamily:family,fontWeight:weight,fontScaleX:stretch,lineHeight:.84,align:'left'});left+=advance;
  });
 };
 const stars=(coords,color)=>coords.forEach(([x,y,z])=>icon('Estrela editável','star',x,y,z,color));
 const petals=(coords)=>coords.forEach(([x,y,w,angle])=>img('petala','Pétala independente',x,y,w,undefined,{rotation:angle}));
 const rainbow=(cx,cy,r)=>{['#ff9fba','#ffd540','#c7ea91','#a9e9f9','#fff8e9'].forEach((c,i)=>ellipse('Arco-íris — faixa editável',cx-r+i*25,cy-r+i*25,2*r-i*50,2*r-i*50,c));};
 const footerSocial=(x,y,w,color)=>text('Instagram da loja','',x,y,w,35,23,color,{binding:'instagram',fontWeight:400});
 // Cada referência tem sua própria distribuição e tipografia.
 if(index===0){
  img('sala-clara','Sala clara — fotografia de fundo',0,0,W,H,{fit:'cover',opacity:.36});
  if(wide){
   rainbow(1350,550,460);img('menino-sorriso','Menino sorrindo — recorte',850,110,1000,840);
   text('Mensagem','O sorriso de uma criança\nserá sempre a melhor\nrecompensa.',80,80,730,190,52,'#575752',{align:'left'});
   shape('Base branca do título',45,435,855,310,'#ffffff',{cornerRadius:65});text('Chamada','DIA DAS',90,452,740,75,68,'#fa2424');letters('CRIANÇAS',70,525,800,135,127,['#ff2121','#ff873b','#ff2121','#28b3e3','#f9d500','#9dc848','#912acc','#ff2121']);
   text('Data','12 DE OUTUBRO',110,704,700,50,35,'#f63131');logo(275,825,380,170);
   img('aviao-colorido','Avião de brinquedo',750,775,280);img('cubo','Cubo de formas',1670,15,220);
  }else{
   const heroY=square?200:story?420:290,heroH=story?920:square?500:650;
   rainbow(540,heroY+heroH*.46,story?500:420);img('menino-sorriso','Menino sorrindo — recorte',45,heroY,990,heroH);
   text('Mensagem','O sorriso de uma criança será\nsempre a melhor recompensa.',85,story?110:65,720,story?170:130,story?54:43,'#575752',{align:'left'});
   img('cubo','Cubo de formas',850,story?185:90,200,undefined,{rotation:12});img('aviao-colorido','Avião de brinquedo',-30,heroY+heroH*.55,300);
   const titleY=H-(square?395:story?580:440);
   grad('Luz branca inferior',0,titleY-90,W,H-titleY+90,'#ffffff','#ffffff',90,0);
   shape('Base branca do título',55,titleY-10,970,235,'#ffffff',{cornerRadius:70});text('Chamada','DIA DAS',140,titleY,800,75,70,'#ff2222');letters('CRIANÇAS',90,titleY+72,900,145,143,['#ff2121','#ff873b','#ff2121','#28b3e3','#f9d500','#9dc848','#912acc','#ff2121']);
   text('Data','12 DE OUTUBRO',130,titleY+240,820,50,34,'#fa2929');logo(365,H-145,350,130);
  }
 }else if(index===1){
  const purple='#672482';
  if(wide){
   grad('Fundo da foto',930,0,990,H,'#d5f1ed','#fff8c9');img('amigos','Foto dos quatro amigos',870,50,1050,860);
   shape('Painel amarelo',0,0,960,H,'#ffeb27');ellipse('Mancha orgânica',760,360,340,610,'#ffeb27');
   text('Chamada','Feliz dia das',80,135,780,80,65,purple);shape('Base roxa do título',55,248,850,190,purple,{cornerRadius:90});letters('Crianças',90,260,785,155,143,['#ffeb27','#a5d532','#f780c6','#ffffff','#65b9e6','#f3ab24','#ffffff','#ffeb27'],'Montserrat');
   text('Mensagem','Um feliz dia para as crianças que fazem\ndo nosso mundo um lugar mais divertido!',80,500,760,185,54,purple);logo(280,790,390,170);stars([[880,95,50],[1350,900,44],[1730,60,36]],'#ffed28');
  }else{
   const photoH=square?530:story?1120:730;
   grad('Fundo da foto',0,0,W,photoH,'#cde9e8','#faffed');img('amigos','Foto dos quatro amigos',0,30,W,photoH);
   const titleY=square?490:story?1070:690;
   shape('Painel amarelo',0,titleY-40,W,H-titleY+40,'#ffeb27');ellipse('Mancha amarela esquerda',-160,titleY-125,550,240,'#ffeb27');ellipse('Mancha amarela superior',390,titleY-170,450,250,'#ffeb27');
   text('Chamada','Feliz dia das',190,titleY-75,700,80,62,purple);shape('Base roxa do título',45,titleY,990,190,purple,{cornerRadius:90});letters('Crianças',80,titleY+14,920,157,155,['#ffeb27','#a5d532','#f780c6','#ffffff','#65b9e6','#f3ab24','#ffffff','#ffeb27'],'Montserrat');
   text('Mensagem','Um feliz dia para as crianças que fazem\ndo nosso mundo um lugar mais divertido!',90,titleY+225,900,story?230:150,story?59:45,purple);
   logo(355,H-170,370,150);stars([[65,150,38],[985,105,32],[125,titleY-140,40],[960,H-100,32]],'#ffeb27');
   [[50,H-250],[990,H-250],[60,H-180],[980,H-180]].forEach(([x,y])=>text('Cruz decorativa','+',x,y,35,40,35,purple));
  }
 }else if(index===2){
  img('sala-dourada','Sala dourada — fotografia',0,0,W,H,{fit:'cover'});grad('Sombra inferior',0,H*.50,W,H*.5,'#352415','#352415',90,0);
  if(wide){
   img('menino-skate','Menino com foguete e skate',845,70,970,890);
   text('Mensagem principal','Brincar também é\nsonhar alto',90,100,730,190,72,'#ffd06b',{align:'left'});
   text('Mensagem complementar','Cada momento é uma chance de voar mais\nlonge com imaginação e coragem.',90,330,735,140,38,'#fff8e6',{align:'left',fontWeight:400});
   text('Chamada','FELIZ DIA DAS',70,520,780,70,54,'#ffffff',{fontWeight:400});text('Título','CRIANÇAS',60,602,800,150,125,'#ffc86b');text('Data','12 DE OUTUBRO',130,455,660,50,32,'#ffd06b');logo(300,825,370,160);
  }else{
   const heroY=story?360:130,heroH=story?1190:square?650:880;
   img('menino-skate','Menino com foguete e skate',115,heroY,930,heroH);
   shape('Painel da mensagem',65,story?180:155,380,story?300:240,'#372b1d',{opacity:.56,cornerRadius:25});
   text('Mensagem principal','Brincar também é\nsonhar alto',88,story?205:178,340,110,43,'#ffcd57',{align:'left'});
   text('Mensagem complementar','Cada momento é uma chance\nde voar mais longe com\nimaginação e coragem.',88,story?335:290,330,125,27,'#ffffff',{fontWeight:400,align:'left'});
   const ty=H-(square?400:480);text('Data','12 DE OUTUBRO',270,ty,540,50,31,'#ffd06b');text('Chamada','FELIZ DIA DAS',100,ty+60,880,75,52,'#ffffff',{fontWeight:400});text('Título','CRIANÇAS',65,ty+125,950,140,135,'#ffc86b');logo(350,H-165,380,145);
   stars([[90,ty-85,52],[925,H-225,50]],'#ffda78');
  }
 }else if(index===3){
  grad('Fundo pêssego',0,0,W,H,'#ffe8bb','#fffef8');img('luz-dourada-difusa','Luz dourada difusa — efeito',-W*.35,-H*.25,W*1.25,H*1.2,{fit:'cover'});
  if(wide){
   img('menino-aviador','Pequeno aviador — recorte',910,0,1040,980);img('nevoa-branca-degrade','Névoa branca — efeito degradê',0,580,W,500,{fit:'cover'});
   text('Mensagem','Crianças são poesia em movimento,\npinceladas de alegria no nosso dia a dia.\nHoje celebramos a pureza, a imaginação\nsem limites e o sorriso mais sincero.',85,110,820,245,39,'#cc651e',{align:'left',fontWeight:600});
   text('Data','12 de Outubro',110,425,700,50,39,'#1d5984');text('Feliz','Feliz',70,480,600,155,151,'#215c81',{fontFamily:'Knewave',fontWeight:400});text('Dia das','Dia das',650,540,235,95,68,'#fa6a05',{fontFamily:'Knewave',fontWeight:400});text('Crianças','Crianças',80,650,800,185,153,'#fc6600',{fontFamily:'Knewave',fontWeight:400});logo(310,870,360,155);img('coracao-laranja','Coração laranja',1680,820,230);
  }else{
   img('menino-aviador','Pequeno aviador — recorte',410,story?180:75,750,story?1110:square?650:820);
   text('Mensagem','Crianças são poesia\nem movimento,\npinceladas de alegria\nno nosso dia a dia.\nHoje celebramos a\npureza, a imaginação\nsem limites e o\nsorriso mais sincero.',80,story?270:210,360,420,story?39:33,'#c96929',{align:'left',fontWeight:600});
   const ty=H-(story?630:square?475:555);const fogY=story?870:square?430:580;img('nevoa-branca-degrade','Névoa branca — efeito degradê',0,fogY,W,H-fogY,{fit:'cover'});
   text('Data','12 de Outubro',100,ty,680,60,36,'#215c81',{rotation:-8});text('Feliz','Feliz',205,ty+62,630,180,170,'#215c81',{fontFamily:'Knewave',fontWeight:400});text('Dia das','Dia\ndas',820,ty+130,150,130,58,'#fa6a05',{fontFamily:'Knewave',fontWeight:400});text('Crianças','Crianças',120,ty+235,860,190,170,'#fc6600',{fontFamily:'Knewave',fontWeight:400});logo(355,H-150,370,135);img('coracao-laranja','Coração laranja',860,H-235,260);img('coracao-laranja','Coração flutuante',220,60,100,undefined,{rotation:-20});
  }
 }else if(index===4){
  grad('Fundo rosa suave',0,0,W,H,'#fffdfb','#f5dfe4',45);
  if(wide){
   img('laco-tecido','Laço rosa de tecido',1080,60,720,930);
   text('Frase de abertura','NESTE OUTUBRO ROSA,\nABRACE A PREVENÇÃO.',100,90,880,130,38,'#8c8587',{align:'left'});
   text('Outubro','Outubro',95,285,970,180,150,'#777b77',{fontWeight:400});text('Rosa','rosa',95,470,750,200,185,'#dc6495',{fontWeight:600});text('Mensagem','PREVENÇÃO AO CÂNCER DE MAMA',125,715,810,90,34,'#817579');logo(315,865,390,160);
  }else{
   const ry=story?390:190,rh=story?1150:square?600:820;
   img('laco-tecido','Laço rosa de tecido',480,ry,550,rh);
   text('Frase de abertura','NESTE\nOUTUBRO ROSA,\nABRACE A\nPREVENÇÃO.',145,story?155:95,560,200,32,'#8c8587',{align:'left',lineHeight:1.3});
   text('Outubro — parte 1','Outu',110,story?595:square?340:445,590,150,140,'#777b77',{fontWeight:400,align:'left'});text('Outubro — parte 2','bro',110,story?750:square?475:590,450,145,140,'#777b77',{fontWeight:400,align:'left'});text('Rosa','rosa',110,story?895:square?610:725,490,150,145,'#df6396',{align:'left',fontWeight:600});
   text('Mensagem','PREVENÇÃO AO\nCÂNCER DE MAMA',130,H-315,810,100,36,'#817579',{lineHeight:1.25});logo(355,H-180,370,160);
  }
 }else if(index===5){
  grad('Fundo rosa',0,0,W,H,'#e580a0','#dc638e',90);
  const cx=wide?560:540,cy=wide?510:story?800:square?445:570,r=wide?445:story?510:square?450:495;
  ellipse('Círculo externo',cx-r,cy-r,2*r,2*r,'#ffffff',{opacity:.12});ellipse('Círculo interno',cx-r+65,cy-r+65,2*r-130,2*r-130,'#e8799c');
  img('laco-cetim','Laço rosa acetinado',cx-r*.69,cy-r*.91,r*1.38,r*1.78);
  // Letras independentes acompanham o anel, sem rasterizar o texto circular.
  const ring='CONSCIENTIZAÇÃO • CÂNCER DE MAMA •';[...ring].forEach((ch,i)=>{const angle=-155+i*(310/(ring.length-1)),a=angle*Math.PI/180,rr=r*.88;text(`Texto circular — ${i+1}`,ch,cx+Math.sin(a)*rr-16,cy-Math.cos(a)*rr-20,35,45,28,'#ffe6ee',{rotation:angle,fontWeight:400});});
  text('Outubro','outubro',cx-r*.78,cy-r*.21,r*1.56,r*.40,r*.34,'#ffffff',{fontFamily:'Oswald'});text('Rosa','rosa',cx-r*.61,cy+r*.19,r*1.22,r*.42,r*.36,'#ffffff',{fontFamily:'Oswald'});
  if(wide){text('Mensagem','A PREVENÇÃO FAZ\nTODA A DIFERENÇA',1110,230,720,220,64,'#ffffff');text('Apoio','OUTUBRO ROSA',1160,535,620,65,35,'#ffe6ee');logo(1290,740,390,180);}
  else{text('Mensagem','A PREVENÇÃO FAZ\nTODA A DIFERENÇA',100,H-355,880,125,story?53:43,'#ffffff');logo(355,H-185,370,155);}
 }else if(index===6){
  shape('Fundo marfim rosado',0,0,W,H,'#faf4f5');
  if(wide){
   img('rosa','Rosa cor-de-rosa',70,65,930,860);text('Outubro','outubro',1080,235,720,150,111,'#79514c',{fontFamily:'Montserrat'});text('Rosa','rosa',1130,390,620,145,112,'#79514c',{fontFamily:'Montserrat'});shape('Traço rosa',1050,385,760,7,'#e282a4');icon('Coração','heart',1400,135,65,'#e98bab');text('Mensagem','MÊS DE CONSCIENTIZAÇÃO\nSOBRE O CÂNCER DE MAMA',1050,595,750,100,32,'#d37796');logo(1240,820,400,175);petals([[0,880,200,-20],[1760,30,160,30]]);
  }else{
   const flowerH=story?1030:square?520:735;img('rosa','Rosa cor-de-rosa',story?100:180,story?80:35,story?880:720,flowerH);
   const ty=story?1170:square?555:820;icon('Coração','heart',510,ty-65,65,'#e98bab');text('Outubro','outubro',160,ty,760,120,104,'#79514c',{fontFamily:'Montserrat'});text('Rosa','rosa',210,ty+113,660,110,100,'#79514c',{fontFamily:'Montserrat'});shape('Traço rosa',165,ty+115,750,6,'#e282a4');
   text('Mensagem','MÊS DE CONSCIENTIZAÇÃO\nSOBRE O CÂNCER DE MAMA',140,ty+255,800,90,story?39:31,'#d37796');logo(345,H-175,390,155);petals([[-75,H-245,230,-10],[970,5,175,35]]);
  }
 }else if(index===7){
  shape('Fundo branco',0,0,W,H,'#fffefe');
  if(wide){
   img('laco-fluido','Laço rosa fluido',825,30,1080,1040);text('Título','Escolha o rosa\ntodos os dias',100,105,820,285,104,'#cc5589',{align:'left',fontFamily:'Montserrat'});text('Mensagem','Um laço que une milhões\nem torno da mesma causa.',105,450,780,125,45,'#8a7c84',{align:'left',fontWeight:400});
   icon('Coração','heart',125,665,70,'#dd8baa');icon('Flor','flower',290,665,70,'#dd8baa');icon('Cuidado','check',455,665,70,'#dd8baa');logo(255,850,380,160);petals([[1550,35,120,25],[950,900,145,-25]]);
  }else{
   const titleY=story?110:70;
   text('Título','Escolha\no rosa\ntodos os dias',85,titleY,610,story?420:square?285:340,story?98:square?73:85,'#cf598d',{align:'left',fontFamily:'Montserrat'});
   text('Mensagem','Um laço que une\nmilhões em torno\nda mesma causa.',90,titleY+(story?460:square?305:375),490,170,story?43:35,'#8a7c84',{align:'left',fontWeight:400});
   const ry=story?510:square?215:345;img('laco-fluido','Laço rosa fluido',story?140:300,ry,story?1020:850,story?1150:square?705:880);
   icon('Coração','heart',95,story?850:square?610:710,55,'#dd8baa');icon('Flor','flower',220,story?850:square?610:710,55,'#dd8baa');icon('Cuidado','check',345,story?850:square?610:710,55,'#dd8baa');
   logo(85,H-190,350,160);petals([[750,5,135,25],[940,H-230,120,-30],[30,H-365,100,-25]]);
  }
 }
 const set=(name,p)=>{const layer=layers.find(l=>l.name===name);if(!layer)return;for(const [k,v] of Object.entries(p))layer[k]=['x','y','width','height','fontSize'].includes(k)?v*s:v;};
 if(index===0&&square){set('Data',{y:900,height:35,fontSize:28});set('Logo automática da loja',{y:950,height:115,width:310,x:385});}
 if(index===3){
  const top=wide?490:square?565:story?1190:H*.585;
  set('Feliz',{x:wide?170:270,y:top,width:450,height:200,fontSize:185});
  set('Dia das',{x:wide?590:660,y:top+65,width:145,height:135,fontSize:65,text:'Dia\ndas'});
  set('Crianças',{x:wide?110:185,y:top+180,width:wide?730:740,height:180,fontSize:165});
  set('Data',{x:wide?50:145,y:top-5,width:365,height:165,fontSize:38,textArc:110,rotation:-28});
  set('Mensagem',{x:wide?100:170,y:wide?110:story?310:square?225:270,width:wide?720:335,fontSize:wide?39:31});
  if(square){set('Feliz',{height:175,fontSize:165});set('Dia das',{y:top+52,height:115,fontSize:58});set('Crianças',{y:top+160,height:155,fontSize:145});set('Logo automática da loja',{y:925,height:140});}
  if(wide)set('Logo automática da loja',{x:300,y:885,width:380,height:155});
 }
 if(index===4&&!wide){
  const fs=square?170:story?220:190;
  set('Outubro — parte 1',{y:square?300:story?570:420,height:fs+10,fontSize:fs});
  set('Outubro — parte 2',{y:square?450:story?795:610,height:fs+10,fontSize:fs});
  set('Rosa',{y:square?600:story?1010:800,height:fs+10,fontSize:fs});
 }
 return{version:1,width,height,background:configs[index][3],layers};
}
const assets={};for(const [key,src] of Object.entries(sources))assets[src]=(await readFile(root+'/assets/'+key+'.png')).toString('base64');
let logoBytes;try{logoBytes=(await readFile('artifacts/art-studio/dia-das-criancas/logo-auto-trim.png')).toString('base64')}catch{}
const manifest=[];
for(let i=0;i<configs.length;i++){
 const [slug,name,collection]=configs[i],out=root+'/'+slug;await mkdir(out+'/previews',{recursive:true});const docs=formats.map(([w,h])=>make(i,w,h));
 const template={name,category:collection==='Outubro Rosa'?'Campanhas':'Datas comemorativas',collection,tags:[collection,slug,'camadas editáveis','logo automática'],published:true,composition:{...docs[0],alternates:docs.slice(1)}};
 await writeFile(out+'/modelo.json',JSON.stringify(template,null,2));
 const rendered=structuredClone(docs);if(logoBytes)for(const doc of rendered)doc.layers.find(l=>l.binding==='logo').src='/api/art-studio/brand-logo';
 await writeFile(out+'/render.json',JSON.stringify({mode:'render',compositions:rendered,assets:{...assets,...(logoBytes?{'/api/art-studio/brand-logo':logoBytes}:{})}}));
 manifest.push({slug,name,collection});
}
await writeFile(root+'/collection.json',JSON.stringify(manifest,null,2));await writeFile(root+'/asset-sources.json',JSON.stringify(sources,null,2));console.log('8 modelos / 40 composições gerados.');
