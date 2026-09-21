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
const p=await api('/api/videos/projects/107730ec-9bd7-4b66-ad57-1073bf2345ed');const d=p.document;
d.layoutVersion=2;d.duplicateProducts=true;d.brand.logoStyle='sticker';d.priceLabel='';d.effects=['zoom','smoke','embers','glow','rays','pulse'];d.intensity=.8;
const sharp=(await import('sharp')).default;
for(const o of d.offers){const r=await fetch(base+'/api/videos/assets/'+o.image,{headers:{Authorization:'Bearer '+token},redirect:'manual'});if(r.status!==302)throw Error('Imagem não disponível');const img=await fetch(r.headers.get('location'));const raw=Buffer.from(await img.arrayBuffer());const old=await sharp(raw).metadata(),trim=await sharp(raw).trim({threshold:10}).png().toBuffer({resolveWithObject:true});o.imageAspectRatio=trim.info.width/trim.info.height;
if(trim.info.width!==old.width||trim.info.height!==old.height){const form=new FormData();form.append('kind','image');form.append('file',new Blob([trim.data],{type:'image/png'}),o.name+'-video.png');o.image=(await api('/api/videos/assets','POST',form)).id;}
await writeFile('output/video-studio-impact/'+o.image+'.png',trim.data);
}
const saved=await api('/api/videos/projects','POST',{id:p.id,revision:p.revision,document:d,scriptSource:p.script_source});await writeFile('output/video-studio-impact/showcase-project.json',JSON.stringify(saved,null,2));
const render=await api('/api/videos/jobs','POST',{projectId:saved.id,revision:saved.revision,kind:'render'});console.log({project:saved.id,revision:saved.revision,render:render.id});
}finally{await pool.end()}
