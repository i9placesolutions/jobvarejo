import pg from 'pg';import {readFile,writeFile} from 'node:fs/promises';import {createHmac,createHash,randomUUID} from 'node:crypto';
const root='artifacts/art-studio/rosa-varejo',url='http://127.0.0.1:3119';
const db=new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL});await db.connect();
try{
 const {rows}=await db.query("SELECT id,email,role FROM profiles WHERE role='super_admin'");if(rows.length!==1)throw Error('Admin ambíguo');const u=rows[0],now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const b=enc({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+enc({sub:u.id,email:u.email,role:u.role,iat:now,exp:now+1800});const headers={Authorization:'Bearer '+b+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(b).digest('base64url')};
 async function req(path,opts={}){const r=await fetch(url+path,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(path+' '+r.status+' '+await r.text());return r.json()}
 let manifest={elements:{},templates:{}};try{manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'))}catch{}
 const persist=()=>writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2));
 const sources=JSON.parse(await readFile(root+'/asset-sources.json','utf8'));
 for(const name of Object.keys(sources)){
  const bytes=await readFile(root+'/assets/'+name+'.png'),hash=createHash('sha256').update(bytes).digest('hex');
  const key=`imagens/biblioteca/elementos/rosa-varejo/${name}-${hash.slice(0,12)}.png`;
  if(!manifest.elements[name]||manifest.elements[name].sha256!==hash){
   await req('/api/storage/upload?key='+encodeURIComponent(key)+'&contentType=image/png',{method:'POST',headers:{'Content-Type':'image/png'},body:bytes});
   const existing=await db.query('SELECT id FROM art_studio_assets WHERE owner_id=$1 AND storage_key=$2',[u.id,key]);const id=existing.rows[0]?.id||randomUUID();
   if(!existing.rowCount)await db.query('INSERT INTO art_studio_assets(id,owner_id,storage_key,shared) VALUES($1,$2,$3,true)',[id,u.id,key]);
   manifest.elements[name]={id,src:'/api/art-studio/assets/'+id,key,sha256:hash};await persist();
  }
  const e=manifest.elements[name];await req('/api/asset-names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({asset_key:e.key,display_name:'Rosa e Varejo — '+name.replaceAll('-',' ')})});
  const r=await fetch(url+e.src,{headers});if(!r.ok)throw Error('Download '+name);const received=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(received).digest('hex')!==hash)throw Error('Bytes divergentes '+name);
  console.log('Asset validado: '+name);
 }
 const collection=JSON.parse(await readFile(root+'/collection.json','utf8'));
 for(const item of collection.filter(item=>!process.argv[2]||item.slug===process.argv[2])){
  const t=JSON.parse(await readFile(root+'/'+item.slug+'/modelo.json','utf8'));
  const docs=[t.composition,...t.composition.alternates];
  if(docs.length!==5||docs.some(d=>d.layers.some(l=>l.locked)||d.layers.filter(l=>l.binding==='logo').length!==1))throw Error('Camadas inválidas '+item.slug);
  for(const doc of docs)for(const l of doc.layers)if(l.kind==='image'&&l.binding!=='logo'){
   const name=Object.keys(sources).find(k=>sources[k]===l.src||manifest.elements[k].src===l.src);if(!name)throw Error('Asset sem origem');l.src=manifest.elements[name].src;
  }
  const id=manifest.templates[item.slug]?.id;let saved;
  if(id){const q=await db.query('SELECT revision FROM art_studio_templates WHERE id=$1 AND owner_id=$2',[id,u.id]);if(q.rowCount!==1)throw Error('Modelo inexistente');t.revision=q.rows[0].revision;saved=await req('/api/art-studio/templates/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});}
  else saved=await req('/api/art-studio/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});
  manifest.templates[item.slug]={id:saved.id,name:saved.name,revision:saved.revision,published:saved.published,formats:docs.length};await persist();await writeFile(root+'/'+item.slug+'/modelo-publicado.json',JSON.stringify(saved,null,2));console.log('Modelo publicado: '+saved.name);
 }
 const catalog=await req('/api/art-studio/templates');for(const entry of Object.values(manifest.templates)){const t=catalog.templates.find(x=>x.id===entry.id);if(!t?.published||t.composition.alternates.length!==4)throw Error('Ausente catálogo '+entry.name)}
 const library=await req('/api/assets?category=elementos&search=rosa-varejo&ai=0&limit=100');const found=new Set(library.map(x=>x.key));for(const e of Object.values(manifest.elements))if(!found.has(e.key))throw Error('Não listado na biblioteca '+e.key);
 await writeFile(root+'/verification.json',JSON.stringify({catalogVerified:true,libraryVerified:true,templates:Object.values(manifest.templates),assets:Object.values(manifest.elements).map(e=>({key:e.key,sha256:e.sha256}))},null,2));
 console.log(`Catálogo e biblioteca verificados: ${Object.keys(manifest.templates).length} modelos, ${Object.keys(manifest.elements).length} elementos.`);
}finally{await db.end()}
