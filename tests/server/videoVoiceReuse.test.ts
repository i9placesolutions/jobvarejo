import {beforeEach,describe,expect,it,vi} from 'vitest'
import {createHash} from 'node:crypto'
import {newVideoDocument,videoAudioIdentity,videoAudioIdentityMatches,videoSpeechSource} from '../../shared/video-studio/model'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {prepareVoiceReuse} from '../../shared/video-studio/voice-reuse'

const mocks=vi.hoisted(()=>({auth:vi.fn(),query:vi.fn(),tx:vi.fn(),body:vi.fn(),parts:vi.fn(),stage:vi.fn()}))
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
vi.mock('../../server/utils/video-studio/service',()=>({videoUser:mocks.auth,videoJson:JSON.stringify,videoHash:(value:unknown)=>hash(value)}))
vi.mock('../../server/utils/postgres',()=>({pgTx:mocks.tx}))
vi.mock('../../shared/video-studio/read-json-parts',()=>({readVideoJsonParts:mocks.parts}))
vi.mock('../../server/utils/video-studio/payload-parts',()=>({stageVideoPayload:mocks.stage}))
vi.stubGlobal('defineEventHandler',(handler:unknown)=>handler)
vi.stubGlobal('readBody',mocks.body)
vi.stubGlobal('createError',(value:any)=>Object.assign(new Error(value.statusMessage),value))
const {default:handler}=await import('../../server/api/videos/voice/reuse.post')
const owner='user-a',projectId='616e9e24-22ce-4b35-a5c7-5cb73f954082',jobId='875820e2-dd12-4980-99a2-bf762370fe7b',assetId='7af9eecd-7988-4967-a0f7-660089b7a233'
let project:any,job:any,asset:any,prior:any,casFails:boolean
beforeEach(()=>{
 vi.clearAllMocks();prior=undefined;casFails=false
 const doc=newVideoDocument();doc.title='Meu vídeo';doc.voice={enabled:true,id:'current',pronunciations:[]};doc.duration=30
 doc.offers=[{id:'cb5f25d8-d1c5-42f0-8456-7f1a32cdc466',name:'Arroz',price:'26,99',unit:'UN',image:'',condition:''}]
 doc.scripts=[{id:'intro',text:'Roteiro atual.'},{id:doc.offers[0]!.id,text:'Arroz por vinte e seis reais.'},{id:'outro',text:'Aproveite.'}]
 doc.narrationText=doc.scripts.map(s=>s.text).join('\n');doc.layoutEdits={vertical:{intro:{seal:{x:20,y:0,scale:1,rotation:0}}}}
 const original=structuredClone(doc);original.voice={id:'original',enabled:true,pronunciations:[]};original.scripts[1]!.text='Arroz por vinte e seis reais e noventa e nove centavos.'
 project={id:projectId,user_id:owner,title:'Meu vídeo',revision:7,document:doc,script_source:videoSpeechSource(doc)}
 job={id:jobId,result:{provider:'elevenlabs',audioIdentity:videoAudioIdentity(original),fullVoice:{assetId,duration:10,boundaries:[0,2,7,10]}}}
 asset={id:assetId,kind:'voice',storage_key:`video-studio/${owner}/assets/${assetId}.mp3`,content_type:'audio/mpeg',bytes:500,duration:10}
 mocks.auth.mockResolvedValue({id:owner});mocks.body.mockResolvedValue({projectId,revision:7,jobId,userId:'attacker'})
 mocks.parts.mockImplementation(async()=>project);mocks.tx.mockImplementation(async(fn:any)=>fn({query:mocks.query}))
 mocks.query.mockImplementation(async(sql:string,params:any[])=>{
  if(sql.includes('SET LOCAL'))return {rows:[]}
  if(sql.includes('FOR UPDATE'))return {rows:project?[{id:project.id,revision:project.revision}]:[]}
  if(sql.includes('SELECT id,result'))return {rows:job?[job]:[]}
  if(sql.includes('video_studio_assets'))return {rows:asset?[asset]:[]}
  if(sql.includes('fingerprint=$3'))return {rows:prior?[prior]:[]}
  if(sql.includes('UPDATE public.video_studio_projects'))return {rows:casFails?[]:[{id:projectId,title:project.title,revision:8}]}
  if(sql.includes('INSERT INTO public.video_studio_jobs'))return {rows:[{id:'reused',kind:'voice',status:'ready',result:JSON.parse(params[4]),revision:params[2]}]}
  throw Error('Consulta inesperada')
 })
})
const mutations=()=>mocks.query.mock.calls.filter(([sql])=>/UPDATE |INSERT /.test(sql))

