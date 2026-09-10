import * as f from 'fabric';
await Promise.all(['Barlow','Barlow Condensed'].flatMap(font=>[700,800,900].map(weight=>document.fonts.load(`${weight} 26px ${font}`))));
const manifest=await(await fetch('/manifest.json')).json(), results=[];
const save=(name,data)=>fetch('/save',{method:'POST',body:JSON.stringify({name,data})});
for(const entry of manifest){
 if(!entry.isTemplate||entry.error)continue;
 const source=await(await fetch('/'+entry.file)).json(),data=structuredClone(source),fr=data.objects.find(o=>o.isFrame);
 if(!fr)continue;
 const contacts=data.objects.filter(o=>['instagram','whatsapp','address'].includes(o.businessProfileField));
 if(!contacts.length)continue;
 const w=entry.page.width,h=entry.page.height,s=w/1080,fh=180*s,fy=h-fh;
 const rect=new f.Rect({...fr});const bounds=rect.getBoundingRect(),ox=bounds.left,oy=bounds.top;
 const existing=data.objects.find(o=>o.name==='validity-backdrop');
 const palette=data.objects.find(o=>o.isProductZone)?._zoneGlobalStyles?.templateProductPalette;
 let base=existing?.fill;
 if(typeof base!=='string'||!/^#[0-9a-f]{6}$/i.test(base))base=typeof palette?.highlightCardColor==='string'?palette.highlightCardColor:'#143827';
 const name=entry.name.toLowerCase();
 const blue=/azul/.test(name), green=/hort|verde/.test(name), orange=/família|familia|imbatível/.test(name)&&!blue, black=/maluco|carne/.test(name);
 const primary=blue?'#0757CB':green?'#08783E':orange?'#EF6500':black?'#20242B':'#CD101B';
 const accent=blue?'#FFDA24':green?'#FFE443':orange?'#FFD138':black?'#FFC928':'#FFD52A';
 base=primary;
 const oldIds=new Set(contacts.map(o=>o._customId));
 data.objects=data.objects.filter(o=>!/^footer-(premium-background|accent|contact-)/.test(o.name||'')&&!oldIds.has(o._customId)&&!['instagram','whatsapp','address'].includes(o.quickDynamicIconFor)&&o.name!=='footer-divider'&&o.name!=='footer-title'&&!/^SIGA NOSSO INSTAGRAM$|^WHATSAPP DE OFERTAS$|^ENDEREÇO$/i.test(o.text||''));
 const add=(obj,props={})=>{const o=obj.toObject();Object.assign(o,{_customId:crypto.randomUUID(),parentFrameId:fr._customId,isQuickGenerated:true,...props});data.objects.push(o);return o};
 const box=(x,y,width,height,fill,props={})=>add(new f.Rect({left:ox+x,top:oy+y,width,height,originX:'left',originY:'top',fill,strokeWidth:0,rx:14*s,ry:14*s}),props);
 box(0,fy,w,fh,base,{name:'footer-premium-background',layerName:'Rodapé — fundo',lockMovementX:true,lockMovementY:true});
 box(0,fy,w,4*s,accent,{name:'footer-accent',opacity:.75});
 const margin=16*s,gap=12*s,inner=w-2*margin,first=(inner-gap)*.63,second=inner-gap-first;
 const cards=[{field:'instagram',x:margin,y:fy+12*s,width:first,height:72*s,label:'SIGA NOSSO INSTAGRAM',size:25*s,value:'@SUALOJA'}, {field:'whatsapp',x:margin+first+gap,y:fy+12*s,width:second,height:72*s,label:'WHATSAPP DE OFERTAS',size:34*s,value:'(11) 99999-9999'}, {field:'address',x:margin,y:fy+92*s,width:inner,height:76*s,label:'NOSSO ENDEREÇO',size:22*s,value:'RUA DA LOJA, 100 — BAIRRO, CIDADE - UF'}];
 const checks=[];
 for(const card of cards){
 box(card.x,card.y,card.width,card.height,card.field==='whatsapp'?accent:card.field==='address'?'#FFF7E1':'#FFFFFF',{name:'footer-contact-'+card.field,layerName:'Destaque '+card.field});
 const ix=card.x+14*s,iy=card.y+16*s,iconSize=40*s;
 const paths=card.field==='instagram'?'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="${primary}"/>':card.field==='whatsapp'?'<path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.5-4.9A8.4 8.4 0 1 1 20.5 11.6Z"/><path fill="${primary}" stroke="none" d="M8.6 6.7c-.4 0-.7.2-.9.5-.6.7-.9 1.6-.6 2.5.6 2.4 3.3 5.2 5.9 6 .9.3 1.9.1 2.5-.5.4-.4.7-1.2.5-1.5l-2.2-1.1c-.3-.1-.5 0-.7.3l-.8.9c-1.6-.7-2.7-1.8-3.4-3.2l.8-.9c.2-.2.3-.4.2-.7l-.9-2.1c-.1-.2-.2-.2-.4-.2Z"/>':'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>';
 const svg=await f.loadSVGFromString(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke="${primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths.replaceAll('${primary}',primary)}</g></svg>`);const icon=f.util.groupSVGElements(svg.objects.filter(Boolean),svg.options);icon.set({originX:'left',originY:'top',left:ox+ix,top:oy+iy,scaleX:iconSize/icon.width,scaleY:iconSize/icon.height});add(icon,{name:'icon-'+card.field,quickDynamicIconFor:card.field,layerName:'Ícone '+card.field});
 const tx=card.x+70*s,tw=card.width-84*s;
 add(new f.Textbox(card.label,{left:ox+tx,top:oy+card.y+5*s,width:tw,fontFamily:'Barlow',fontWeight:800,fontSize:10*s,fill:primary,opacity:1,originX:'left',originY:'top',strokeWidth:0}),{name:'footer-title',layerName:card.label});
 const text=new f.Textbox(card.value,{left:ox+tx,top:oy+card.y+(card.field==='address'?18:25)*s,width:tw,fontFamily:'Barlow Condensed',fontWeight:800,fontSize:card.size,fill:'#17232D',originX:'left',originY:'top',lineHeight:1.04,splitByGrapheme:false,strokeWidth:0});
 add(text,{businessProfileField:card.field,quickFieldEnabled:true,dynamicFieldResizeMode:'reflow',dynamicFieldKey:card.field,dynamicFieldBaseFontSize:card.size,dynamicFieldAutoFitFontSize:card.size,dynamicUserText:card.value,__rawText:card.value,name:'dynamic-'+card.field,layerName:card.label});
 const test=card.field==='instagram'?'@WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW':card.field==='whatsapp'?'(99) 99999-9999':'RUA GARIBALDI LEÃO Nº 277, BAIRRO MARTINS, RIO VERDE - GO';text.set({text:test});text.initDimensions();
 checks.push({field:card.field,lines:text.textLines.length,height:text.height,available:card.height-(card.field==='address'?18:25)*s-6*s,width:text.width,availableWidth:tw});
 if(card.field==='address'){text.set({text:'ENDEREÇO COMPLETO COM RUA E NÚMERO\nBAIRRO, CIDADE E ESTADO'});text.initDimensions();checks.push({field:'address',lines:text.textLines.length,height:text.height,available:card.height-(card.field==='address'?18:25)*s-6*s,width:text.width,availableWidth:tw});}
 }
 for(const z of data.objects.filter(o=>o.isProductZone)){
 if(z._zoneStateSnapshot?.cards?.length)throw Error('Modelo com produtos: '+entry.name);
 const scaleY=z.scaleY||1,top=(z.originY==='center'?z.top-z.height*scaleY/2:z.top),newHeight=(oy+fy-12*s-top)/scaleY;if(newHeight<100)throw Error('Zona insuficiente '+entry.name);
 z.height=newHeight;z._zoneHeight=newHeight;if(z.originY==='center')z.top=top+newHeight*scaleY/2;
 if(z.objects?.[0])z.objects[0].height=newHeight;
 if(z._zoneStateSnapshot?.zone?.geometry)Object.assign(z._zoneStateSnapshot.zone.geometry,{height:newHeight,y:z.top});
 }
 await save(entry.file.replace('.json','-fixed.json'),data);results.push({...entry,repair:{changed:true,unresolved:[]},checks});
}
const failures=results.filter(x=>x.checks.some(c=>(c.field!=='address'&&c.lines!==1)||c.height>c.available||c.width>c.availableWidth+.5)).map(x=>({name:x.name,format:x.page.templateFormatId,checks:x.checks}));
await fetch('/result',{method:'POST',body:JSON.stringify({results,summary:{pages:results.length,failures}})});document.querySelector('#status').textContent='Concluído '+results.length;
