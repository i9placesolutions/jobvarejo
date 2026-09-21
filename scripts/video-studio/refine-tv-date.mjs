// Integração local com a conta explicitamente selecionada. Token só em memória.
import pg from 'pg'
import {createHmac} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
register()
const {videoAudioIdentity}=await import('../../shared/video-studio/model.ts')
const base=process.env.VIDEO_TEST_BASE||'http://127.0.0.1:3042'
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Teste permitido somente na instância local.')
const userId=process.env.VIDEO_TEST_USER_ID;if(!userId)throw Error('Informe VIDEO_TEST_USER_ID para selecionar a conta de validação.')
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1})
const user=(await pool.query('SELECT id,email,role FROM profiles WHERE id=$1',[userId])).rows[0];if(!user)throw Error('Conta não encontrada.')
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000)
const head=b64({alg:'HS256',typ:'JWT',iss:'jobvarejo'}),payload=b64({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600}),unsigned=head+'.'+payload
const token=unsigned+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(unsigned).digest('base64url')
async function api(path,method='GET',body){const multipart=body instanceof FormData;const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(!multipart&&body?{'Content-Type':'application/json'}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined});const data=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${data.statusMessage||data.message}`);return data}
try {
 const p = await api('/api/videos/projects/107730ec-9bd7-4b66-ad57-1073bf2345ed');
 const jobs = await api('/api/videos/jobs?projectId='+p.id);
 const voice = jobs.items.find(j=>j.kind==='voice'&&j.status==='ready'&&j.result?.audioIdentity===videoAudioIdentity(p.document));
 const dir='output/video-studio-impact';
 await writeFile(dir+'/tv-date-source.json',JSON.stringify({project:p,voice},null,2));
 console.log({revision:p.revision,audio:p.document.audio,voice:voice?.id,jobs:jobs.items.filter(j=>j.status==='running'||j.status==='queued').map(j=>({id:j.id,kind:j.kind,status:j.status}))});
 if(process.argv.includes('--prepare')) {
   for(const [name,id] of [['tv-date-music.mp3',p.document.audio.music],...Object.entries(voice.result.clips).map(([id,c])=>['tv-date-'+id+'.mp3',c.assetId])]) {
     const r=await fetch(base+'/api/videos/assets/'+id,{headers:{Authorization:'Bearer '+token},redirect:'manual'});
     if(r.status!==302)throw Error('Asset indisponível');
     const media=await fetch(r.headers.get('location'));if(!media.ok)throw Error('Download falhou');
     await writeFile(dir+'/'+name,Buffer.from(await media.arrayBuffer()));
   }
 }
 if(process.argv.includes('--render')) {
   const d=p.document;
   const saved=await api('/api/videos/projects','POST',{id:p.id,revision:p.revision,document:d,scriptSource:p.script_source});
   const render=await api('/api/videos/jobs','POST',{projectId:saved.id,revision:saved.revision,kind:'render'});
   await writeFile(dir+'/tv-date-render-job.json',JSON.stringify(render,null,2));
   console.log({revision:saved.revision,render:render.id});
 }
 if(process.argv.includes('--download')) {
   const job=jobs.items.find(j=>j.kind==='render'&&j.revision===p.revision);
   console.log({id:job?.id,status:job?.status,progress:job?.progress,error:job?.error});
   if(job?.status==='ready'){
     for(const {format,assetId} of job.result.outputs){
       const r=await fetch(base+'/api/videos/assets/'+assetId,{headers:{Authorization:'Bearer '+token},redirect:'manual'});
       const media=await fetch(r.headers.get('location'));if(!media.ok)throw Error('Download falhou');
       await writeFile(dir+'/tv-date-'+format+'.mp4',Buffer.from(await media.arrayBuffer()));
     }
     await writeFile(dir+'/tv-date-result.json',JSON.stringify(job,null,2));
   }
 }
} finally {await pool.end()}
