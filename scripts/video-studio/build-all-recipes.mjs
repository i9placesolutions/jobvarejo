import{readFile,writeFile}from'node:fs/promises'
import sharp from 'sharp'
import{register}from'../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
register();const {PILOT_RECIPES}=await import('../../shared/video-studio/flyer-recipes.ts')
const assets=JSON.parse(await readFile('output/video-all-models/assets.json')).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
const originals=Object.values(PILOT_RECIPES).filter(r=>['alerta','relampago','saldao'].includes(r.id))
const {classifyCampaign,campaignStyle}=await import('../../shared/video-studio/campaign-direction.ts')
const variants=['whip-left','rise','slam','tilt','drop','whip-right','elastic','zoom-out'],texts=['whip','stomp','stretch','rise','word-pop','tilt','tracking'],transitions=['diagonal','whip-up','snap-zoom','shutter','slide','iris','rgb','spin']
const family=n=>/alerta/i.test(n)?'alarm':/horti|feira|verde/i.test(n)?'harvest':/carne|queima|churras|suína/i.test(n)?'embers':/relâmpago|dia d|super dia/i.test(n)?'electric':/criança|família|fim de ano/i.test(n)?'celebration':/neon/i.test(n)?'neon':/halloween/i.test(n)?'spooky':/rosa/i.test(n)?'rose':/hora|calendário|oferta do dia/i.test(n)?'clock':/industrial|preto/i.test(n)?'industrial':'spotlight'
const fx={alarm:['shockwave','speed-lines','spark-burst'],electric:['lightning','speed-lines','laser-sweep'],harvest:['dust','orbit','bokeh'],embers:['fire','embers','smoke-plumes','shockwave'],celebration:['orbit','prism','ribbons','spark-burst'],neon:['grid','laser-sweep','bokeh'],spooky:['smoke-plumes','prism','embers'],rose:['bokeh','ribbons','spotlights'],clock:['orbit','speed-lines','spark-burst'],industrial:['grid','embers','laser-sweep'],spotlight:['spotlights','prism','ribbons']}
const style={alarm:'electro',electric:'drive',harvest:'tropical',embers:'rock',celebration:'disco',neon:'synth',spooky:'dark',rose:'pop',clock:'funk',industrial:'breakbeat',spotlight:'house'}
// A identidade vem da arte original, nunca do nome da campanha.
const palettes=new Map()
for(const asset of assets){
 let base=asset.gradient?.at(-1)?.color,accent=asset.gradient?.[0]?.color
 if(asset.background){
  const {data,info}=await sharp('public/video-studio/templates/'+asset.background).resize(96,96,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true})
  const bins=new Map()
  for(let p=0;p<data.length;p+=info.channels){const rgb=[data[p],data[p+1],data[p+2]],key=rgb.map(v=>Math.floor(v/24)).join(',');const b=bins.get(key)||{sum:[0,0,0],count:0};rgb.forEach((v,i)=>b.sum[i]+=v);b.count++;bins.set(key,b)}
  const colors=[...bins.values()].sort((a,b)=>b.count-a.count).map(b=>({rgb:b.sum.map(v=>Math.round(v/b.count)),count:b.count}))
  const hex=rgb=>'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')
  base=hex(colors[0].rgb)
  const bright=colors.find(c=>c.count>15&&Math.max(...c.rgb)-Math.min(...c.rgb)>65&&Math.max(...c.rgb)>170&&c.rgb.reduce((n,v,i)=>n+Math.abs(v-colors[0].rgb[i]),0)>180)
  accent=bright?hex(bright.rgb):'#ffffff'
 }
 if(!base)throw Error('Modelo sem cor de origem: '+asset.id)
 let nativeTitleColor
 if(asset.nativeTitle){const canvas=JSON.parse(await readFile('output/video-all-models/'+asset.id+'.json'));const seal=canvas.objects.find(o=>/selo/i.test(o.name||'')&&o.text);nativeTitleColor=typeof seal?.fill==='string'?seal.fill:'#ffffff'}
 palettes.set(asset.id,{base,accent:accent||'#ffffff',nativeTitleColor})
}
const recipes=assets.map((a,i)=>{const old=originals.find(r=>r.sourceProject===a.id);const seed=parseInt(a.id.slice(0,8),16);const labelType=family(a.name),type=({bakery:'harvest',boom:'embers',alarm:'alarm',lightning:'electric',grill:'embers',clearance:'embers',harvest:'harvest',children:'celebration',celebration:'celebration',rose:'rose',spooky:'spooky',clock:'clock',neon:'neon',industrial:'industrial',show:'spotlight',savings:'spotlight',impact:'electric'})[classifyCampaign(a.name,a.id)],layout=i%6;const base=structuredClone(originals[layout%3]);
 // Três montagens verticais e seis horizontais, com alternância de lados e hierarquia.
 if(layout>=3){for(const k of Object.keys(base.horizontal)){const b=base.horizontal[k];b[0]=1920-b[0]-b[2]} }
 // Nome acompanha a coluna da etiqueta em qualquer montagem.
 for(const format of ['vertical','horizontal']){const l=base[format],height=format==='vertical'?100:96,gap=12;l.name=[l.price[0],l.price[1]-height-gap,l.price[2],height];l.condition=[l.price[0],l.name[1]-42,l.price[2],34]}
 const {base:sourceBase,accent,nativeTitleColor}=palettes.get(a.id);
 const id=old?.id||'flyer-'+a.id;const direction=campaignStyle(classifyCampaign(a.name,a.id),seed);
 return {...base,id,revision:19,energyBackground:undefined,energyBackgroundVertical:undefined,backgroundVariant:seed%6,name:a.name,campaign:a.nativeTitle?.replace(/\n/g,' ')||a.name.replace(/ — .*/,''),sourceProject:a.id,accent,base:sourceBase,background:a.background,backgroundGradient:a.gradient?.length?`linear-gradient(145deg,${a.gradient.map(s=>`${s.color} ${s.offset*100}%`).join(',')})`:undefined,seal:a.seal,nativeTitle:a.nativeTitle,nativeTitleColor,sealAspect:a.sealAspect||1,backgroundKind:type,seed,layoutName:['Preço à esquerda','Preço à direita','Preço abaixo','Vitrine invertida','Destaque lateral','Palco central'][layout],music:'model-'+a.id,musicStyle:style[labelType],bpm:([128,136,118,124,132,140][i%6]),transition:direction.transition,motion:{...base.motion,product:variants[i%variants.length],text:texts[i%texts.length],price:variants[(i+3)%variants.length],camera:['impact','swing','handheld','earthquake','zoom-pulse'][i%5],atmosphere:/boom/i.test(a.name)?['smoke-plumes','embers','spark-burst']:type==='embers'&&i%2?['fire-jets','embers','spark-burst']:fx[type],transitionSound:/boom/i.test(a.name)?'suction':['whip','air-swipe','suction','glitch'][i%4],accentSound:/boom/i.test(a.name)?'boom':['bass-hit','coin','metal-hit','boom','sparkle'][i%5],...Object.fromEntries(Object.entries(direction).filter(([key])=>key!=='transition')),transitionSound:'retail-whoosh-v1',accentSound:'retail-pop-v1'},labelNames:labelType==='electric'||labelType==='industrial'?['preto/amarelo 3d','Padrão']:labelType==='harvest'||labelType==='rose'?['Padrão','PRETA VERMELHA AMARELA']:['PRETA VERMELHA AMARELA','Padrão']}
})
await writeFile('shared/video-studio/generated-flyer-recipes.json',JSON.stringify(recipes))
await writeFile('output/video-all-models/recipes.json',JSON.stringify(recipes,null,2))
console.log('Recipes',recipes.length,'unique music',new Set(recipes.map(r=>r.music)).size)
