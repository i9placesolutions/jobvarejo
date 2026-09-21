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
 const saved=JSON.parse(await readFile('output/video-studio-professional/project.json','utf8'));const project=await api('/api/videos/projects/'+saved.id);const doc=project.document;doc.title='Fecha Mês — Impacto';doc.voice.enabled=false;doc.priceLabel='';doc.effects=['fire','smoke','embers','shake','zoom','glow','rays'];doc.intensity=.85;doc.audio.music='energy';doc.audio.musicVolume=.40;doc.audio.effectsVolume=.65;
 const profile=await api('/api/profile');const b=profile.business_profile;for(const key of ['phone','facebook','website','slogan','hours','paymentNotes'])doc.brand[key]=b[key]||'';doc.brand.addresses=(b.addresses||[]).map(a=>a.value);doc.brand.whatsappNumbers=(b.whatsappNumbers||[]).map(a=>a.value);doc.scripts=suggestVideoScripts(doc);
 const dir='output/video-studio-impact';await mkdir(dir,{recursive:true});await writeFile(dir+'/document.json',JSON.stringify(doc,null,2));
 for(const id of [doc.brand.logo,...doc.offers.map(o=>o.image)].filter(Boolean)){const r=await fetch(base+'/api/videos/assets/'+id,{headers:{Authorization:'Bearer '+token},redirect:'manual'});if(r.status!==302)throw Error('Asset não disponível');const file=await fetch(r.headers.get('location'));await writeFile(dir+'/'+id+'.png',Buffer.from(await file.arrayBuffer()))}
 const music=await api('/api/videos/jobs','POST',{projectId:project.id,revision:project.revision,kind:'music',musicPrompt:'High-energy Brazilian supermarket TV commercial instrumental, 128 BPM, punchy modern drums, powerful bass, bright brass stabs and electric guitar rhythmic accents, exciting promotional retail advertisement, sharp rhythmic transitions every 4 bars, polished broadcast production, no singing no vocals no spoken words, 30 seconds.'});console.log(JSON.stringify({prepared:dir,musicJob:music.id}));await writeFile(dir+'/music-job.json',JSON.stringify({id:music.id,projectId:project.id}));
}finally{await pool.end()}