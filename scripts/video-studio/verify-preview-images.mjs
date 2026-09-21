// Integração local com a conta explicitamente selecionada. Token só em memória.
import pg from 'pg'
import {createHmac} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
register()
const {newVideoDocument,videoSpeechSource,suggestVideoScripts}=await import('../../shared/video-studio/model.ts')
const base=process.env.VIDEO_TEST_BASE||'http://127.0.0.1:3042'
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Teste permitido somente na instância local.')
const userId=process.env.VIDEO_TEST_USER_ID;if(!userId)throw Error('Informe VIDEO_TEST_USER_ID para selecionar a conta de validação.')
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1})
const user=(await pool.query('SELECT id,email,role FROM profiles WHERE id=$1',[userId])).rows[0];if(!user)throw Error('Conta não encontrada.')
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000)
const head=b64({alg:'HS256',typ:'JWT',iss:'jobvarejo'}),payload=b64({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600}),unsigned=head+'.'+payload
const token=unsigned+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(unsigned).digest('base64url')
const checks=[]
async function api(path,method='GET',body){const multipart=body instanceof FormData;const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(!multipart&&body?{'Content-Type':'application/json'}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined});const data=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${data.statusMessage||data.message}`);return data}
try{
 const p=await api('/api/videos/projects/107730ec-9bd7-4b66-ad57-1073bf2345ed');
 const report=[];
 for(const id of [p.document.brand.logo,...p.document.offers.map(o=>o.image)]){
  const r=await fetch(base+'/api/videos/assets/'+id+'?preview=1',{headers:{Authorization:'Bearer '+token}});
  if(!r.ok||r.redirected)throw Error('A imagem não foi entregue pelo endpoint autenticado.');
  const raw=Buffer.from(await r.arrayBuffer()),meta=await(await import('sharp')).default(raw).metadata();
  if(!meta.width||!meta.height)throw Error('Imagem incompleta.');
  report.push({id,status:r.status,bytes:raw.length,width:meta.width,height:meta.height});
 }
 const unauth=await fetch(base+'/api/videos/assets/'+p.document.brand.logo+'?preview=1',{redirect:'manual'});
 if(![401,403].includes(unauth.status))throw Error('Imagem disponível sem autenticação.');
 await writeFile('output/video-studio-impact/preview-images-check.json',JSON.stringify({revision:p.revision,unauthenticated:unauth.status,images:report},null,2));
 console.log({revision:p.revision,decoded:report.length,unauthenticated:unauth.status});
}finally{await pool.end()}
