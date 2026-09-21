// Integração local com a conta explicitamente selecionada. Token só em memória.
import pg from 'pg'
import {createHmac} from 'node:crypto'
import {writeFile,readFile,mkdir} from 'node:fs/promises'
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
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates.ts')
const {resolveVideoLabel}=await import('../../shared/video-studio/labels.ts')
const {videoSpeechSource}=await import('../../shared/video-studio/model.ts')
const dir='output/video-flyer-models';await mkdir(dir,{recursive:true})
try {
 const source=await api('/api/videos/projects/107730ec-9bd7-4b66-ad57-1073bf2345ed')
 const existing=(await api('/api/videos/projects')).items
 const labels=(await api('/api/videos/labels')).items
 const saved=[]
 for(const id of ['alerta','relampago','saldao']) {
  const doc=newVideoFromTemplate(id);doc.brand=source.document.brand;doc.offers=source.document.offers;doc.validity='20 A 27/09/2026';doc.audio.musicVolume=.5;doc.audio.effectsVolume=.7;doc.title=doc.campaign+' — Modelo de demonstração';doc.priceLabel=resolveVideoLabel(labels,id)?.id||''
  let p=existing.find(p=>p.document?.theme===id&&p.document?.title===doc.title)
  if(process.argv.includes('--create')) {
   if(p&&process.argv.includes('--update'))p=await api('/api/videos/projects','POST',{id:p.id,revision:p.revision,document:doc,scriptSource:videoSpeechSource(doc)})
   if(!p)p=await api('/api/videos/projects','POST',{revision:0,document:doc,scriptSource:videoSpeechSource(doc)})
   saved.push({id:p.id,theme:id});console.log({model:id,project:p.id,revision:p.revision})
   if(process.argv.includes('--render')){
    const jobs=(await api('/api/videos/jobs?projectId='+p.id)).items
    const job=jobs.find(j=>j.kind==='render'&&j.revision===p.revision&&['ready','running','queued'].includes(j.status))||await api('/api/videos/jobs','POST',{projectId:p.id,revision:p.revision,kind:'render'})
    console.log({job:job.id,status:job.status})
   }
  }
 }
 if(saved.length)await writeFile(dir+'/projects.json',JSON.stringify(saved,null,2))
 if(process.argv.includes('--status')||process.argv.includes('--download')){
  const projects=JSON.parse(await readFile(dir+'/projects.json','utf8'))
  for(const p of projects){
   const jobs=(await api('/api/videos/jobs?projectId='+p.id)).items;const job=jobs.find(j=>j.kind==='render')
   console.log({model:p.theme,job:job?.id,status:job?.status,progress:job?.progress,error:job?.error})
   if(process.argv.includes('--download')&&job?.status==='ready'){
    await writeFile(dir+'/'+p.theme+'-result.json',JSON.stringify(job,null,2))
    for(const o of job.result.outputs){const r=await fetch(base+'/api/videos/assets/'+o.assetId,{headers:{Authorization:'Bearer '+token},redirect:'manual'});if(r.status!==302)throw Error('Asset indisponível');const media=await fetch(r.headers.get('location'));if(!media.ok)throw Error('Download falhou');await writeFile(dir+'/'+p.theme+'-'+o.format+'.mp4',Buffer.from(await media.arrayBuffer()))}
   }
  }
 }
}finally{await pool.end()}
