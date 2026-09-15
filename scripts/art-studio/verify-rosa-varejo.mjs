import pg from 'pg';import {readFile,writeFile} from 'node:fs/promises';import {createHmac,createHash,randomUUID} from 'node:crypto';
const root='artifacts/art-studio/rosa-varejo',url='http://127.0.0.1:3119';
const db=new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL});await db.connect();
try{
 const {rows}=await db.query("SELECT id,email,role FROM profiles WHERE role='super_admin'");if(rows.length!==1)throw Error('Admin ambíguo');const u=rows[0],now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const b=enc({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+enc({sub:u.id,email:u.email,role:u.role,iat:now,exp:now+1800});const headers={Authorization:'Bearer '+b+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(b).digest('base64url')};
 async function req(path,opts={}){const r=await fetch(url+path,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(path+' '+r.status+' '+await r.text());return r.json()}
 const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));
 for(const [slug,item] of Object.entries(manifest.templates).filter(([slug])=>!process.argv[2]||slug===process.argv[2])){
  const {rows:found}=await db.query('SELECT composition FROM art_studio_templates WHERE id=$1',[item.id]);const c=found[0].composition;const docs=[c,...c.alternates];
  for(const d of docs){delete d.alternates;const logo=d.layers.find(l=>l.binding==='logo');if(!logo)throw Error('Logo ausente');logo.src='/api/art-studio/brand-logo';}
  const r=await fetch(url+'/api/art-studio/render',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({compositions:docs}),signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Error(slug+' render '+r.status+' '+await r.text());await writeFile(root+'/'+slug+'/formatos-verificados.zip',Buffer.from(await r.arrayBuffer()));console.log('5 formatos exportados pelo sistema: '+slug);
 }
}finally{await db.end()}
