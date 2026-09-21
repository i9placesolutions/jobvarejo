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
 const unauthorized=await fetch(base+'/api/videos/projects');if(unauthorized.status!==401)throw Error('Rota sem autenticação');checks.push('anonymous rejected')
 const profile=await api('/api/profile');const brand=await api('/api/videos/brand','POST',{});if(brand.brand.name!==profile.business_profile.companyName)throw Error('Empresa divergente');checks.push('registered business imported')
 const form=new FormData();form.set('kind','image');form.set('file',new Blob([await readFile('output/video-studio-validation/coffee.png')],{type:'image/png'}),'produto-demonstracao.png');const asset=await api('/api/videos/assets','POST',form)
 const doc=newVideoDocument();doc.title='[Validação] Vídeo de demonstração';doc.brand=brand.brand;doc.duration=15;doc.voice.enabled=false;doc.offers=[{id:crypto.randomUUID(),name:'Café especial 500 g',price:'19,90',unit:'un',condition:'Preço ilustrativo',image:asset.id}];doc.validity='Demonstração · não publicar';doc.scripts=suggestVideoScripts(doc)
 let project=await api('/api/videos/projects','POST',{revision:0,document:doc,scriptSource:videoSpeechSource(doc)});const reloaded=await api('/api/videos/projects/'+project.id);if(JSON.stringify(reloaded.document)!==JSON.stringify(project.document))throw Error('Persistência divergente');checks.push('save and reload')
 const conflict=await fetch(base+'/api/videos/projects',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id:project.id,revision:0,document:doc,scriptSource:videoSpeechSource(doc)})});if(conflict.status!==409)throw Error('Revisão antiga aceita');checks.push('stale revision rejected')
 const bad={...doc,brand:{...doc.brand,logo:crypto.randomUUID()}};const invalid=await fetch(base+'/api/videos/projects',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({revision:0,document:bad,scriptSource:''})});if(invalid.status!==422)throw Error('Asset externo aceito');checks.push('unknown asset rejected')
 const spoken=await api('/api/videos/normalize','POST',{scripts:[{id:'price',text:'Café 500 g por R$ 19,90.'}],pronunciations:[]});if(!spoken.scripts[0].text.includes('dezenove reais e noventa centavos'))throw Error('Normalização divergente');checks.push('Python pronunciation')
 const queued=await api('/api/videos/jobs','POST',{projectId:project.id,revision:project.revision,kind:'render'});const duplicate=await api('/api/videos/jobs','POST',{projectId:project.id,revision:project.revision,kind:'render'});if(queued.id!==duplicate.id)throw Error('Fila duplicou solicitação');checks.push('durable job and deduplication')
 await mkdir('output/video-studio-validation',{recursive:true});await writeFile('output/video-studio-validation/api-report.json',JSON.stringify({projectId:project.id,jobId:queued.id,checks},null,2));console.log(JSON.stringify({projectId:project.id,jobId:queued.id,checks}))
 if(process.argv.includes('--voice')){const voices=await api('/api/videos/voices');if(!voices.items.length)throw Error('Sem locutores disponíveis');doc.voice.enabled=true;doc.voice.id=voices.items[0].id;doc.scripts=[{id:'intro',text:`Ofertas do ${doc.brand.name}!`},{id:doc.offers[0].id,text:'Café especial por R$ 19,90 a unidade.'},{id:'outro',text:'Aproveite!'}];project=await api('/api/videos/projects','POST',{id:project.id,revision:project.revision,document:doc,scriptSource:videoSpeechSource(doc)});const voice=await api('/api/videos/jobs','POST',{projectId:project.id,revision:project.revision,kind:'voice'});await writeFile('output/video-studio-validation/voice-report.json',JSON.stringify({projectId:project.id,revision:project.revision,jobId:voice.id},null,2));console.log('MusicGPT validation queued',voice.id)}
}finally{await pool.end()}
