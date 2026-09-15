import pg from 'pg';import {readFile,writeFile} from 'node:fs/promises';import {createHmac,createHash,randomUUID} from 'node:crypto';
const root='artifacts/art-studio/dia-das-criancas',url='http://127.0.0.1:3119';
const db=new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL});await db.connect();
try{
 const {rows}=await db.query("SELECT id,email,role FROM profiles WHERE role='super_admin'");if(rows.length!==1)throw Error('Admin ambíguo');const u=rows[0],now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const b=enc({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+enc({sub:u.id,email:u.email,role:u.role,iat:now,exp:now+1800});const headers={Authorization:'Bearer '+b+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(b).digest('base64url')};
 async function req(path,opts={}){const r=await fetch(url+path,{...opts,headers:{...headers,...opts.headers}});if(!r.ok)throw Error(path+' '+r.status+' '+await r.text());return r.json()}
 const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));manifest.elements??={};const sources=JSON.parse(await readFile(root+'/asset-sources.json','utf8'));
 for(const [name,source] of Object.entries(sources)){
  const bytes=await readFile(root+'/assets/'+name+'.png'),hash=createHash('sha256').update(bytes).digest('hex');
  const key=`imagens/biblioteca/elementos/dia-das-criancas/${name}-${hash.slice(0,12)}.png`;
  if(!manifest.elements[name]){
   await req('/api/storage/upload?key='+encodeURIComponent(key)+'&contentType=image/png',{method:'POST',headers:{'Content-Type':'image/png'},body:bytes});
   const existing=await db.query('SELECT id FROM art_studio_assets WHERE owner_id=$1 AND storage_key=$2',[u.id,key]);const id=existing.rows[0]?.id||randomUUID();
   if(!existing.rowCount)await db.query('INSERT INTO art_studio_assets(id,owner_id,storage_key,shared) VALUES($1,$2,$3,true)',[id,u.id,key]);
   manifest.elements[name]={id,src:'/api/art-studio/assets/'+id,key,sha256:hash};await writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2));
  }
  const element=manifest.elements[name];
  await req('/api/asset-names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({asset_key:element.key,display_name:'Dia das Crianças — '+name})});
  const r=await fetch(url+element.src,{headers});if(!r.ok)throw Error('Falha leitura '+name);const downloaded=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(downloaded).digest('hex')!==hash)throw Error('Bytes divergentes '+name);
  console.log('Elemento salvo e download validado: '+name);
 }
 const t=JSON.parse(await readFile(root+'/modelo.json','utf8'));for(const doc of [t.composition,...t.composition.alternates])for(const layer of doc.layers)if(layer.kind==='image'&&layer.binding!=='logo'){const key=Object.keys(sources).find(k=>sources[k]===layer.src);if(!key)throw Error('Fonte inválida');layer.src=manifest.elements[key].src;}
 const old=await db.query('SELECT revision,composition FROM art_studio_templates WHERE id=$1',[manifest.templateId]);await writeFile(root+'/composition-before-layers.json',JSON.stringify(old.rows[0],null,2));
 t.revision=old.rows[0].revision;const saved=await req('/api/art-studio/templates/'+manifest.templateId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});manifest.revision=saved.revision;
 await writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(root+'/modelo.json',JSON.stringify(saved,null,2));
 const catalog=await req('/api/art-studio/templates');const found=catalog.templates.find(x=>x.id===manifest.templateId);if(!found)throw Error('Ausente catálogo');
 const docs=[found.composition,...found.composition.alternates];if(docs.length!==5||docs.some(d=>d.layers.some(l=>l.locked)||d.layers.filter(l=>l.kind==='image'&&l.binding!=='logo').length!==9||d.layers.filter(l=>l.binding==='logo').length!==1))throw Error('Camadas incorretas');
 const library=await req('/api/assets?category=elementos&search=dia-das-criancas&ai=0&limit=100');await writeFile(root+'/library-check.json',JSON.stringify(library.map(({url,...item})=>item),null,2));
 console.log(JSON.stringify({templateId:found.id,revision:saved.revision,formats:docs.map(d=>({size:`${d.width}x${d.height}`,layers:d.layers.length})),elements:Object.keys(manifest.elements).length}));
}finally{await db.end()}
