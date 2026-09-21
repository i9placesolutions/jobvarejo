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
const project=await api('/api/videos/projects/107730ec-9bd7-4b66-ad57-1073bf2345ed');await writeFile('output/video-studio-impact/catalog-project.json',JSON.stringify(project,null,2));const jobs=await api('/api/videos/jobs?projectId='+project.id);const job=jobs.items.find(j=>j.kind==='render'&&j.revision===project.revision);console.log({id:job?.id,revision:job?.revision,status:job?.status,progress:job?.progress,error:job?.error});
if(job?.status==='ready'){for(const {format,assetId} of job.result.outputs||[]){const r=await fetch(base+'/api/videos/assets/'+assetId,{headers:{Authorization:'Bearer '+token},redirect:'manual'});if(r.status!==302)throw Error('Asset indisponível');const media=await fetch(r.headers.get('location'));if(!media.ok)throw Error('Download falhou');await writeFile('output/video-studio-impact/catalog-'+format+'.mp4',Buffer.from(await media.arrayBuffer()))}await writeFile('output/video-studio-impact/catalog-result.json',JSON.stringify(job,null,2))}
}finally{await pool.end()}