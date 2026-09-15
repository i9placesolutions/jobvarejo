import {readFile,writeFile,mkdir} from 'node:fs/promises'
const root='artifacts/art-studio/dia-das-criancas';await mkdir(root+'/previews',{recursive:true})
const dims=JSON.parse(await readFile(root+'/asset-dimensions.json','utf8'));
const keys=Object.keys(dims),sources=Object.fromEntries(keys.map((k,i)=>[k,`/api/art-studio/assets/22222222-2222-4222-8222-${String(i+1).padStart(12,'0')}`]));
function compose(w,h){
 const layers=[];let n=0;const s=w/1080;
 const add=(kind,name,x,y,width,height,props={})=>{const l={id:`criancas-${++n}`,kind,name,x,y,width,height,rotation:0,opacity:1,visible:true,locked:false,fill:'#ffffff',...props};layers.push(l);return l};
 const shape=(name,x,y,ww,hh,fill,props={})=>add('shape',name,x,y,ww,hh,{shape:'rect',fill,...props});
 const img=(key,name,x,y,ww)=>add('image',name,x,y,ww,ww*dims[key].height/dims[key].width,{src:sources[key],fit:'contain'});
 const text=(name,value,x,y,ww,hh,fontSize,fill,props={})=>add('text',name,x,y,ww,hh,{text:value,fontFamily:'Barlow',fontWeight:800,fontSize,fill,lineHeight:1.05,align:'center',...props});
 const star=(x,y,size)=>add('icon','Estrela — cor editável',x,y,size,size,{icon:'star',fill:'#ffdc26'});
 const cloud=(x,y,size)=>shape('Nuvem — cor editável',x,y,size,size*.55,'#ffffff',{shape:'path',pathData:'M 20 95 C 0 95 0 45 20 45 C 15 10 55 0 65 35 C 85 20 100 45 92 60 C 110 90 90 100 75 95 Z'});
 shape('Fundo azul — cor editável',0,0,w,h,'#22bdf1');
 shape('Faixa amarela — cor editável',0,0,w,h*.48,'#ffdc00',{shape:'path',pathData:'M 0 0 L 100 0 L 100 70 L 0 100 Z'});
 const heading=(cx,y,width)=>{const q=width/1000;img('placa','Placa 3D independente',cx-165*q,y,330*q);text('Título editável','Feliz',cx-115*q,y+98*q,230*q,84*q,75*q,'#1446de');text('Complemento editável','dia das',cx-110*q,y+170*q,220*q,50*q,43*q,'#00aeec');img('titulo','CRIANÇAS — lettering 3D independente',cx-width/2,y+215*q,width)};
 const names=['Menina — personagem independente','Menino ruivo — personagem independente','Menino de amarelo — personagem independente','Menino cacheado — personagem independente'];
 const people=['menina','ruivo','amarelo','cacheado'];
 if(w>h){
 heading(480,35,860);
 people.forEach((k,i)=>img(k,names[i],940+i*195,385,365));
 text('Data editável','12 de Outubro',100,575,730,70,48,'#0751ce');
 text('Mensagem editável','Ser criança é ter uma\nimaginação sem limites.',90,685,750,190,58,'#ffffff');
 img('presente','Presente superior',1620,65,125);img('aviao','Avião independente',890,150,150);img('foguete','Foguete independente',1695,780,170);
 cloud(75,95,110);cloud(1250,135,110);star(1120,825,65);star(725,935,60);star(1750,285,55);
 }else if(h/w>1.65){
 heading(w/2,65*s,990*s);
 people.forEach((k,i)=>img(k,names[i],(i%2===0?130:580)*s,(i<2?600:1090)*s,360*s));
 text('Data editável','12 de Outubro',80*s,1580*s,920*s,65*s,47*s,'#0751ce');
 text('Mensagem editável','Ser criança é ter uma\nimaginação sem limites.',70*s,1665*s,940*s,165*s,62*s,'#ffffff');
 img('presente','Presente superior',830*s,80*s,125*s);img('aviao','Avião independente',20*s,1020*s,165*s);img('foguete','Foguete independente',885*s,1015*s,165*s);
 cloud(60*s,135*s,120*s);cloud(830*s,525*s,110*s);star(75*s,555*s,58*s);star(950*s,1500*s,60*s);star(460*s,1140*s,55*s);
 }else{
 const square=w===h;
 const H=h/s;
 heading(w/2,10*s,1000*s);
 const y=square?435:Math.round(H*.43),pw=square?310:320;
 people.forEach((k,i)=>img(k,names[i],(12+i*248)*s,y*s,pw*s));
 const dateY=square?850:H-235;
 text('Data editável','12 de Outubro',90*s,dateY*s,900*s,55*s,37*s,'#0751ce');
 text('Mensagem editável','Ser criança é ter uma\nimaginação sem limites.',70*s,(dateY+65)*s,940*s,130*s,49*s,'#ffffff');
 img('presente','Presente superior',850*s,65*s,105*s);img('aviao','Avião independente',25*s,(square?365:450)*s,130*s);img('foguete','Foguete independente',930*s,(square?370:460)*s,125*s);
 cloud(70*s,80*s,115*s);cloud(760*s,410*s,95*s);star(215*s,130*s,48*s);star(970*s,(H-105)*s,55*s);star(28*s,(H-110)*s,48*s);
 }
 // Ajustes próprios por proporção: elementos maiores e rodapé com marca legível.
 const get=(name)=>layers.find(l=>l.name===name);
 const set=(name,values)=>Object.assign(get(name),values);
 const placePerson=(i,x,y,width)=>set(names[i],{x,y,width,height:width*dims[people[i]].height/dims[people[i]].width});
 let lx,ly,lw,lh;
 if(w>h){
  people.forEach((_,i)=>placePerson(i,i%2?1450:1000,i<2?35:555,385));
  set('Presente superior',{x:810,y:55,width:135,height:132});
  set('Avião independente',{x:820,y:440,width:150,height:100});
  set('Foguete independente',{x:1730,y:875,width:140,height:123});
  set('Data editável',{x:65,y:535,width:800,height:80,fontSize:60});
  set('Mensagem editável',{x:55,y:640,width:820,height:220,fontSize:72});
  lx=335;ly=900;lw=300;lh=140;
 }else{
  const H=h/s;
  if(H>1700){
   people.forEach((_,i)=>placePerson(i,(i%2?560:60)*s,(i<2?535:1090)*s,440*s));
   set('Data editável',{y:1650*s,height:60*s,fontSize:51*s});
   set('Mensagem editável',{y:1720*s,height:110*s,fontSize:52*s});
   lx=415*s;ly=1830*s;lw=250*s;lh=85*s;
  }else if(w===h){
   people.forEach((_,i)=>placePerson(i,(5+i*246)*s,413*s,335*s));
   set('Data editável',{y:840*s,height:40*s,fontSize:34*s});
   set('Mensagem editável',{y:885*s,height:90*s,fontSize:42*s});
   lx=430*s;ly=978*s;lw=220*s;lh=92*s;
  }else{
   people.forEach((_,i)=>placePerson(i,(5+i*220)*s,(H>1400?525:465)*s,410*s));
   const footer=H>1400?1115:1010;
   set('Data editável',{y:footer*s,height:60*s,fontSize:49*s});
   set('Mensagem editável',{y:(footer+75)*s,height:155*s,fontSize:62*s});
   lx=390*s;ly=(H-145)*s;lw=300*s;lh=125*s;
  }
 }
 // Marca com presença visual, sem competir com a mensagem.
 if(w>h){lx=280;ly=850;lw=400;lh=200;set('Mensagem editável',{y:635,height:195,fontSize:66});}
 else if(w===h){
  people.forEach((_,i)=>placePerson(i,(5+i*246)*s,405*s,320*s));
  set('Data editável',{y:805*s,height:40*s});set('Mensagem editável',{y:855*s,height:85*s,fontSize:40*s});
  lx=390*s;ly=945*s;lw=300*s;lh=125*s;
 }else if(h/s>1700){
  set('Data editável',{y:1630*s,height:50*s});set('Mensagem editável',{y:1690*s,height:100*s,fontSize:49*s});
  lx=385*s;ly=1795*s;lw=310*s;lh=115*s;
 }else if(h/s>1400){lx=330*s;ly=(h/s-180)*s;lw=420*s;lh=165*s;}
 else{
  set('Data editável',{y:1000*s,height:50*s});set('Mensagem editável',{y:1060*s,height:110*s,fontSize:49*s});
  lx=350*s;ly=1180*s;lw=380*s;lh=155*s;
 }
 add('image','Logo automática da loja',lx,ly,lw,lh,{src:'',binding:'logo',fit:'contain',autoTrim:true,logoOutline:true,logoOutlineColor:'#ffffff',logoOutlineWidth:3,logoPadding:0});
 return{version:1,width:w,height:h,background:'#22bdf1',layers};
}
const all=[[1080,1080],[1080,1350],[1080,1920],[794,1123],[1920,1080]].map(([w,h])=>compose(w,h));
const template={name:'Dia das Crianças — alegria em 3D',category:'Datas comemorativas',collection:'Dia das Crianças',tags:['crianças','12 de outubro','3D','camadas separadas','infantil'],published:true,composition:{...all[0],alternates:all.slice(1)}};
await writeFile(root+'/modelo.json',JSON.stringify(template,null,2));
const assets={};for(const key of keys)assets[sources[key]]=(await readFile(root+'/assets/'+key+'.png')).toString('base64');
await writeFile(root+'/render.json',JSON.stringify({mode:'render',compositions:all,assets}));
await writeFile(root+'/asset-sources.json',JSON.stringify(sources,null,2));
