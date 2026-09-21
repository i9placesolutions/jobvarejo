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
 const dir='output/video-studio-impact';const doc=JSON.parse(await readFile(dir+'/document.json','utf8'));const musicRef=JSON.parse(await readFile(dir+'/music-job.json','utf8'));const jobs=await api('/api/videos/jobs?projectId='+musicRef.projectId);const j=jobs.items.find(j=>j.id===musicRef.id);if(j?.status!=='ready')throw Error('Música ainda não concluída');const id=j.result.assetId;const r=await fetch(base+'/api/videos/assets/'+id,{headers:{Authorization:'Bearer '+token},redirect:'manual'});const audio=await fetch(r.headers.get('location'));await writeFile(dir+'/music.mp3',Buffer.from(await audio.arrayBuffer()));doc.audio.music=id;
 const form=new FormData();form.set('kind','image');form.set('file',new Blob([await readFile(dir+'/'+doc.brand.logo+'.png')],{type:'image/png'}),'logo-video.png');const logo=await api('/api/videos/assets','POST',form);await writeFile(dir+'/'+logo.id+'.png',await readFile(dir+'/'+doc.brand.logo+'.png'));doc.brand.logo=logo.id;await writeFile(dir+'/document.json',JSON.stringify(doc,null,2));console.log({musicReady:true,logoReady:true})
}finally{await pool.end()}