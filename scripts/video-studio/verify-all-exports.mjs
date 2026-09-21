// Auditoria das exportações da conta selecionada; mídia temporária removida após a conferência.
import pg from 'pg'
import {createHmac,createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const exec=promisify(execFile),userId=process.env.VIDEO_TEST_USER_ID,base=process.env.VIDEO_TEST_BASE||'http://127.0.0.1:3042'
if(!userId||!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Conta e instância local obrigatórias')
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1}),user=(await pool.query('SELECT id,email,role FROM profiles WHERE id=$1',[userId])).rows[0],dir='output/video-all-models'
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),sleep=ms=>new Promise(r=>setTimeout(r,ms))
const token=()=>{const now=Math.floor(Date.now()/1000),s=b64({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+b64({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600});return s+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(s).digest('base64url')}
const reviewVersion=process.env.VIDEO_REVIEW_VERSION||'13'
if(!/^\d+$/.test(reviewVersion))throw Error('Revisão inválida')
const reportFile=dir+'/export-verification-v'+reviewVersion+'.json',samplesDir=dir+'/verified-samples-v'+reviewVersion
let results=JSON.parse(await readFile(reportFile,'utf8').catch(()=> '[]'))
await mkdir(samplesDir,{recursive:true})
try{while(true){
 const projects=JSON.parse(await readFile(dir+'/projects.json','utf8'))
 const fresh=results.filter(r=>projects.some(p=>p.id===r.projectId&&p.revision===r.revision));if(fresh.length!==results.length){results=fresh;await writeFile(reportFile,JSON.stringify(results,null,2))}
 const rows=[];for(let offset=0;;offset+=5){const page=(await pool.query("SELECT DISTINCT ON(project_id) id,project_id,revision,status,result,error FROM video_studio_jobs WHERE user_id=$1 AND kind='render' ORDER BY project_id,created_at DESC LIMIT 5 OFFSET $2",[userId,offset])).rows;rows.push(...page);if(page.length<5)break}
 let expected=0
 for(const p of projects){const job=rows.find(j=>j.project_id===p.id&&j.revision===p.revision);if(job?.status!=='ready')continue
  for(const o of job.result.outputs){expected++;if(results.some(v=>v.assetId===o.assetId))continue
   const a=await fetch(base+'/api/videos/assets/'+o.assetId,{headers:{Authorization:'Bearer '+token()},redirect:'manual'});if(a.status!==302)throw Error('Asset privado indisponível: '+a.status)
   const response=await fetch(a.headers.get('location'));if(!response.ok)throw Error('Falha ao baixar exportação');const bytes=Buffer.from(await response.arrayBuffer()),file=samplesDir+'/'+o.assetId+'.mp4';await writeFile(file,bytes)
   const {stdout}=await exec('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]);const info=JSON.parse(stdout),v=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio'),size=o.format==='vertical'?[1080,1920]:[1920,1080]
   if(v?.width!==size[0]||v?.height!==size[1]||v?.codec_name!=='h264'||audio?.codec_name!=='aac'||Number(info.format.duration)>30||Number(info.format.duration)<5)throw Error('Exportação inválida: '+p.name+' '+o.format)
   const record={projectId:p.id,name:p.name,theme:p.theme,jobId:job.id,revision:p.revision,assetId:o.assetId,format:o.format,width:v.width,height:v.height,fps:v.avg_frame_rate,videoCodec:v.codec_name,audioCodec:audio.codec_name,audioChannels:audio.channels,duration:Number(info.format.duration),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),verifiedAt:new Date().toISOString()}
   results=results.filter(r=>!(r.projectId===p.id&&r.format===o.format));results.push(record);await writeFile(reportFile,JSON.stringify(results,null,2))
   // Uma amostra por família fica disponível localmente para revisão com áudio.
   const recipe=JSON.parse(await readFile('shared/video-studio/generated-flyer-recipes.json','utf8')).find(r=>r.id===p.theme),familyFile=samplesDir+'/'+recipe.backgroundKind+'-'+o.format+'.mp4'
   await writeFile(familyFile,bytes);await writeFile(familyFile+'.json',JSON.stringify(record,null,2))
   await rm(file);console.log('verified',results.length,204,p.name,o.format)
  }
 }
 if(projects.length===102&&expected===204&&results.length===204)break
 await sleep(30000)
}}finally{await pool.end()}