describe('POST reutilização de áudio existente',()=>{
 it('preserva documento comercial e usa o hash do documento normalizado que o render seleciona',async()=>{
  const originalJob=JSON.stringify(job),before=structuredClone(project.document)
  const result=await handler({} as any)
  expect(result.project.document.offers).toEqual(before.offers)
  expect(result.project.document.layoutEdits).toEqual(before.layoutEdits)
  expect(result.project.document.audio).toEqual(before.audio)
  expect(result.project.document.scripts[1].text).toContain('noventa e nove')
  expect(JSON.stringify(job)).toBe(originalJob)
  const payload=JSON.parse(mocks.stage.mock.calls[0]![1])
  expect(payload.audioHash).toBe(hash(videoAudioIdentity(videoDocumentSchema.parse(result.project.document))))
  expect(payload.reusedFromJobId).toBe(jobId)
  expect(result.job.result.fullVoice.assetId).toBe(assetId)
  expect(videoAudioIdentityMatches(result.job.result.audioIdentity,result.project.document)).toBe(true)
  expect(mocks.query.mock.calls.find(([sql])=>sql.includes('FOR UPDATE'))?.[1]).toEqual([projectId,owner])
  expect(mocks.query.mock.calls.find(([sql])=>sql.includes('SELECT id,result'))?.[1]).toEqual([jobId,projectId,owner])
  expect(mocks.query.mock.calls.find(([sql])=>sql.includes('video_studio_assets'))?.[1]).toEqual([assetId,owner])
  expect(mocks.query.mock.calls.find(([sql])=>sql.includes('UPDATE public'))?.[1].slice(2)).toEqual([projectId,owner,7])
 })
 it('não acessa o banco sem autenticação',async()=>{
  mocks.auth.mockRejectedValue(new Error('unauthorized'))
  await expect(handler({} as any)).rejects.toThrow('unauthorized')
  expect(mocks.tx).not.toHaveBeenCalled()
 })
 it('rejeita revisão antiga antes de recuperar ou gravar documentos',async()=>{
  project.revision=8
  await expect(handler({} as any)).rejects.toMatchObject({statusCode:409})
  expect(mocks.parts).not.toHaveBeenCalled();expect(mutations()).toHaveLength(0)
 })
 it('rejeita projeto, job ou asset ausente no escopo autenticado sem mutações',async()=>{
  for(const missing of ['project','job','asset']){
   const saved={project,job,asset};if(missing==='project')project=undefined;if(missing==='job')job=undefined;if(missing==='asset')asset=undefined
   await expect(handler({} as any)).rejects.toMatchObject({statusCode:404})
   expect(mutations()).toHaveLength(0);({project,job,asset}=saved)
  }
 })
 it('bloqueia modelos e storage_key de outra conta',async()=>{
  asset.storage_key=`video-studio/other/assets/${assetId}.mp3`
  await expect(handler({} as any)).rejects.toMatchObject({statusCode:404})
  expect(mutations()).toHaveLength(0)
  project.title='Campanha — Modelo profissional'
  await expect(handler({} as any)).rejects.toMatchObject({statusCode:409})
  expect(mutations()).toHaveLength(0)
 })
 it('não insere job se o CAS da atualização falhar',async()=>{
  casFails=true
  await expect(handler({} as any)).rejects.toMatchObject({statusCode:409})
  expect(mocks.stage).not.toHaveBeenCalled()
  expect(mutations().some(([sql])=>sql.includes('INSERT'))).toBe(false)
 })
 it('restaura novamente um roteiro alterado mesmo quando o mesmo reuso já existe',async()=>{
  prior={id:'reused-before',kind:'voice',status:'ready'}
  const result=await handler({} as any)
  expect(result.project.document.voice.id).toBe('original')
  expect(result.project.revision).toBe(8)
  expect(result.job.id).toBe('reused-before')
  expect(mutations()).toHaveLength(1)
  expect(mocks.stage).not.toHaveBeenCalled()
 })
 it('não grava novamente se a locução já está aplicada ao mesmo documento',async()=>{
  const plan=prepareVoiceReuse(project.document,job.result.audioIdentity,job.result)
  project.document=videoDocumentSchema.parse(plan.document)
  project.script_source=videoSpeechSource(project.document)
  prior={id:'reused-before',kind:'voice',status:'ready'}
  const result=await handler({} as any)
  expect(result.project.revision).toBe(7)
  expect(result.job.id).toBe('reused-before')
  expect(mutations()).toHaveLength(0)
 })
})
