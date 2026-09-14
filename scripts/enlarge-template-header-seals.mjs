#!/usr/bin/env node
// Ajuste exclusivo dos selos dos modelos: dry-run por padrão, revisões novas e CAS.
import pg from 'pg'
import sharp from 'sharp'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { objectBounds } from './standardize-flyer-template-dynamics.mjs'
import { createTemplateRenderer } from './lib/fabric-template-renderer.mjs'

const args = Object.fromEntries(process.argv.slice(2).map(x => { const [k,...v]=x.split('='); return [k,v.join('=') || true] }))
const owner = args['--owner']
const output = args['--output']
if (!owner || !output) throw new Error('--owner e --output são obrigatórios')
const bucket = process.env.WASABI_BUCKET
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//,'')}`, region:process.env.WASABI_REGION, forcePathStyle:true, credentials:{accessKeyId:process.env.WASABI_ACCESS_KEY,secretAccessKey:process.env.WASABI_SECRET_KEY} })
const db = () => new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL})
const keyOf = value => {
  const s=String(value || '')
  if (s.startsWith('data:')) return s
  if (s.includes('?')) return new URL(s,'http://local').searchParams.get('key') || ''
  return s.replace(/^https?:\/\/[^/]+\//,'').replace(new RegExp(`^${bucket}/`),'')
}
const cache = new Map()
const asset = key => {
  if (!cache.has(key)) cache.set(key, key.startsWith('data:') ? Promise.resolve(Buffer.from(key.split(',')[1],'base64')) : s3.send(new GetObjectCommand({Bucket:bucket,Key:key})).then(async r=>Buffer.from(await r.Body.transformToByteArray())))
  return cache.get(key)
}
const load = async key => { let b=await asset(key); if(b[0]===31 && b[1]===139)b=gunzipSync(b); return JSON.parse(b) }
const alphaCache=new Map()
async function alphaBox(key) {
  if (!alphaCache.has(key)) alphaCache.set(key,(async()=>{
    const {data,info}=await sharp(await asset(key)).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    let x=info.width,y=info.height,right=0,bottom=0
    for(let j=0;j<info.height;j++)for(let i=0;i<info.width;i++)if(data[(j*info.width+i)*info.channels+info.channels-1]>0){x=Math.min(x,i);y=Math.min(y,j);right=Math.max(right,i+1);bottom=Math.max(bottom,j+1)}
    if(right<=x||bottom<=y)throw new Error('Selo totalmente transparente')
    return {x,y,width:right-x,height:bottom-y}
  })())
  return alphaCache.get(key)
}
const intersect=(a,b)=>a.left<b.right-0.01&&a.right>b.left+0.01&&a.top<b.bottom-0.01&&a.bottom>b.top+0.01
async function adjust(canvas,page) {
  const all=canvas.objects||[]
  const frame=all.find(o=>o.isFrame)
  if(!frame)return []
  const f=objectBounds(frame),gap=Math.max(8,f.width/1080*10)
  const seals=all.filter(o=>o.visible!==false && /selo|seal/i.test(o.name||'') && String(o.type).toLowerCase()==='image')
  const changes=[]
  for(const seal of seals){
    if(Number(seal.angle||0)!==0 || Number(seal.skewX||0)||Number(seal.skewY||0)){changes.push({name:seal.name,skipped:'rotacionado: requer ajuste específico'});continue}
    const previous=objectBounds(seal)
    const obstacles=all.filter(o=>o!==seal&&!seals.includes(o)&&o.visible!==false&&!o.isFrame&&!/fundo|background|cenário/i.test(o.name||'')&&!(String(o.type).toLowerCase()==='image'&&objectBounds(o).width>=f.width*.9)).map(objectBounds)
    // A superfície de produtos também é protegida, mesmo sendo um fundo.
    for(const o of all.filter(o=>o.name==='product-area-background'))obstacles.push(objectBounds(o))
    const area={left:f.left+gap,top:f.top+gap,right:f.right-gap,bottom:f.bottom-gap}
    const cx=previous.left+previous.width/2,cy=previous.top+previous.height/2
    for(const o of obstacles){
      if(o.left>=cx&&o.top<previous.bottom&&o.bottom>previous.top)area.right=Math.min(area.right,o.left-gap)
      else if(o.right<=cx&&o.bottom>previous.top&&o.top<previous.bottom)area.left=Math.max(area.left,o.right+gap)
      if(o.top>=cy&&o.left<area.right&&o.right>area.left)area.bottom=Math.min(area.bottom,o.top-gap)
    }
    if(area.right<=area.left||area.bottom<=area.top){changes.push({name:seal.name,skipped:'sem área segura'});continue}
    const alpha=await alphaBox(keyOf(seal.__originalSrc||seal.src))
    const scale=Math.min((area.right-area.left)/alpha.width,(area.bottom-area.top)/alpha.height)
    const width=alpha.width*scale,height=alpha.height*scale
    const next={left:area.left+(area.right-area.left-width)/2,top:area.top+(area.bottom-area.top-height)/2,width,height}
    next.right=next.left+width;next.bottom=next.top+height
    if(obstacles.some(o=>intersect(next,o))){changes.push({name:seal.name,skipped:'outro elemento ocupa o espaço'});continue}
    // Recorta exclusivamente pixels alpha=0, nunca conteúdo visível.
    Object.assign(seal,{cropX:alpha.x,cropY:alpha.y,width:alpha.width,height:alpha.height,originX:'left',originY:'top',left:next.left,top:next.top,scaleX:scale,scaleY:scale})
    changes.push({name:seal.name,before:previous,after:next,alpha})
  }
  return changes
}
await mkdir(output,{recursive:true})
let plans=[]
if(args['--apply'] || args['--review']) plans=JSON.parse(await readFile(`${output}/plan.json`,'utf8'))
else {
  const c=db();await c.connect()
  const {rows}=await c.query('select id,name,user_id,canvas_data,template_config,preview_url,updated_at from projects where user_id=$1 and is_template=true order by name',[owner]);await c.end()
  for(const project of rows){
    const entries=[]
    for(const page of project.canvas_data||[]){
      const canvas=await load(keyOf(page.canvasDataPath))
      const changes=await adjust(canvas,page)
      entries.push({page,canvas,changes})
    }
    plans.push({project,entries})
    console.error(`Planejado: ${project.name}`)
  }
  await writeFile(`${output}/plan.json`,JSON.stringify(plans))
}
if(args['--review']) {
  for(const plan of plans)for(const entry of plan.entries){
    const objects=entry.canvas.objects||[],frame=objects.find(o=>o.isFrame),card=objects.find(o=>o.name==='standard-validity-background')
    if(!frame||!card)continue
    const f=objectBounds(frame),b=objectBounds(card),gap=Math.max(8,f.width/1080*10)
    if(b.top>f.top+f.height*.5)continue
    const members=objects.filter(o=>o===card||o.quickValidityLayout==='calendar-card'||/^(validity-heading|stock-validity|reference-validity-|header-validity-calendar)/.test(o.name||''))
    const area={left:f.left+gap,top:f.top+gap,right:f.right-gap,bottom:f.bottom-gap}
    const obstacles=objects.filter(o=>!members.includes(o)&&o!==frame&&o.visible!==false&&!/fundo|cenário/i.test(o.name||'')&&(!/background/i.test(o.name||'')||o.name==='product-area-background')).map(objectBounds)
    for(const o of obstacles){
      if(o.bottom<=b.top&&o.right>b.left)area.top=Math.max(area.top,o.bottom+gap)
      if(o.top>=b.bottom-1)area.bottom=Math.min(area.bottom,o.top-gap)
      if(o.right<=b.left&&o.bottom>b.top&&o.top<b.bottom)area.left=Math.max(area.left,o.right+gap)
    }
    const scale=Math.min(1.25,(area.right-area.left)/b.width,(area.bottom-area.top)/b.height)
    if(scale<=1.01)continue
    const width=b.width*scale,height=b.height*scale,left=area.right-width,top=area.bottom-height
    const after={left,top,width,height,right:left+width,bottom:top+height}
    if(obstacles.some(o=>intersect(after,o)))continue
    for(const o of members){o.left=left+(o.left-b.left)*scale;o.top=top+(o.top-b.top)*scale;o.scaleX=(o.scaleX??1)*scale;o.scaleY=(o.scaleY??1)*scale}
    entry.changes.push({name:'Ofertas válidas',before:b,after})
  }
  await writeFile(`${output}/plan.json`,JSON.stringify(plans))
}
const renderer=await createTemplateRenderer(async key=>asset(key))
try{
  const prepared=[]
  for(const [i,plan] of plans.entries()){
    if(plan.project.user_id!==owner)throw new Error('Owner divergente no plano')
    const pages=[]
    for(const [j,entry] of plan.entries.entries()){
      if(!entry.changes.some(x=>x.after)){pages.push(entry.page);continue}
      const rendering=structuredClone(entry.canvas)
      const thumb=await renderer.render(rendering,entry.page.width,entry.page.height)
      await writeFile(`${output}/${i}-${j}.png`,thumb)
      if(!args['--apply']){pages.push(entry.page);continue}
      const prefix=`projects/${owner}/${plan.project.id}/header-seals/${Date.now()}`
      const path=`${prefix}/page_${entry.page.id}.json.gz`,thumbnailUrl=`${prefix}/thumb_${entry.page.id}.png`
      const raw=JSON.stringify(entry.canvas)
      await s3.send(new PutObjectCommand({Bucket:bucket,Key:path,Body:gzipSync(raw),ContentType:'application/json',ContentEncoding:'gzip'}))
      await s3.send(new PutObjectCommand({Bucket:bucket,Key:thumbnailUrl,Body:thumb,ContentType:'image/png'}))
      if(JSON.stringify(await load(path))!==raw)throw new Error('Readback divergente')
      pages.push({...entry.page,canvasDataPath:path,thumbnailUrl,canvasSavedAt:new Date().toISOString()})
    }
    prepared.push({project:plan.project,pages})
    console.error(`Renderizado: ${i+1}/${plans.length} ${plan.project.name}`)
  }
  if(args['--apply']){
    const c=db();await c.connect();await c.query('begin')
    try{
      for(const {project,pages} of prepared){
        if(JSON.stringify(pages)===JSON.stringify(project.canvas_data))continue
        const config=structuredClone(project.template_config||{})
        if(Array.isArray(config.pageBlueprints))config.pageBlueprints=config.pageBlueprints.map(b=>{const p=pages.find(p=>p.id===b.sourcePageId);return p?{...b,canvasDataPath:p.canvasDataPath,thumbnailUrl:p.thumbnailUrl}:b})
        const result=await c.query('update projects set canvas_data=$1::jsonb,template_config=$2::jsonb,preview_url=$3,updated_at=now() where id=$4 and user_id=$5 and is_template=true and canvas_data=$6::jsonb and template_config is not distinct from $7::jsonb returning id',[JSON.stringify(pages),JSON.stringify(config),pages.find(p=>p.templateFormatId==='feed')?.thumbnailUrl||pages[0]?.thumbnailUrl,project.id,owner,JSON.stringify(project.canvas_data),JSON.stringify(project.template_config)])
        if(result.rowCount!==1)throw new Error(`Edição concorrente: ${project.name}`)
      }
      await c.query('commit')
    }catch(e){await c.query('rollback');throw e}finally{await c.end()}
  }
  const report=plans.map(({project,entries})=>({id:project.id,name:project.name,pages:entries.map(e=>({format:e.page.templateFormatId,changes:e.changes}))}))
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify({applied:!!args['--apply'],templates:plans.length,changedPages:plans.flatMap(p=>p.entries).filter(e=>e.changes.some(c=>c.after)).length,output}))
}finally{await renderer.close();s3.destroy()}
