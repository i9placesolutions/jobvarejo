// Aplica os recortes da referência apenas à conta e aos projetos selecionados.
import pg from 'pg'
import {readFile,writeFile} from 'node:fs/promises'
import {isDeepStrictEqual} from 'node:util'
const userId=process.env.VIDEO_TEST_USER_ID
if(!userId)throw Error('Informe VIDEO_TEST_USER_ID.')
const dir='output/video-all-models',ledger=JSON.parse(await readFile(dir+'/projects.json'))
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1}),client=await pool.connect()
try{
 await client.query('BEGIN')
 const {rows}=await client.query('SELECT id,user_id,revision,document FROM video_studio_projects WHERE user_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[userId,ledger.map(p=>p.id)])
 if(rows.length!==102||rows.length!==ledger.length)throw Error('A conta não corresponde aos 102 projetos.')
 const planned=rows.map((row,index)=>{
  const document=structuredClone(row.document),motion=document.motion
  if(!motion||document.templateRevision<19)throw Error('Projeto precisa da revisão de paleta: '+row.id)
  motion.transitionSound=document.transition==='smoke'?'reference-fire-whoosh':['snap-zoom','shutter','rgb'].includes(document.transition)?'reference-short-whoosh':['fade','blur','iris'].includes(document.transition)?'reference-in-out':'reference-whoosh'
  motion.accentSound=['reference-pop','reference-click','reference-cash','reference-ding'][index%4]
  document.audio.sounds=true
  document.audio.effectsVolume=.45
  return {row,document}
 })
 const changes=planned.filter(c=>!isDeepStrictEqual(c.row.document,c.document))
 if(!process.argv.includes('--apply')){await client.query('ROLLBACK');console.log({matched:rows.length,wouldUpdate:changes.length})}
 else{
  if(changes.length)await writeFile(dir+'/before-reference-effects-'+Date.now()+'.json',JSON.stringify(changes.map(c=>c.row),null,2),{flag:'wx'})
  for(const {row,document} of planned){
   let revision=row.revision
   if(changes.some(c=>c.row.id===row.id)){
    const saved=await client.query('UPDATE video_studio_projects SET document=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=$2 AND user_id=$3 AND revision=$4 RETURNING revision',[JSON.stringify(document),row.id,userId,row.revision])
    if(saved.rowCount!==1)throw Error('Conflito de revisão.')
    revision=saved.rows[0].revision
   }
   Object.assign(ledger.find(p=>p.id===row.id),{revision,transitionSound:document.motion.transitionSound,accentSound:document.motion.accentSound})
  }
  await client.query('COMMIT')
  await writeFile(dir+'/projects.json',JSON.stringify(ledger,null,2))
  await writeFile(dir+'/youtube-effects/application.json',JSON.stringify({updatedAt:new Date().toISOString(),matched:rows.length,updated:changes.length,source:'https://www.youtube.com/watch?v=2aoLsF3-2gI',projects:ledger.map(({id,revision,transitionSound,accentSound})=>({id,revision,transitionSound,accentSound}))},null,2))
  console.log({matched:rows.length,updated:changes.length})
 }
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await pool.end()}
