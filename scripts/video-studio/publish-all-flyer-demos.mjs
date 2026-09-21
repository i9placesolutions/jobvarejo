// Lote local retomável. Conta explícita, APIs autenticadas e limites da fila preservados.
import pg from 'pg'
import {isDeepStrictEqual} from 'node:util'
import {createHmac} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
register()
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates.ts')
const {FLYER_RECIPES}=await import('../../shared/video-studio/flyer-recipes.ts')
const {resolveVideoLabel}=await import('../../shared/video-studio/labels.ts')
const {videoSpeechSource}=await import('../../shared/video-studio/model.ts')
if(process.argv.includes('--render')&&!process.argv.includes('--approved-review'))throw Error('Renderização em lote suspensa para revisão. Use --approved-review somente após aprovação dos modelos desta revisão pelo usuário.')
const base=process.env.VIDEO_TEST_BASE||'http://127.0.0.1:3042',userId=process.env.VIDEO_TEST_USER_ID
if(!userId||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Informe a conta e use somente a instância local.')
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1}),user=(await pool.query('SELECT id,email,role FROM profiles WHERE id=$1',[userId])).rows[0]
if(!user)throw Error('Conta não encontrada')
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
const token=()=>{const now=Math.floor(Date.now()/1000),s=b64({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+b64({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600});return s+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(s).digest('base64url')}
async function api(path,method='GET',body){for(let attempt=0;attempt<8;attempt++){let r;try{r=await fetch(base+path,{signal:AbortSignal.timeout(240000),method,headers:{Authorization:'Bearer '+token(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}catch(error){if(path==='/api/videos/jobs'&&body?.kind==='render'){console.log('render request response uncertain; retrying same idempotent request',attempt+1);await sleep(15000);continue}throw error}const data=await r.json();if(r.status>=500&&path==='/api/videos/jobs'&&body?.kind==='render'){await sleep(15000);continue}if(r.status===429){await sleep(15000);continue}if(!r.ok)throw Error(`${path}: ${r.status} ${data.statusMessage||data.message}`);return data}throw Error('Limite temporário persistente')}
const dir='output/video-all-models';await mkdir(dir,{recursive:true})
try{
 let ledger=[]
 if(process.argv.includes('--resume'))ledger=JSON.parse(await readFile(dir+'/projects.json','utf8'))
 else {
 const source=await api('/api/videos/projects/107730ec-9bd7-4b66-ad57-1073bf2345ed'),labels=(await api('/api/videos/labels')).items,existing=(await api('/api/videos/projects')).items
 for(const r of Object.values(FLYER_RECIPES)){
  const doc=newVideoFromTemplate(r.id);doc.brand=source.document.brand;doc.offers=source.document.offers;doc.validity='20 A 27/09/2026';doc.audio.musicVolume=.5;doc.audio.effectsVolume=.7;doc.title=(r.name+' — Modelo de demonstração').slice(0,100);doc.priceLabel=resolveVideoLabel(labels,r.id)?.id||''
  let p=existing.find(p=>p.document?.theme===r.id&&p.title?.endsWith('Modelo de demonstração'))
  if(!p||!isDeepStrictEqual(p.document,doc))p=await api('/api/videos/projects','POST',{...(p?{id:p.id,revision:p.revision}:{revision:0}),document:doc,scriptSource:videoSpeechSource(doc)})
  ledger.push({id:p.id,theme:r.id,name:r.name,sourceProject:r.sourceProject,revision:p.revision,music:r.music})
  await writeFile(dir+'/projects.json',JSON.stringify(ledger,null,2));console.log('saved',ledger.length,102,r.name);await sleep(1100)
 }
 }
 if(process.argv.includes('--render')){
  let last='';while(true){
   const rows=[];for(let offset=0;;offset+=5){const page=(await pool.query("SELECT DISTINCT ON(project_id) id,project_id,revision,status,progress,error,result FROM video_studio_jobs WHERE user_id=$1 AND kind='render' ORDER BY project_id,created_at DESC LIMIT 5 OFFSET $2",[userId,offset])).rows;rows.push(...page);if(page.length<5)break}
   const current=ledger.map(p=>({...p,job:rows.find(j=>j.project_id===p.id&&j.revision===p.revision)}));await writeFile(dir+'/render-status.json',JSON.stringify(current,null,2))
   const ready=current.filter(p=>p.job?.status==='ready').length,failed=current.filter(p=>p.job?.status==='failed'),active=(await pool.query("SELECT count(*)::int n FROM video_studio_jobs WHERE user_id=$1 AND status IN ('running','queued')",[userId])).rows[0].n,pending=current.filter(p=>!p.job).sort((a,b)=>(a.name==='Quinta da carne'?-1:b.name==='Quinta da carne'?1:0))
   const summary=JSON.stringify({ready,active,pending:pending.length,failed:failed.map(p=>({name:p.name,error:p.job.error}))});if(last!==summary){console.log(new Date().toISOString(),summary);last=summary}
   if(failed.length)throw Error('Há falhas no lote; consulte render-status.json antes de retomar.')
   if(ready===ledger.length)break
   for(const p of pending.slice(0,Math.max(0,3-active))){const j=await api('/api/videos/jobs','POST',{projectId:p.id,revision:p.revision,kind:'render'});console.log('queued',p.name,j.id);await sleep(5500)}
   await sleep(15000)
  }
 }
}finally{await pool.end()}
