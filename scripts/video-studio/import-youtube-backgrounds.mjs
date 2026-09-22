// Importação privada para os projetos do ledger, solicitada pelo dono da conta.
// Os títulos das playlists não constituem licença; preservamos fonte e créditos.
import pg from 'pg'
import {createHash,createHmac} from 'node:crypto'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
const dir='output/video-all-models',audioDir=dir+'/youtube-music',manifestFile=audioDir+'/import.json'
const userId=process.env.VIDEO_TEST_USER_ID,base=process.env.VIDEO_TEST_BASE||'http://127.0.0.1:3000'
if(!userId||!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Conta explícita e API local obrigatórias.')
const apply=process.argv.includes('--apply')
const playlist=JSON.parse(await readFile(audioDir+'/PL7n6-Ri8nVAMHJP2I16j50ddES5E6O4ns.info.json'))
const ledger=JSON.parse(await readFile(dir+'/projects.json'))
const prior=JSON.parse(await readFile(manifestFile).catch(()=>'[]'))
await mkdir(audioDir+'/normalized',{recursive:true})
const tracks=[]
const entries=[]
for(const name of await readdir(audioDir))if(name.endsWith('.info.json')){
 const info=JSON.parse(await readFile(audioDir+'/'+name))
 if(info.playlist_id===playlist.id)entries.push(info)
}
entries.sort((a,b)=>a.playlist_index-b.playlist_index)
for(const info of entries){
 const entry=info
 const input=audioDir+'/'+entry.id+'.mp3',file=audioDir+'/normalized/'+entry.id+'.mp3'
 const sourceHash=createHash('sha256').update(await readFile(input)).digest('hex')
 let track=prior.find(t=>t.videoId===entry.id&&t.sourceHash===sourceHash)
 if(!track){
  // Mesmo nível percebido, com margem de pico; a composição aplica o ganho final.
  execFileSync('ffmpeg',['-v','error','-y','-i',input,'-af','loudnorm=I=-16:TP=-2:LRA=9','-ar','48000','-ac','2','-b:a','192k',file])
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]))
  if(!probe.streams.some(s=>s.codec_type==='audio')||Number(probe.format.duration)<30)throw Error('Áudio inválido: '+entry.id)
  const title=info.title.split('|')[0].trim()
  track={videoId:entry.id,title,url:info.webpage_url,description:info.description,sourceHash,file,duration:Number(probe.format.duration),sha256:createHash('sha256').update(await readFile(file)).digest('hex'),license:info.license||'Consultar créditos e condições do autor na descrição',userId}
 }
 if(track.userId!==userId)throw Error('Manifesto de outra conta.')
 tracks.push(track)
 console.log('prepared',tracks.length,track.title)
}
if(tracks.length!==15||ledger.length!==102)throw Error('Lote incompleto: esperados 15 áudios e 102 projetos.')
await writeFile(manifestFile,JSON.stringify(tracks,null,2))
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1})
try{
 const user=(await pool.query('SELECT id,email,role FROM profiles WHERE id=$1',[userId])).rows[0]
 if(!user)throw Error('Conta não encontrada.')
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
 const token=()=>{const now=Math.floor(Date.now()/1000),s=encode({alg:'HS256',typ:'JWT',iss:'jobvarejo'})+'.'+encode({sub:user.id,email:user.email,role:user.role,iat:now,exp:now+3600});return s+'.'+createHmac('sha256',process.env.AUTH_JWT_SECRET).update(s).digest('base64url')}
 if(apply)for(const t of tracks){
  if(t.assetId){const owned=await pool.query("SELECT id FROM video_studio_assets WHERE id=$1 AND user_id=$2 AND kind='music'",[t.assetId,userId]);if(owned.rowCount!==1)throw Error('Asset não pertence à conta.');continue}
  const data=new FormData();data.set('kind','music');data.set('file',new Blob([await readFile(t.file)],{type:'audio/mpeg'}),t.title+'.mp3')
  const response=await fetch(base+'/api/videos/assets',{method:'POST',headers:{Authorization:'Bearer '+token()},body:data,signal:AbortSignal.timeout(120000)})
  if(!response.ok)throw Error('Upload falhou: '+response.status)
  t.assetId=(await response.json()).id
  await writeFile(manifestFile,JSON.stringify(tracks,null,2))
  await pool.query('UPDATE video_studio_assets SET metadata=metadata || $1::jsonb WHERE id=$2 AND user_id=$3',[JSON.stringify({sourceUrl:t.url,sourceVideoId:t.videoId,sourceDescription:t.description,sha256:t.sha256,importedBy:userId,importReason:'Músicas de fundo indicadas e importação solicitada pelo usuário',licenseStatus:'Condições individuais do autor; não é licença global do catálogo'}),t.assetId,userId])
  console.log('uploaded',t.videoId,t.title)
 }
 const client=await pool.connect()
 try{
  await client.query('BEGIN')
  const {rows}=await client.query('SELECT id,user_id,revision,document FROM video_studio_projects WHERE id=ANY($1::uuid[]) AND user_id=$2 ORDER BY id FOR UPDATE',[ledger.map(p=>p.id),userId])
  if(rows.length!==ledger.length)throw Error('Projetos ausentes ou de outra conta.')
  const planned=rows.map((row,i)=>{
   const track=tracks[i%tracks.length],document=structuredClone(row.document)
   document.audio.music=track.assetId||track.videoId
   document.audio.musicVolume=document.voice.enabled ? .28 : .5
   return {row,track,document}
  })
  const changes=planned.filter(c=>!isDeepStrictEqual(c.row.document,c.document))
  if(!apply){await client.query('ROLLBACK');console.log({tracks:tracks.length,matched:rows.length,wouldUpdate:changes.length})}
  else{
   for(const {row,track} of planned)Object.assign(ledger.find(p=>p.id===row.id),{revision:row.revision,music:track.assetId,musicTitle:track.title,musicSource:track.url})
   if(changes.length)await writeFile(dir+'/before-youtube-music-'+Date.now()+'.json',JSON.stringify(changes.map(c=>c.row),null,2),{flag:'wx'})
   for(const {row,track,document} of changes){
    const saved=await client.query('UPDATE video_studio_projects SET document=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=$2 AND user_id=$3 AND revision=$4 RETURNING revision',[JSON.stringify(document),row.id,userId,row.revision])
    if(saved.rowCount!==1)throw Error('Conflito: '+row.id)
    Object.assign(ledger.find(p=>p.id===row.id),{revision:saved.rows[0].revision,music:track.assetId,musicTitle:track.title,musicSource:track.url})
   }
   await client.query('COMMIT')
   await writeFile(dir+'/projects.json',JSON.stringify(ledger,null,2))
   await writeFile(dir+'/youtube-music-update.json',JSON.stringify({updatedAt:new Date().toISOString(),tracks:tracks.length,matched:rows.length,updated:changes.length,projects:ledger.map(p=>({id:p.id,revision:p.revision,music:p.music,title:p.musicTitle}))},null,2))
   console.log({tracks:tracks.length,matched:rows.length,updated:changes.length})
  }
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}finally{await pool.end()}
