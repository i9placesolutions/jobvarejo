// Corrige somente os modelos do ledger e da conta explicitamente indicada.
// Preserva músicas, ofertas, edições, MP4s anteriores e registra snapshot recuperável.
import pg from 'pg'
import {readFile,writeFile} from 'node:fs/promises'
import {isDeepStrictEqual} from 'node:util'
const userId=process.env.VIDEO_TEST_USER_ID
if(!userId)throw Error('Informe VIDEO_TEST_USER_ID.')
const dir='output/video-all-models',ledger=JSON.parse(await readFile(dir+'/projects.json'))
const recipes=JSON.parse(await readFile('shared/video-studio/generated-flyer-recipes.json'))
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1})
const client=await pool.connect()
try{
 await client.query('BEGIN')
 const {rows}=await client.query('SELECT id,user_id,revision,document FROM video_studio_projects WHERE id=ANY($1::uuid[]) AND user_id=$2 FOR UPDATE',[ledger.map(r=>r.id),userId])
 if(rows.length!==ledger.length)throw Error('A conta não corresponde a todos os projetos do ledger.')
 const changes=rows.map(row=>{
  const recipe=recipes.find(r=>r.id===row.document.theme)
  if(!recipe)throw Error('Modelo fora do catálogo: '+row.id)
  const document=structuredClone(row.document)
  if((document.templateRevision||0)<19){
   document.templateRevision=19
   document.motion={...document.motion,transitionSound:recipe.motion.transitionSound,accentSound:recipe.motion.accentSound}
   document.audio.effectsVolume=Math.min(document.audio.effectsVolume,.45)
   document.audio.musicVolume=Math.min(document.audio.musicVolume,.36)
  }
  return {row,document}
 }).filter(({row,document})=>!isDeepStrictEqual(row.document,document))
 if(!process.argv.includes('--apply')){console.log({matched:rows.length,wouldUpdate:changes.length});await client.query('ROLLBACK')}
 else{
  if(changes.length)await writeFile(dir+'/before-palette-audio-v19-'+Date.now()+'.json',JSON.stringify(changes.map(c=>c.row),null,2),{flag:'wx'})
  for(const {row,document} of changes){
   const saved=await client.query('UPDATE video_studio_projects SET document=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=$2 AND user_id=$3 AND revision=$4 RETURNING revision',[JSON.stringify(document),row.id,userId,row.revision])
   if(saved.rowCount!==1)throw Error('Conflito ao salvar '+row.id)
   ledger.find(r=>r.id===row.id).revision=saved.rows[0].revision
  }
  await client.query('COMMIT')
  await writeFile(dir+'/projects.json',JSON.stringify(ledger,null,2))
  await writeFile(dir+'/palette-audio-v19-update.json',JSON.stringify({updatedAt:new Date().toISOString(),reason:'Solicitação de correção da paleta e efeitos sonoros dos modelos de encarte',matched:rows.length,updated:changes.length,musicReplaced:false,exportsReplaced:false},null,2))
  console.log({matched:rows.length,updated:changes.length,musicReplaced:false,exportsReplaced:false})
 }
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await pool.end()}
