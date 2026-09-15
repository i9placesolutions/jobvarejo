import{readFile,writeFile,mkdir}from'node:fs/promises';
const root='artifacts/art-studio/rosa-varejo';
const dims=JSON.parse(await readFile(root+'/asset-dimensions.json','utf8'));
const sources=Object.fromEntries(Object.keys(dims).map((k,i)=>[k,`/api/art-studio/assets/44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`]));
const formats=[[1080,1350],[1080,1080],[1080,1920],[794,1123],[1920,1080]];
const entries=[['essa-luta-e-nossa','Outubro Rosa — essa luta é nossa','Outubro Rosa'],['outubro-rosa-cuidado','Outubro Rosa — cuidado em suas mãos','Outubro Rosa'],['conecte-se-corpo','Outubro Rosa — conecte-se com seu corpo','Outubro Rosa'],['venha-fazer-compras','Varejo — venha fazer suas compras','Varejo'],['frescor-e-economia','Hortifruti — frescor e economia','Varejo'],['economia-na-lista','Varejo — economia na lista de compras','Varejo']];
function make(i,width,height){
 const s=width>height?1:width/1080,W=width/s,H=height/s,wide=W>H,square=W===H,story=H/W>1.65,layers=[];let id=0;
 const add=(kind,name,x,y,w,h,p={})=>{const l={id:`rosa-varejo-${i}-${++id}`,kind,name,x:x*s,y:y*s,width:w*s,height:h*s,rotation:0,opacity:1,visible:true,locked:false,fill:'#ffffff',...p};if(l.fontSize)l.fontSize*=s;if(l.cornerRadius)l.cornerRadius*=s;layers.push(l);return l};
 const rect=(name,x,y,w,h,fill,p={})=>add('shape',name,x,y,w,h,{shape:'rect',fill,...p});
 const text=(name,value,x,y,w,h,size,fill,fontFamily='Montserrat',fontWeight=400,p={})=>add('text',name,x,y,w,h,{text:value,fontSize:size,fontFamily,fontWeight,fill,align:'left',lineHeight:1.02,...p});
 const img=(key,name,x,y,w,h,p={})=>add('image',name,x,y,w,h??w*dims[key].height/dims[key].width,{src:sources[key],fit:'contain',...p});
 const icon=(name,key,x,y,z,color)=>add('icon',name,x,y,z,z,{icon:key,fill:color});
 const logo=(x,y,w=330,h=135)=>add('image','Logo automática da loja',x,y,w,h,{src:'',binding:'logo',fit:'contain',autoTrim:true,logoPadding:0,logoOutline:false,...([3,5].includes(i)?{logoBackdrop:'square',logoPadding:8}:{})});
 const contact=(x,y,w,color)=>{text('Instagram da loja','',x,y,w*.56,35,22,color,'Barlow',600,{binding:'instagram'});text('Telefone da loja','',x+w*.6,y,w*.4,35,22,color,'Barlow',600,{binding:'phone'});};
 const grad=(a,b)=>rect('Fundo em degradê',0,0,W,H,a,{gradient:{type:'linear',from:a,to:b,startOpacity:1,endOpacity:1,angle:45}});
 if(i===0){
  grad('#f499af','#f6b2c4');
  const tx=wide?130:215,ty=wide?145:H*.13,fs=wide?145:Math.min(175,H*.12),row=fs*.96;
  text('Mês da campanha','MÊS DE PREVENÇÃO AO CÂNCER DE MAMA',tx,wide?75:ty-55,wide?980:760,35,wide?25:18,'#713f51','Barlow',400,{letterSpacing:3});
  text('Título — ESSA','ESSA',tx,ty,740,row+20,fs,'#ffffff','Roboto Slab',800);
  text('Título — LUTA','LUTA',tx,ty+row,520,row+20,fs,'#bc0655','Roboto Slab',800);
  text('Título — É','É',tx+fs*3.05,ty+row,150,row+20,fs,'#ffffff','Roboto Slab',800);
  text('Título — NOSSA','NOSSA!',tx,ty+row*2,780,row+20,fs,'#ffffff','Roboto Slab',800);
  if(wide){img('punho-lenco-rosa','Punho e lenço — fotografia',1080,60,820,1020);text('Mensagem','Faça o autoexame\nregularmente e mantenha\nsuas consultas em dia.',140,690,680,145,35,'#643441','Barlow');logo(220,865,390,155);}
  else{const ph=H*.53,pw=ph*dims['punho-lenco-rosa'].width/dims['punho-lenco-rosa'].height;img('punho-lenco-rosa','Punho e lenço — fotografia',Math.max(95,480-pw/2),H-ph,pw,ph);text('Mensagem','Faça o\nautoexame\nregularmente e\nmantenha suas\nconsultas em\ndia.',710,H*.70,305,H*.17,story?34:26,'#653b49','Barlow');logo(730,H*.89,280,H*.085);icon('Brilho rosa','star',560,H*.80,70,'#ffcedb');}
 }else if(i===1){
  grad('#ffffff','#f0eeee');const pink='#c94386';
  if(wide){text('Outubro manuscrito','outubro',100,110,880,180,165,pink,'Caveat',400);text('ROSA','ROSA',115,285,810,200,195,pink,'Montserrat',800);img('mao-laco-rosa','Mão com laço rosa',1030,80,800,1040);text('Mensagem','MÊS DE CONSCIENTIZAÇÃO\nSOBRE O CÂNCER DE MAMA',125,540,770,115,34,'#65575d','Barlow');text('Chamada','O amor próprio é um ato de cuidado.',125,680,720,100,36,pink,'Barlow',600);logo(235,875,400,160);}
  else{const t=H*.12;text('Outubro manuscrito','outubro',95,t,890,H*.12,story?170:145,pink,'Caveat',400);text('ROSA','ROSA',105,t+H*.105,880,H*.16,story?215:square?150:190,pink,'Montserrat',800);img('mao-laco-rosa','Mão com laço rosa',435,H*.34,690,H*.68);text('Mensagem','MÊS DE\nCONSCIENTIZAÇÃO\nSOBRE O CÂNCER\nDE MAMA',100,H*.47,385,H*.16,story?34:27,'#65575d','Barlow');icon('Cuidado','heart',110,H*.65,47,pink);text('Amor próprio','O amor\npróprio',175,H*.645,260,105,story?38:31,pink,'Barlow',600);logo(95,H*.84,330,H*.11);}
 }else if(i===2){
  grad('#f5f5f5','#aeb0b2');const pink='#ee3f93';
  img('laco-rosa-fluido','Laço rosa — elemento independente',wide?1000:180,-H*.08,wide?1050:850,H*.88,{rotation:-10});
  img('cadeira-odontologica-rosa','Cadeira odontológica rosa',wide?920:450,H*.21,wide?910:610,H*.51);
  const x=wide?130:145,ty=wide?150:H*.23;
  text('Mensagem — Conecte-se','Conecte-se',x,ty,wide?820:750,85,wide?80:65,'#ffffff','Montserrat',800);
  text('Mensagem — com seu','com seu',x,ty+75,650,80,wide?80:65,'#ffffff','Montserrat',800);
  text('Mensagem — corpo','corpo!',x,ty+145,620,95,wide?86:70,pink,'Montserrat',800);
  text('Título — Outubro','Outubro',wide?110:60,wide?495:H*.465,wide?830:850,145,wide?134:116,'#ffffff','Montserrat',800);
  text('Título — Rosa','Rosa',wide?110:60,(wide?495:H*.465)+125,700,140,wide?140:120,pink,'Montserrat',800);
  logo(wide?145:125,H*.82,wide?380:340,H*.11);rect('Separador do rodapé',wide?590:580,H*.83,2,H*.10,'#ffffff');text('Apoio à campanha','Nós apoiamos\nessa causa!',wide?650:635,H*.835,wide?750:390,H*.10,wide?43:31,pink,'Montserrat',700);
 }else if(i===3){
  grad('#0035f1','#0825bb');const yellow='#ffe51b';
  rect('Faixa diagonal amarela',wide?610:-160,H*(square?.85:.70),W+350,H*.12,yellow,{rotation:wide?-20:-25});
  if(wide){img('carrinho-amarelo','Carrinho cheio de compras',990,170,1000,1000);text('Venha','Venha',120,175,700,110,100,'#ffffff');text('Chamada principal','fazer suas\ncompras!',115,280,830,240,106,yellow,'Montserrat',800);text('Mensagem','Tudo em um só lugar.\nPraticidade pra você!',125,550,770,110,41,'#ffffff');rect('Selo branco',135,700,360,95,'#ffffff',{cornerRadius:32});text('Oferta editável','30% OFF',170,720,300,65,47,'#0731c7','Montserrat',800);logo(145,880,390,145);img('moeda-dourada','Moeda dourada superior',715,30,240);}
  else{const x=180,y=H*.22;text('Venha','Venha',x,y,600,105,90,'#ffffff');text('Chamada principal','fazer suas\ncompras!',x,y+90,640,180,80,yellow,'Montserrat',800);text('Mensagem','Tudo em um só lugar.\nPraticidade pra você!',x,y+280,620,85,31,'#ffffff');rect('Selo branco',650,H*.435,340,85,'#ffffff',{cornerRadius:27});text('Oferta editável','30% OFF',700,H*.435+20,270,55,38,'#0731c7','Montserrat',800);img('carrinho-amarelo','Carrinho cheio de compras',65,H*.50,1110,H*.65);img('moeda-dourada','Moeda dourada superior',670,H*.145,310);img('moeda-dourada','Moeda dourada lateral',-165,H*.73,340);logo(185,35,335,H*.12);contact(560,65,440,'#ffffff');}
 }else if(i===4){
  grad('#e4f1bc','#deefc1');const green='#448d28',lime='#cdf33e';
  if(wide){rect('Painel do título',75,100,850,370,lime,{cornerRadius:45});text('Título — Frescor e economia','Frescor e economia',140,205,730,105,62,green,'Montserrat',800);text('Título — em um só lugar','em um só lugar.',140,320,730,100,61,green);rect('Painel verde da fotografia',1020,190,800,680,'#a7d884',{cornerRadius:35});img('agricultoras-hortifruti','Agricultoras e cestas',880,170,1030,735);img('moeda-verde','Moeda verde superior',1620,30,230);img('moeda-verde','Moeda verde lateral',70,480,250);rect('Faixa da marca',75,920,1740,120,lime,{cornerRadius:20});logo(120,910,345,140);contact(760,965,880,green);}
  else{rect('Painel do título',105,H*.105,870,H*.265,lime,{cornerRadius:45});contact(230,H*.17,690,green);text('Título — Frescor e economia','Frescor e economia',180,H*.21,760,95,story?62:55,green,'Montserrat',800);text('Título — em um só lugar','em um só lugar.',180,H*.21+80,760,90,story?64:55,green);rect('Painel verde da fotografia',105,H*.395,870,H*.39,'#a6d886',{cornerRadius:40});img('agricultoras-hortifruti','Agricultoras e cestas',95,H*(square?.37:.30),950,H*(square?.43:.50));img('moeda-verde','Moeda verde superior',755,H*.025,180);img('moeda-verde','Moeda verde lateral',-5,H*.44,270);rect('Faixa da marca',105,H*.79,870,H*.15,lime,{cornerRadius:20});logo(145,H*.793,360,H*.14);contact(540,H*.835,380,green);}
 }else{
  grad('#e2e1cb','#edecd9');const blue='#092bef',yellow='#ffcf00';
  if(wide){rect('Painel do título',75,410,850,370,yellow,{cornerRadius:40});text('Título — Aqui a economia','Aqui a economia',135,495,750,90,63,blue,'Montserrat',700);text('Título — entra na sua lista','entra na sua lista\nde compras',135,590,750,150,59,blue);img('cesta-azul','Cesta azul de compras',890,200,1000,610);rect('Faixa da marca',75,890,1740,145,blue,{cornerRadius:20});logo(120,885,365,155);contact(800,945,850,'#ffffff');}
  else{img('cesta-azul','Cesta azul de compras',110,H*.19,885,H*.40);rect('Painel amarelo do título',105,H*.515,870,H*.255,yellow,{cornerRadius:38});contact(205,H*.565,700,'#795f00');text('Título — Aqui a economia','Aqui a economia',215,H*.62,690,72,story?57:49,blue,'Montserrat',700);text('Título — entra na sua lista','entra na sua lista de compras',185,H*.62+65,750,90,story?51:42,blue);rect('Faixa da marca',105,H*.80,870,H*.14,blue,{cornerRadius:20});logo(145,H*.80,350,H*.135);contact(535,H*.85,385,'#ffffff');}
  const y=wide?100:H*.125,bw=wide?400:430,bx=wide?105:105;
  rect('Cartão de ofertas',bx,y,bw,wide?170:H*.12,blue,{cornerRadius:28});icon('Ícone de ofertas','star',bx+22,y+25,55,yellow);text('Chamada de ofertas','Economia e ofertas\npara você!',bx+98,y+23,bw-115,110,wide?34:25,'#ffffff','Barlow',600);
  rect('Cartão de benefícios',bx+bw+22,y,bw,wide?170:H*.12,'#d6daca',{cornerRadius:28});icon('Ícone de benefícios','check',bx+bw+42,y+25,55,blue);text('Chamada de benefícios','Seu bolso\nagradece!',bx+bw+120,y+23,bw-115,110,wide?34:27,blue,'Barlow',600);
 }
 return{version:1,width,height,background:'#ffffff',layers};
}
const assets={};for(const [key,src]of Object.entries(sources))assets[src]=(await readFile(root+'/assets/'+key+'.png')).toString('base64');
assets['/api/art-studio/brand-logo']=(await readFile('artifacts/art-studio/dia-das-criancas/logo-auto-trim.png')).toString('base64');
const collection=[];
for(let i=0;i<entries.length;i++){const[slug,name,collectionName]=entries[i],out=root+'/'+slug;await mkdir(out+'/previews',{recursive:true});const docs=formats.map(([w,h])=>make(i,w,h));const t={name,category:i<3?'Campanhas':'Divulgação',collection:collectionName,tags:[collectionName,slug,'camadas editáveis','logo automática'],published:true,composition:{...docs[0],alternates:docs.slice(1)}};await writeFile(out+'/modelo.json',JSON.stringify(t,null,2));const render=structuredClone(docs);for(const d of render)d.layers.find(l=>l.binding==='logo').src='/api/art-studio/brand-logo';await writeFile(out+'/render.json',JSON.stringify({mode:'render',compositions:render,assets}));collection.push({slug,name,collection:collectionName});}
await writeFile(root+'/collection.json',JSON.stringify(collection,null,2));await writeFile(root+'/asset-sources.json',JSON.stringify(sources,null,2));console.log('6 modelos / 30 formatos gerados');
