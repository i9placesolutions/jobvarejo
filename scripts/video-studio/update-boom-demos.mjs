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
const dir='output/video-all-models';
try {
 const ledger=JSON.parse(await readFile(dir+'/projects.json','utf8'));
 const changed=[];
 for(const row of ledger.filter(p=>/Boom de Ofertas/.test(p.name))){
  const p=await api('/api/videos/projects/'+row.id),r=FLYER_RECIPES[row.theme];
  const doc=structuredClone(p.document);
  doc.templateRevision=r.revision;doc.transition=r.transition;doc.motion={...doc.motion,atmosphere:r.motion.atmosphere,accentSound:'boom',transitionSound:'suction'};
  const saved=isDeepStrictEqual(doc,p.document)?p:await api('/api/videos/projects','POST',{id:p.id,revision:p.revision,document:doc,scriptSource:videoSpeechSource(doc)});
  row.revision=saved.revision;changed.push(row);
  await writeFile(dir+'/projects.json',JSON.stringify(ledger,null,2));
  console.log('updated',row.name,row.revision);
  if(process.argv.includes('--render')){const j=await api('/api/videos/jobs','POST',{projectId:row.id,revision:row.revision,kind:'render'});console.log('queued',j.id);}
 }
 await writeFile(dir+'/boom-v14-projects.json',JSON.stringify(changed,null,2));
} finally {await pool.end()}
