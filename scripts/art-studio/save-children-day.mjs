import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
const root='artifacts/art-studio/dia-das-criancas',url=process.env.ART_STUDIO_TEST_URL||'http://127.0.0.1:3119';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url))throw Error('Use o servidor local');
const db=new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL});await db.connect();
try{
 const {rows}=await db.query("SELECT id,email,role FROM profiles WHERE role='super_admin'");if(rows.length!==1)throw Error('Super admin não unívoco');
 const u=rows[0],now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const b=enc({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+enc({sub:u.id,email:u.email,role:u.role,iat:now,exp:now+600});
 const headers={Authorization:'Bearer '+b+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(b).digest('base64url')};
 async function request(path,opts={}){const r=await fetch(url+path,{...opts,headers:{...headers,...opts.headers}});if(!r.ok)throw Error(path+' '+r.status+' '+await r.text());return r.json()}
 let manifest={};try{manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'))}catch{}
 if(!manifest.asset){const form=new FormData();form.append('file',new Blob([await readFile(root+'/base.png')],{type:'image/png'}),'dia-das-criancas-3d.png');manifest.asset=await request('/api/art-studio/assets',{method:'POST',body:form});await writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2))}
 const t=JSON.parse(await readFile(root+'/modelo.json','utf8'));
 for(const doc of [t.composition,...t.composition.alternates])for(const l of doc.layers)if(l.kind==='image')l.src=manifest.asset.src;
 if(!manifest.templateId){const saved=await request('/api/art-studio/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});manifest.templateId=saved.id;manifest.revision=saved.revision;await writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2))}
 await writeFile(root+'/modelo.json',JSON.stringify(t,null,2));
 const {rows:check}=await db.query('SELECT id,name,published,composition FROM art_studio_templates WHERE id=$1',[manifest.templateId]);
 const row=check[0],docs=[row.composition,...row.composition.alternates];if(!row.published||docs.length!==5||docs.some(d=>d.layers.filter(l=>l.kind==='text'&&!l.locked).length!==4))throw Error('Verificação falhou');
 const catalog=await request('/api/art-studio/templates');if(!catalog.templates.some(t=>t.id===row.id))throw Error('Modelo ausente do catálogo');
 const assetResponse=await fetch(url+manifest.asset.src,{headers});if(!assetResponse.ok)throw Error('Imagem indisponível');
 console.log(JSON.stringify({catalogVerified:true,assetVerified:true,id:row.id,name:row.name,published:row.published,formats:docs.map(d=>`${d.width}x${d.height}`),editableTextsPerFormat:4}));
}finally{await db.end()}
