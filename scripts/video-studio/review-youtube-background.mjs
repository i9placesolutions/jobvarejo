import pg from 'pg'
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHmac} from 'node:crypto'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
import {renderVideo} from '../../workers/video-studio/engine.mjs'
register()
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const {resolveVideoLabel}=await import('../../shared/video-studio/labels.ts')
const userId=process.env.VIDEO_TEST_USER_ID,base=process.env.VIDEO_TEST_BASE||'http://127.0.0.1:3000'
if(!userId||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Conta e API local obrigatórias.')
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1})
const dir=resolve(process.env.VIDEO_REVIEW_OUTPUT||'output/video-all-models/youtube-music/review');await mkdir(dir,{recursive:true})
try{
 const user=(await pool.query('SELECT id,email,role FROM profiles WHERE id=$1',[userId])).rows[0]
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000)
 const unsigned=encode({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+encode({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600})
 const headers={Authorization:'Bearer '+unsigned+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(unsigned).digest('base64url')}
 const response=await fetch(base+'/api/videos/projects/78cbb7a4-c7ca-4d91-a9f9-62cf00a7338d',{headers})
 if(!response.ok)throw Error('Projeto indisponível: '+response.status)
 const project=await response.json(),document=project.document
 const manifest=JSON.parse(await readFile('output/video-all-models/youtube-music/import.json'))
 const track=manifest.find(t=>t.assetId===document.audio.music)
 if(!track)throw Error('A nova música ainda não foi aplicada.')
 await copyFile(track.file,dir+'/music.mp3')
 const media={}
 for(const id of new Set([document.brand.logo,...document.offers.map(o=>o.image)].filter(Boolean))){
  const asset=await fetch(base+'/api/videos/assets/'+id,{headers,redirect:'manual'})
  if(asset.status!==302)throw Error('Imagem privada indisponível: '+asset.status)
  const bytes=await fetch(asset.headers.get('location'));if(!bytes.ok)throw Error('Download de imagem falhou.')
  await writeFile(dir+'/'+id+'.png',Buffer.from(await bytes.arrayBuffer()));media[id]=id+'.png'
 }
 const labels=await fetch(base+'/api/videos/labels',{headers});if(!labels.ok)throw Error('Etiquetas indisponíveis.')
 const label=resolveVideoLabel((await labels.json()).items,document.theme,document.priceLabel)
 const scenes=buildVideoTimeline(document)
 for(const format of ['vertical','horizontal']){
  const file=dir+'/semana-cliente-'+format+'.mp4'
  await renderVideo({document,label,media,scenes,format,music:'music.mp3'},dir,file,()=>{},{frameRange:[0,239],scale:.5})
  console.log('review ready',format,file)
 }
 await writeFile(dir+'/source.json',JSON.stringify({projectId:project.id,revision:project.revision,music:track.title,musicAssetId:track.assetId,document},null,2))
}finally{await pool.end()}
