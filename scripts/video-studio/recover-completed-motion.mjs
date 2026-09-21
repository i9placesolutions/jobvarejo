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
 const jobId='62404ab9-cecf-466c-839e-84bbbb0feafd';
 const job=(await pool.query('SELECT * FROM video_studio_jobs WHERE id=$1 AND user_id=$2',[jobId,userId])).rows[0];
 if(job?.status!=='failed'||job.attempts!==1||job.error!=='A geração foi assumida por outro processo.')throw Error('A tarefa mudou. Conferir antes de recuperar.');
 const targets=[{format:'vertical',id:'5eb2eb0f-c640-44d1-a738-8c1fe4f3a235',bytes:35708249,width:1080,height:1920},{format:'horizontal',id:'03e810da-e338-4a87-b589-ead9b24e669d',bytes:32072127,width:1920,height:1080}];
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const exec=promisify(execFile);
 const outputs=await Promise.all(targets.map(async t=>{
  const asset=(await pool.query("SELECT * FROM video_studio_assets WHERE id=$1 AND user_id=$2 AND kind='render'",[t.id,userId])).rows[0];
  if(!asset||Number(asset.bytes)!==t.bytes||asset.created_at<job.created_at||asset.created_at>job.updated_at)throw Error('Arquivo não corresponde à execução verificada.');
  const r=await fetch(base+'/api/videos/assets/'+t.id,{headers:{Authorization:'Bearer '+token},redirect:'manual'});
  if(r.status!==302)throw Error('Arquivo indisponível.');const response=await fetch(r.headers.get('location'));if(!response.ok)throw Error('Não foi possível baixar o vídeo.');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==t.bytes)throw Error('Vídeo incompleto.');
  const file='output/video-studio-impact/motion-'+t.format+'.mp4';await writeFile(file,bytes);
  const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,codec_type,width,height,r_frame_rate','-of','json',file]);const probe=JSON.parse(stdout),v=probe.streams.find(s=>s.codec_type==='video');
  if(v?.width!==t.width||v?.height!==t.height||v?.codec_name!=='h264'||!probe.streams.some(s=>s.codec_type==='audio')||Number(probe.format.duration)>30)throw Error('Validação do MP4 falhou.');
  console.log({format:t.format,bytes:bytes.length,probe});
  return {format:t.format,assetId:t.id,duration:Number(probe.format.duration)};
 }));
 await pool.query('BEGIN');
 try{
  const update=await pool.query("UPDATE video_studio_jobs SET status='ready',progress=100,error=NULL,result=$1::jsonb,provider_state=coalesce(provider_state,'{}'::jsonb)||$2::jsonb,updated_at=now() WHERE id=$3 AND user_id=$4 AND status='failed' AND attempts=1 AND revision=7 AND error=$5 RETURNING id",[JSON.stringify({outputs}),JSON.stringify({recovery:{reason:'MP4 completos confirmados após falso positivo de renovação da lease',verifiedAt:new Date().toISOString()}}),jobId,userId,job.error]);
  if(update.rowCount!==1)throw Error('A tarefa mudou durante a recuperação.');
  for(const out of outputs)await pool.query("UPDATE video_studio_assets SET metadata=metadata||$1::jsonb WHERE id=$2 AND user_id=$3",[JSON.stringify({jobId,revision:7,format:out.format,recovered:true}),out.assetId,userId]);
  await pool.query('COMMIT');
 }catch(e){await pool.query('ROLLBACK');throw e}
 await writeFile('output/video-studio-impact/motion-result.json',JSON.stringify({id:jobId,status:'ready',revision:7,result:{outputs}},null,2));
 console.log({recovered:jobId,outputs:outputs.length});
}finally{await pool.end()}
